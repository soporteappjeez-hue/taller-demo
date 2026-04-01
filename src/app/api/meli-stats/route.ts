import { NextRequest, NextResponse } from "next/server";
import { getActiveAccounts, getValidToken, meliGet, meliGetWithRetry, MeliAccount } from "@/lib/meli";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

type LogisticType = "correo" | "flex" | "turbo" | "full" | "other";

// 4-signal classification — mirrors meli-labels/route.ts:73-93 (proven working)
function classifyLogistic(
  logisticType: string,
  tags: string[],
  mode = "",
  trackingNumber = ""
): LogisticType {
  const lt = (logisticType ?? "").toLowerCase();
  const t  = (tags ?? []).join(",").toLowerCase();
  const md = (mode ?? "").toLowerCase();
  const tn = (trackingNumber ?? "").toUpperCase();

  // Full: any signal is enough
  if (
    tn.startsWith("INVE") ||
    lt === "fulfillment" || lt.includes("fulfillment") ||
    md === "fulfillment" || md.includes("fulfillment") ||
    t.includes("fulfillment")
  ) return "full";

  // Turbo
  if (t.includes("turbo") || t.includes("same_day") || t.includes("express"))
    return "turbo";

  // Flex
  if (lt === "self_service" || lt.includes("flex") || t.includes("flex"))
    return "flex";

  // Correo (default — cross_docking, drop_off, or unknown)
  return "correo";
}

function getPeriodDates(
  period: string,
  dateFrom?: string | null,
  dateTo?: string | null,
  tzOffset: number = 0
): { from: Date; to: Date; days: number } {
  if (dateFrom && dateTo) {
    const from = new Date(dateFrom + "T00:00:00");
    const to   = new Date(dateTo   + "T23:59:59");
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
    return { from, to, days };
  }
  
  const to   = new Date();
  const from = new Date();
  
  // Ajustar a zona horaria local del usuario
  // tzOffset es negativo para UTC-3 (UTC-3 = UTC menos 3 horas)
  // Para convertir de UTC a UTC-3, restamos 3 horas: getTime() + (-3) * 3600000
  const offsetMs = tzOffset * 3600000;
  from.setTime(from.getTime() + offsetMs);
  to.setTime(to.getTime() + offsetMs);
  
  if (period === "today") {
    from.setUTCHours(0, 0, 0, 0);
    to.setUTCHours(23, 59, 59, 999);
    return { from, to, days: 1 };
  }
  
  const days = period === "30d" ? 30 : 7;
  from.setUTCDate(from.getUTCDate() - days + 1);
  from.setUTCHours(0, 0, 0, 0);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to, days };
}

