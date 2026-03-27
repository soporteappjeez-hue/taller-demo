import { NextResponse } from "next/server";
import { getSupabase, getActiveAccounts, getValidToken, meliGet, meliGetRaw } from "@/lib/meli";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

type UrgencyType = "delayed" | "today" | "upcoming";
type LogisticType = "flex" | "turbo" | "correo" | "full";

interface ShipmentInfo {
  shipment_id: number;
  order_id: number | null;
  order_date: string | null;
  account: string;
  meli_user_id: string;
  type: LogisticType;
  buyer: string;
  buyer_nickname: string | null;
  title: string;
  quantity: number;
  unit_price: number | null;
  seller_sku: string | null;
  status: string;
  status_label: string | null;
  urgency: UrgencyType;
  delivery_date: string | null;
  dispatch_date: string | null;
  thumbnail: string | null;
  item_id: string | null;
}

function classifyUrgency(deliveryDate: string | null): UrgencyType {
  if (!deliveryDate) return "upcoming";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delivery = new Date(deliveryDate);
  delivery.setHours(0, 0, 0, 0);
  if (delivery.getTime() < today.getTime()) return "delayed";
  if (delivery.getTime() === today.getTime()) return "today";
  return "upcoming";
}

function statusLabel(status: string, type: LogisticType): string {
  const map: Record<string, string> = {
    ready_to_ship: type === "full" ? "Procesando en la bodega" : "Listo para despachar",
    handling:      type === "full" ? "Procesando en la bodega" : "Preparando envío",
    shipped:       "En camino",
    delivered:     "Entregado",
    not_delivered: "No entregado",
    cancelled:     "Cancelado",
  };
  return map[status] ?? status;
}

