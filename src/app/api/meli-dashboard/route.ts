import { NextResponse } from "next/server";
import { getActiveAccounts, getValidToken, meliGet, MeliAccount } from "@/lib/meli";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function processAccount(acc: MeliAccount) {
  try {
    const token = await getValidToken(acc);
    if (!token) {
      return {
        account: acc.nickname, meli_user_id: String(acc.meli_user_id),
        error: "token_expired", unanswered_questions: 0, pending_messages: 0,
        ready_to_ship: 0, total_items: 0, today_orders: 0, today_sales_amount: 0, 
        claims_count: 0, measurement_date: new Date().toISOString(), metrics_period: "Últimos 60 días",
        reputation: null,
      };
    }
    const uid = String(acc.meli_user_id);

    const [userData, ordersRes, shipments, itemsSearch, questions, disputes] = await Promise.all([
      meliGet(`/users/${uid}`, token),
      meliGet(`/orders/search?seller=${uid}&order.status=paid&sort=date_desc&limit=50`, token),
      meliGet(`/shipments/search?seller_id=${uid}&status=ready_to_ship&limit=1`, token),
      meliGet(`/users/${uid}/items/search?limit=1`, token),
      meliGet(`/questions/search?seller_id=${uid}&status=UNANSWERED&limit=1`, token),
      meliGet(`/orders/search?seller=${uid}&order.status=disputed&limit=1`, token),
    ]);

    const nowArg = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const todayArgStr = `${nowArg.getFullYear()}-${String(nowArg.getMonth()+1).padStart(2,"0")}-${String(nowArg.getDate()).padStart(2,"0")}`;
    const allOrders: { total_amount?: number; date_created?: string }[] = ordersRes?.results ?? [];
    const todayOrders = allOrders.filter(o => (o.date_created ?? "").startsWith(todayArgStr));
    const totalAmount = todayOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const rep = userData?.seller_reputation ?? null;

    return {
      account:              acc.nickname,
      meli_user_id:         uid,
      unanswered_questions: questions?.total ?? 0,
      pending_messages:     0,
      ready_to_ship:        shipments?.paging?.total ?? 0,
      total_items:          itemsSearch?.paging?.total ?? 0,
      today_orders:         todayOrders.length,
      today_sales_amount:   totalAmount,
      claims_count:         disputes?.paging?.total ?? 0,
      measurement_date:     new Date().toISOString(),
      metrics_period:       "Últimos 60 días",
      reputation: rep ? {
        level_id:               rep.level_id ?? null,
        power_seller_status:    rep.power_seller_status ?? null,
        transactions_total:     rep.transactions?.total ?? 0,
        transactions_completed: rep.transactions?.completed ?? 0,
        ratings_positive:       rep.transactions?.ratings?.positive ?? 0,
        ratings_negative:       rep.transactions?.ratings?.negative ?? 0,
        ratings_neutral:        rep.transactions?.ratings?.neutral ?? 0,
        delayed_handling_time:  rep.metrics?.delayed_handling_time?.rate ?? 0,
        claims:                 rep.metrics?.claims?.rate ?? 0,
        cancellations:          rep.metrics?.cancellations?.rate ?? 0,
        immediate_payment:      rep.immediate_payment ?? false,
      } : null,
    };
  } catch (err) {
    const errMsg = (err as Error).message;
    console.error(`[processAccount] Error para ${acc.nickname}:`, errMsg);
    
    if (errMsg.includes("HTTP_451_BLOCKED")) {
      return {
        account: acc.nickname, meli_user_id: String(acc.meli_user_id),
        error: "http_451_blocked", unanswered_questions: 0, pending_messages: 0,
        ready_to_ship: 0, total_items: 0, today_orders: 0, today_sales_amount: 0, 
        claims_count: 0, measurement_date: new Date().toISOString(), metrics_period: "Últimos 60 días",
        reputation: null,
      };
    }

    return {
      account: acc.nickname, meli_user_id: String(acc.meli_user_id),
      error: errMsg, unanswered_questions: 0, pending_messages: 0,
      ready_to_ship: 0, total_items: 0, today_orders: 0, today_sales_amount: 0, 
      claims_count: 0, measurement_date: new Date().toISOString(), metrics_period: "Últimos 60 días",
      reputation: null,
    };
  }
}

const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];

export async function GET() {
  try {
    console.log("[meli-dashboard] Consultando cuentas activas...");
    const accounts = await getActiveAccounts();
    console.log("[meli-dashboard] ✅ Cuentas encontradas:", accounts.length);
    if (accounts.length === 0) {
      console.warn("[meli-dashboard] ⚠️ getActiveAccounts() retornó vacío. Consultando tabla directamente...");
      // Fallback: intentar consultar directamente
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data, error } = await supabase
        .from("meli_accounts")
        .select("*")
        .eq("status", "active");
      if (error) {
        console.error("[meli-dashboard] Error en fallback query:", error);
        return NextResponse.json([]);
      }
      console.log("[meli-dashboard] Fallback encontró:", data?.length ?? 0, "cuentas");
      console.log("[meli-dashboard] Datos:", JSON.stringify(data, null, 2));
    }
    
    if (!accounts.length) return NextResponse.json([]);

    const results = await Promise.all(accounts.map(processAccount));
    const withRoman = results.map((r, i) => ({
      ...r,
      roman_index: ROMAN[i] ?? String(i + 1),
      display_name: `${ROMAN[i] ?? i + 1} — ${(r as { account: string }).account}`,
    }));

    return NextResponse.json(withRoman);
  } catch (e) {
    console.error("[meli-dashboard] ERROR:", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