async function processAccount(
  acc: MeliAccount,
  from: Date,
  to: Date,
  days: number,
  deadline: number          // shared deadline across all accounts
) {
  const token = await getValidToken(acc);
  if (!token) return null;

  const uid     = String(acc.meli_user_id);
  
  // Convertir a fecha local usando getUTC methods en la fecha ajustada
  // from ya está ajustado a la zona horaria local via setTime()
  const year = from.getUTCFullYear();
  const month = String(from.getUTCMonth() + 1).padStart(2, '0');
  const date = String(from.getUTCDate()).padStart(2, '0');
  const fromStr = `${year}-${month}-${date}`;
  
  console.log(`[stats-acct] account=${acc.nickname}, fromStr=${fromStr}, from.UTC=${year}-${month}-${date}`);

  // ── Fetch orders ──────────────────────────────────────────────────────────
  const allOrders: Record<string, unknown>[] = [];
  let offset = 0;
  const limit    = 50;
  const maxPages = days <= 1 ? 1 : days <= 7 ? 2 : 4;

  for (let page = 0; page < maxPages; page++) {
    const data = await meliGet(
      `/orders/search?seller=${uid}&order.status=paid&sort=date_desc&limit=${limit}&offset=${offset}`,
      token
    ) as { results?: Record<string, unknown>[]; paging?: { total?: number } } | null;
    const results = data?.results ?? [];
    allOrders.push(...results);
    if (results.length < limit) break;
    offset += limit;
  }

  // Filter by date range
  const orders = allOrders.filter(o => {
    const d = (o.date_created as string | undefined) ?? "";
    return d >= fromStr;
  });
  
  console.log(`[stats-acct] allOrders=${allOrders.length}, filtered=${orders.length}, firstOrder=${allOrders[0]?.date_created}, lastOrder=${allOrders[allOrders.length - 1]?.date_created}`);

  // ── Enrich orders with /shipments/{id} ───────────────────────────────────
  // orders/search does NOT return shipping.logistic_type — only shipping.id
  // We must call /shipments/{id} to get the real logistic_type, tags, mode, tracking_number
  type EnrichedShip = { lt: string; tags: string[]; mode: string; tn: string };
  const enrichMap = new Map<number, EnrichedShip>();

  const shipIds = orders
    .map(o => (o.shipping as Record<string, unknown> | undefined)?.id as number | undefined)
    .filter((id): id is number => !!id);

  // Batches of 10 parallel requests, 200ms between batches (proven pattern from meli-labels)
  for (let i = 0; i < shipIds.length; i += 10) {
    if (Date.now() > deadline) {
      console.warn(`[stats] deadline hit at batch ${i}/${shipIds.length}, stopping enrichment`);
      break;
    }
    const batch   = shipIds.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(sid => meliGetWithRetry(`/shipments/${sid}`, token, 1, 1000))
    );
    for (let j = 0; j < batch.length; j++) {
      const d = results[j] as Record<string, unknown> | null;
      if (!d) continue;
      enrichMap.set(batch[j], {
        lt:   ((d.logistic_type as string | undefined) ?? "").toLowerCase(),
        tags: (d.tags as string[] | undefined) ?? [],
        mode: ((d.mode as string | undefined) ?? "").toLowerCase(),
        tn:   String(d.tracking_number ?? d.tracking_id ?? "").toUpperCase(),
      });
    }
    if (i + 10 < shipIds.length) await new Promise(r => setTimeout(r, 200));
  }

  // ── Sales by day ──────────────────────────────────────────────────────────
  const salesMap = new Map<string, { orders: number; amount: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    salesMap.set(d.toISOString().slice(0, 10), { orders: 0, amount: 0 });
  }
  for (const o of orders) {
    const day = ((o.date_created as string) ?? "").slice(0, 10);
    if (salesMap.has(day)) {
      const cur = salesMap.get(day)!;
      cur.orders++;
      cur.amount += (o.total_amount as number | undefined) ?? 0;
    }
  }

  // ── Sales by logistic type — using enriched shipment data ─────────────────
  const salesByLogistic: Record<LogisticType, { qty: number; amount: number }> = {
    correo: { qty: 0, amount: 0 },
    flex:   { qty: 0, amount: 0 },
    turbo:  { qty: 0, amount: 0 },
    full:   { qty: 0, amount: 0 },
    other:  { qty: 0, amount: 0 },
  };

  for (const o of orders) {
    const sid      = (o.shipping as Record<string, unknown> | undefined)?.id as number | undefined;
    const enriched = sid ? enrichMap.get(sid) : undefined;
    const orderTags = (o.tags as string[] | undefined) ?? [];

    const type = enriched
      ? classifyLogistic(enriched.lt, [...enriched.tags, ...orderTags], enriched.mode, enriched.tn)
      : classifyLogistic("", orderTags); // fallback: order-level tags only (same as before)

    salesByLogistic[type].qty++;
    salesByLogistic[type].amount += (o.total_amount as number | undefined) ?? 0;
  }

  // ── Top products — dedup: seller_sku > item_id > title ───────────────────
  const productMap = new Map<string, { title: string; sku: string; qty: number; revenue: number }>();
  for (const o of orders) {
    const items = (o.order_items as Array<{
      item?: { id?: string; title?: string; seller_sku?: string };
      quantity?: number;
      unit_price?: number;
    }> | undefined) ?? [];
    for (const item of items) {
      const key =
        item.item?.seller_sku?.trim() ||
        item.item?.id ||
        item.item?.title?.toLowerCase().trim() ||
        "unknown";
      const existing = productMap.get(key) ?? {
        title:   item.item?.title ?? "Producto",
        sku:     item.item?.seller_sku ?? item.item?.id ?? "",
        qty:     0,
        revenue: 0,
      };
      existing.qty     += item.quantity ?? 1;
      existing.revenue += (item.unit_price ?? 0) * (item.quantity ?? 1);
      productMap.set(key, existing);
    }
  }

  // ── Reputation ────────────────────────────────────────────────────────────
  const userData     = await meliGet(`/users/${uid}`, token) as Record<string, unknown> | null;
  const rep          = userData?.seller_reputation as Record<string, unknown> | undefined;
  const metrics      = rep?.metrics as Record<string, unknown> | undefined;
  const transactions = rep?.transactions as Record<string, unknown> | undefined;
  const ratings      = transactions?.ratings as Record<string, unknown> | undefined;

  const reputation = rep ? {
    account: acc.nickname,
    meli_user_id: uid,
    level_id:           (rep.level_id as string | undefined) ?? "unknown",
    power_seller_status:(rep.power_seller_status as string | undefined) ?? null,
    claims_rate:        ((metrics?.claims as Record<string, unknown> | undefined)?.rate as number | undefined) ?? 0,
    cancellations_rate: ((metrics?.cancellations as Record<string, unknown> | undefined)?.rate as number | undefined) ?? 0,
    delayed_rate:       ((metrics?.delayed_handling_time as Record<string, unknown> | undefined)?.rate as number | undefined) ?? 0,
    transactions_total:     (transactions?.total as number | undefined) ?? 0,
    transactions_completed: (transactions?.completed as number | undefined) ?? 0,
    ratings_positive:   (ratings?.positive as number | undefined) ?? 0,
    ratings_negative:   (ratings?.negative as number | undefined) ?? 0,
  } : null;

  const totalAmount = orders.reduce((s, o) => s + ((o.total_amount as number | undefined) ?? 0), 0);

  return {
    account:       acc.nickname,
    meli_user_id:  uid,
    sales_by_day:  Array.from(salesMap.entries()).map(([date, v]) => ({ date, ...v })),
    sales_by_logistic: salesByLogistic,
    // shipping_breakdown: plain counts for backward compat (pie chart expects numbers, not {qty,amount})
    shipping_breakdown: Object.fromEntries(
      Object.entries(salesByLogistic).map(([k, v]) => [k, v.qty])
    ) as Record<LogisticType, number>,
    top_products: Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 10),
    reputation,
    totals: {
      total_orders: orders.length,
      total_amount: totalAmount,
      avg_ticket:   orders.length > 0 ? Math.round(totalAmount / orders.length) : 0,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period    = searchParams.get("period")     ?? "7d";
    const accountId = searchParams.get("account_id") ?? "all";
    const dateFrom  = searchParams.get("date_from");
    const dateTo    = searchParams.get("date_to");
    const tzOffset  = parseFloat(searchParams.get("tz_offset") ?? "0");

    const { from, to, days } = getPeriodDates(period, dateFrom, dateTo, tzOffset);
    
    // Debug logging
    console.log(`[meli-stats] period=${period}, tzOffset=${tzOffset}, from=${from.toISOString()}, to=${to.toISOString()}, days=${days}`);

    const allAccounts = await getActiveAccounts();
    if (!allAccounts.length)
      return NextResponse.json({ error: "No hay cuentas activas" }, { status: 400 });

    const accounts = accountId === "all"
      ? allAccounts
      : allAccounts.filter(a => String(a.meli_user_id) === accountId || a.nickname === accountId);

    if (!accounts.length)
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });

    // Shared deadline: 50s from now (leaves 10s safety margin before Vercel's 60s limit)
    const deadline = Date.now() + 50_000;

    const results = await Promise.all(
      accounts.map(acc => processAccount(acc, from, to, days, deadline))
    );
    const valid = results.filter(Boolean) as NonNullable<typeof results[0]>[];

    // ── Aggregate across accounts ─────────────────────────────────────────
    const salesByDayMap = new Map<string, { date: string; orders: number; amount: number }>();
    for (const acc of valid) {
      for (const day of acc.sales_by_day) {
        const cur = salesByDayMap.get(day.date) ?? { date: day.date, orders: 0, amount: 0 };
        cur.orders += day.orders;
        cur.amount += day.amount;
        salesByDayMap.set(day.date, cur);
      }
    }

    // Top products — dedup by same key across accounts
    const productAgg = new Map<string, { title: string; sku: string; qty: number; revenue: number }>();
    for (const acc of valid) {
      for (const p of acc.top_products) {
        const key = p.sku || p.title.toLowerCase().trim();
        const cur = productAgg.get(key) ?? { title: p.title, sku: p.sku, qty: 0, revenue: 0 };
        cur.qty     += p.qty;
        cur.revenue += p.revenue;
        productAgg.set(key, cur);
      }
    }

    // sales_by_logistic aggregated (qty + amount)
    const salesByLogisticAgg: Record<LogisticType, { qty: number; amount: number }> = {
      correo: { qty: 0, amount: 0 },
      flex:   { qty: 0, amount: 0 },
      turbo:  { qty: 0, amount: 0 },
      full:   { qty: 0, amount: 0 },
      other:  { qty: 0, amount: 0 },
    };
    for (const acc of valid) {
      for (const k of Object.keys(salesByLogisticAgg) as LogisticType[]) {
        salesByLogisticAgg[k].qty    += acc.sales_by_logistic[k].qty;
        salesByLogisticAgg[k].amount += acc.sales_by_logistic[k].amount;
      }
    }

    const totalOrders = valid.reduce((s, a) => s + a.totals.total_orders, 0);
    const totalAmount = valid.reduce((s, a) => s + a.totals.total_amount, 0);

    return NextResponse.json({
      period,
      account_id:     accountId,
      date_from:      `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, '0')}-${String(from.getUTCDate()).padStart(2, '0')}`,
      date_to:        `${to.getUTCFullYear()}-${String(to.getUTCMonth() + 1).padStart(2, '0')}-${String(to.getUTCDate()).padStart(2, '0')}`,
      accounts_count: valid.length,
      sales_by_day:   Array.from(salesByDayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      sales_by_logistic: salesByLogisticAgg,
      // shipping_breakdown: plain counts (pie chart expects numbers)
      shipping_breakdown: Object.fromEntries(
        Object.entries(salesByLogisticAgg).map(([k, v]) => [k, v.qty])
      ),
      top_products:   Array.from(productAgg.values()).sort((a, b) => b.qty - a.qty).slice(0, 10),
      reputation:     valid.map(a => a.reputation).filter(Boolean),
      totals: {
        total_orders: totalOrders,
        total_amount: totalAmount,
        avg_ticket:   totalOrders > 0 ? Math.round(totalAmount / totalOrders) : 0,
      },
      per_account: valid.map(a => ({
        account:       a.account,
        meli_user_id:  a.meli_user_id,
        total_orders:  a.totals.total_orders,
        total_amount:  a.totals.total_amount,
        sales_by_logistic: a.sales_by_logistic,
        sales_by_day:  a.sales_by_day,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