function classifyType(logisticType: string, tags: string[]): LogisticType {
  const lt = (logisticType ?? "").toLowerCase();
  const tagStr = (tags ?? []).join(",").toLowerCase();
  // Full (fulfillment) — aislado
  if (lt === "fulfillment" || lt.includes("fulfillment")) return "full";
  // Turbo / same day
  if (
    tagStr.includes("turbo") ||
    tagStr.includes("same_day") ||
    tagStr.includes("express") ||
    lt === "turbo"
  ) return "turbo";
  // Flex
  if (lt === "self_service" || lt.includes("flex")) return "flex";
  return "correo";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "list";
  const format = searchParams.get("format") ?? "pdf";
  const supabase = getSupabase();

  // Historial con filtro opcional de período
  if (action === "history") {
    const period = searchParams.get("period") ?? "all"; // "today" | "week" | "all"
    let query = supabase
      .from("meli_printed_labels")
      .select("*")
      .order("printed_at", { ascending: false })
      .limit(200);

    if (period === "today") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      query = query.gte("printed_at", todayStart.toISOString()) as typeof query;
    } else if (period === "week") {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);
      query = query.gte("printed_at", weekStart.toISOString()) as typeof query;
    }

    const { data } = await query;
    return NextResponse.json({ shipments: data ?? [] });
  }

  try {
    const accounts = await getActiveAccounts();
    if (!accounts.length) return NextResponse.json({ shipments: [], summary: {} });

    const { data: printed } = await supabase.from("meli_printed_labels").select("shipment_id");
    const printedSet = new Set((printed ?? []).map((p: { shipment_id: number }) => p.shipment_id));

    const allShipments: ShipmentInfo[] = [];
    const tokenCache = new Map<string, string>();

    await Promise.all(accounts.map(async (acc) => {
      try {
        const token = await getValidToken(acc);
        if (!token) return;
        tokenCache.set(String(acc.meli_user_id), token);

        const [dataReady, dataHandling] = await Promise.all([
          meliGet(`/orders/search?seller=${acc.meli_user_id}&order.status=paid&sort=date_desc&limit=50&shipping.status=ready_to_ship`, token),
          meliGet(`/orders/search?seller=${acc.meli_user_id}&order.status=paid&sort=date_desc&limit=50&shipping.status=handling`, token),
        ]);

        const orders = [
          ...((dataReady?.results ?? []) as Array<Record<string, unknown>>),
          ...((dataHandling?.results ?? []) as Array<Record<string, unknown>>),
        ];
        const seen = new Set<number>();

        for (const order of orders) {
          const ship = order.shipping as Record<string, unknown> | undefined;
          if (!ship?.id) continue;
          const sid = ship.id as number;
          if (seen.has(sid) || printedSet.has(sid)) continue;
          seen.add(sid);

          const logistic = (ship.logistic_type as string | undefined) ?? "";
          const tags = (ship.tags as string[] | undefined) ?? [];

          const items = (order.order_items as Array<{
            item?: { id?: string; title?: string; seller_sku?: string };
            quantity?: number;
            unit_price?: number;
          }> | undefined) ?? [];
          const buyer = order.buyer as Record<string, unknown> | undefined;
          const firstItem = items[0];

          let deliveryDate: string | null = null;
          const shippingOpt = ship.shipping_option as Record<string, unknown> | undefined;
          const deliveryLimit = shippingOpt?.estimated_delivery_limit as Record<string, unknown> | undefined;
          if (deliveryLimit?.date) deliveryDate = deliveryLimit.date as string;

          const rawStatus = (ship.status as string | undefined) ?? "ready_to_ship";
          const type = classifyType(logistic, tags);

          allShipments.push({
            shipment_id: sid,
            order_id:     (order.id as number | undefined) ?? null,
            order_date:   (order.date_created as string | undefined) ?? null,
            account:      acc.nickname,
            meli_user_id: String(acc.meli_user_id),
            type,
            buyer:          `${(buyer?.first_name as string | undefined) ?? ""} ${(buyer?.last_name as string | undefined) ?? ""}`.trim(),
            buyer_nickname: (buyer?.nickname as string | undefined) ?? null,
            title:          firstItem?.item?.title ?? "Producto",
            quantity:       firstItem?.quantity ?? 1,
            unit_price:     firstItem?.unit_price ?? null,
            seller_sku:     firstItem?.item?.seller_sku ?? null,
            status:         rawStatus,
            status_label:   statusLabel(rawStatus, type),
            urgency:        classifyUrgency(deliveryDate),
            delivery_date:  deliveryDate,
            dispatch_date:  null,
            thumbnail:      null,
            item_id:        firstItem?.item?.id ?? null,
          });
        }
      } catch { /* skip account */ }
    }));

    // Enriquecer con detalle de shipment para tipo y fecha exactos
    const byAccountMap = new Map<string, { token: string; ids: number[] }>();
    for (const s of allShipments) {
      if (!byAccountMap.has(s.meli_user_id)) {
        const t = tokenCache.get(s.meli_user_id);
        if (!t) continue;
        byAccountMap.set(s.meli_user_id, { token: t, ids: [] });
      }
      byAccountMap.get(s.meli_user_id)!.ids.push(s.shipment_id);
    }

    await Promise.all(
      Array.from(byAccountMap.values()).map(async ({ token, ids }) => {
        await Promise.all(
          ids.map(async (sid) => {
            try {
              const detail = await meliGet(`/shipments/${sid}`, token) as Record<string, unknown> | null;
              if (!detail) return;
              const s = allShipments.find(x => x.shipment_id === sid);
              if (!s) return;

              // Tipo correcto desde el shipment (más preciso que la orden)
              const lt = (detail.logistic_type as string | undefined) ?? "";
              const tags = (detail.tags as string[] | undefined) ?? [];
              s.type = classifyType(lt, tags);

              // Actualizar status desde el shipment
              const shipStatus = (detail.status as string | undefined);
              if (shipStatus) {
                s.status = shipStatus;
                s.status_label = statusLabel(shipStatus, s.type);
              }

              // Fecha de entrega — probar múltiples campos que usa MeLi
              const tryDate = (obj: unknown): string | null => {
                if (!obj || typeof obj !== "object") return null;
                const o = obj as Record<string, unknown>;
                return (o.date ?? o.from ?? o.to) as string | null ?? null;
              };

              const deliveryDate =
                tryDate(detail.estimated_delivery_limit) ??
                tryDate((detail.shipping_option as Record<string, unknown> | undefined)?.estimated_delivery_limit) ??
                tryDate((detail.shipping_option as Record<string, unknown> | undefined)?.estimated_delivery_final) ??
                tryDate(detail.estimated_delivery_final) ??
                (detail.date_first_printed as string | undefined) ?? null;

              if (deliveryDate) {
                s.delivery_date = deliveryDate;
                s.urgency = classifyUrgency(deliveryDate);
              }

              // Fecha límite de despacho por parte del vendedor
              const dispatchLimit =
                (detail.shipping_option as Record<string, unknown> | undefined)?.estimated_handling_limit ??
                detail.estimated_handling_limit;
              if (dispatchLimit && typeof dispatchLimit === "object") {
                s.dispatch_date = ((dispatchLimit as Record<string, unknown>).date ?? null) as string | null;
              }
            } catch { /* skip */ }
          })
        );
      })
    );

    // Ordenar: urgencia primero (demorado > hoy > próximo), luego tipo
    const urgencyOrder: Record<UrgencyType, number> = { delayed: 0, today: 1, upcoming: 2 };
    const typeOrder: Record<LogisticType, number> = { correo: 0, turbo: 1, flex: 2, full: 3 };
    allShipments.sort((a, b) => {
      const ud = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      return ud !== 0 ? ud : typeOrder[a.type] - typeOrder[b.type];
    });

    // Batch fetch de thumbnails — agrupa item_ids por cuenta y usa el token correcto
    const thumbnailMap = new Map<string, string>();
    // Agrupar item_ids por meli_user_id para usar el token correcto de cada cuenta
    const itemsByAccount = new Map<string, { token: string; itemIds: string[] }>();
    for (const s of allShipments) {
      if (!s.item_id) continue;
      const userId = s.meli_user_id;
      const token = tokenCache.get(userId);
      if (!token) continue;
      if (!itemsByAccount.has(userId)) {
        itemsByAccount.set(userId, { token, itemIds: [] });
      }
      const entry = itemsByAccount.get(userId)!;
      if (!entry.itemIds.includes(s.item_id)) {
        entry.itemIds.push(s.item_id);
      }
    }
    // Fetch thumbnails por cuenta con su propio token
    await Promise.all(
      Array.from(itemsByAccount.values()).map(async ({ token, itemIds }) => {
        for (let i = 0; i < itemIds.length; i += 20) {
          const batch = itemIds.slice(i, i + 20);
          try {
            const res = await meliGet(
              `/items?ids=${batch.join(",")}&attributes=id,thumbnail,secure_thumbnail`,
              token
            ) as Array<{ code: number; body?: { id: string; thumbnail?: string; secure_thumbnail?: string } }> | null;
            if (Array.isArray(res)) {
              for (const entry of res) {
                if (entry.code === 200 && entry.body?.id) {
                  const img = entry.body.secure_thumbnail || entry.body.thumbnail;
                  if (img) thumbnailMap.set(entry.body.id, img);
                }
              }
            }
          } catch { /* skip thumbnails for this batch */ }
          if (i + 20 < itemIds.length) await new Promise(r => setTimeout(r, 150));
        }
      })
    );
    // Asignar thumbnails a los envíos
    for (const s of allShipments) {
      if (s.item_id && thumbnailMap.has(s.item_id)) {
        s.thumbnail = thumbnailMap.get(s.item_id)!;
      }
    }

    if (action === "list") {
      // Pendientes = no impresos, no full
      const pending = allShipments.filter(s => s.type !== "full");
      // Full separado
      const full    = allShipments.filter(s => s.type === "full");

      return NextResponse.json({
        shipments: pending,
        full,
        summary: {
          total:    pending.length,
          correo:   pending.filter(s => s.type === "correo").length,
          turbo:    pending.filter(s => s.type === "turbo").length,
          flex:     pending.filter(s => s.type === "flex").length,
          full:     full.length,
          delayed:  pending.filter(s => s.urgency === "delayed").length,
          today:    pending.filter(s => s.urgency === "today").length,
          upcoming: pending.filter(s => s.urgency === "upcoming").length,
        },
      });
    }

    // action === "download"
    const selectedIds = searchParams.get("ids");
    const targetShipments = selectedIds
      ? allShipments.filter(s => selectedIds.split(",").includes(String(s.shipment_id)))
      : allShipments.filter(s => s.type !== "full");

    if (!targetShipments.length) {
      return NextResponse.json({ error: "No hay envíos seleccionados" }, { status: 400 });
    }

    const byAccount = new Map<string, { token: string; ids: number[] }>();
    for (const s of targetShipments) {
      if (!byAccount.has(s.meli_user_id)) {
        const cachedToken = tokenCache.get(s.meli_user_id);
        if (!cachedToken) continue;
        byAccount.set(s.meli_user_id, { token: cachedToken, ids: [] });
      }
      byAccount.get(s.meli_user_id)!.ids.push(s.shipment_id);
    }

    const pdfChunks: ArrayBuffer[] = [];
    const response = format === "zpl" ? "zpl2" : "pdf";

    for (const accData of Array.from(byAccount.values())) {
      for (let i = 0; i < accData.ids.length; i += 50) {
        const batch = accData.ids.slice(i, i + 50);
        const idsParam = batch.join(",");
        const pdf = await meliGetRaw(
          `/shipment_labels?shipment_ids=${idsParam}&response_type=${response}&savePdf=Y`,
          accData.token
        );
        if (pdf && pdf.byteLength > 100) pdfChunks.push(pdf);
        if (accData.ids.length > 50) await new Promise(r => setTimeout(r, 200));
      }
    }

    if (!pdfChunks.length) {
      return NextResponse.json({ error: "No se pudieron descargar etiquetas" }, { status: 500 });
    }

    const biggest = pdfChunks.reduce((a, b) => a.byteLength > b.byteLength ? a : b);
    const contentType = format === "zpl" ? "application/octet-stream" : "application/pdf";
    const ext = format === "zpl" ? "zpl" : "pdf";

    return new NextResponse(biggest, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="etiquetas-appjeez.${ext}"`,
        "X-Total-Labels": String(targetShipments.length),
      },
    });

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { shipment_ids, shipments } = await req.json() as {
      shipment_ids: number[];
      shipments?: Array<{ shipment_id: number; account?: string; type?: string; buyer?: string; title?: string }>;
    };
    if (!shipment_ids?.length) {
      return NextResponse.json({ error: "No shipment_ids" }, { status: 400 });
    }
    const supabase = getSupabase();
    const rows = shipment_ids.map(id => {
      const detail = shipments?.find(s => s.shipment_id === id);
      return {
        shipment_id: id,
        account:    detail?.account ?? null,
        type:       detail?.type ?? null,
        buyer:      detail?.buyer ?? null,
        title:      detail?.title ?? null,
        printed_at: new Date().toISOString(),
      };
    });
    await supabase.from("meli_printed_labels").upsert(rows, { onConflict: "shipment_id" });
    return NextResponse.json({ ok: true, marked: shipment_ids.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
