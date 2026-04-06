import { NextResponse } from "next/server";
import { getSupabase, getActiveAccounts, getValidToken, meliGet, meliGetRaw, meliGetWithRetry } from "@/lib/meli";
import { calculateZoneDistance, classifyFlexZone } from "@/lib/zone-calc";
import { PDFDocument } from "pdf-lib";
import { inflateRawSync } from "zlib";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;
export const runtime = "nodejs";

type UrgencyType = "delayed" | "today" | "tomorrow" | "week" | "upcoming";
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
  buyer_phone?: string | null;
  buyer_email?: string | null;
  title: string;
  quantity: number;
  unit_price: number | null;
  seller_sku: string | null;
  attributes?: string | null;  // Ej: "Color: Negro"
  status: string;
  status_label: string | null;
  substatus: string | null;
  urgency: UrgencyType;
  delivery_date: string | null;
  dispatch_date: string | null;
  delivery_address?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_zip?: string | null;
  buyer_notes?: string | null;
  total_price?: number | null;
  shipping_cost?: number | null;
  coupon_code?: string | null;
  thumbnail: string | null;
  item_id: string | null;
  purchase_url?: string | null;  // URL a la compra específica en MeLi
  printed_at?: string | null;  // NUEVO: timestamp de impresión
  is_printed?: boolean;        // NUEVO: derivado de printed_at
}

function isDatePast(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}

function nextBusinessDay(from: Date): Date {
  const d = new Date(from);
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

function classifyUrgency(deliveryDate: string | null): UrgencyType {
  if (!deliveryDate) return "upcoming";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d     = new Date(deliveryDate); d.setHours(0, 0, 0, 0);
  if (d.getTime() < today.getTime())  return "delayed";
  if (d.getTime() === today.getTime()) return "today";
  const nbd = nextBusinessDay(today); nbd.setHours(0, 0, 0, 0);
  if (d.getTime() === nbd.getTime()) return "tomorrow";
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff <= 7) return "week";
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

function classifyType(logisticType: string, tags: string[], substatus?: string, mode?: string): LogisticType {
  const lt     = (logisticType ?? "").toLowerCase();
  const tagStr = (tags ?? []).join(",").toLowerCase();
  const ss     = (substatus ?? "").toLowerCase();
  const md     = (mode ?? "").toLowerCase();

  if (
    lt === "fulfillment" || lt.includes("fulfillment") ||
    tagStr.includes("fulfillment") ||
    md === "fulfillment" || md.includes("fulfillment")
  ) return "full";

  if (
    tagStr.includes("turbo") || tagStr.includes("same_day") ||
    tagStr.includes("express") || ss.includes("turbo") || lt === "turbo"
  ) return "turbo";

  if (lt === "self_service" || lt.includes("flex") || tagStr.includes("flex")) return "flex";

  return "correo";
}

function parseOrder(
  order: Record<string, unknown>,
  acc: { nickname: string; meli_user_id: number | string }
): ShipmentInfo | null {
  const ship = order.shipping as Record<string, unknown> | undefined;
  if (!ship?.id) return null;
  const sid = ship.id as number;

  const logistic  = (ship.logistic_type as string | undefined) ?? "";
  const tags      = (ship.tags as string[] | undefined) ?? [];
  const mode      = (ship.mode as string | undefined) ?? "";
  const orderTags = (order.tags as string[] | undefined) ?? [];
  const allTags   = [...tags, ...orderTags];
  // Tracking prefix "INVE" = Full — disponible a veces en el objeto de orden también
  const trackingFromOrder = String((ship.tracking_number ?? ship.tracking_id ?? "") as string).toUpperCase();
  const isFullByTracking  = trackingFromOrder.startsWith("INVE");

  const items = (order.order_items as Array<{
    item?: { id?: string; title?: string; seller_sku?: string };
    quantity?: number;
    unit_price?: number;
    variation_attributes?: Array<{ name: string; value_name?: string }>;
  }> | undefined) ?? [];
  const buyer = order.buyer as Record<string, unknown> | undefined;
  const firstItem = items[0];

  let deliveryDate: string | null = null;
  const shippingOpt    = ship.shipping_option as Record<string, unknown> | undefined;
  const deliveryLimit  = shippingOpt?.estimated_delivery_limit as Record<string, unknown> | undefined;
  if (deliveryLimit?.date) deliveryDate = deliveryLimit.date as string;

  const rawStatus = (ship.status as string | undefined) ?? "ready_to_ship";
  const type = isFullByTracking ? "full" : classifyType(logistic, allTags, undefined, mode);

  // Extraer atributos del producto desde variation_attributes (Ej: "Color: Negro, Talle: M")
  const attributes = firstItem?.variation_attributes
    ?.filter(attr => attr.value_name?.trim())
    .map(attr => `${attr.name}: ${attr.value_name}`)
    .join(', ') || null;

  return {
    shipment_id:    sid,
    order_id:       (order.id as number | undefined) ?? null,
    order_date:     (order.date_created as string | undefined) ?? null,
    account:        String(acc.nickname),
    meli_user_id:   String(acc.meli_user_id),
    type,
    buyer:          `${(buyer?.first_name as string | undefined) ?? ""} ${(buyer?.last_name as string | undefined) ?? ""}`.trim(),
    buyer_nickname: (buyer?.nickname as string | undefined) ?? null,
    buyer_phone:    (buyer?.phone as string | undefined) ?? null,
    buyer_email:    (buyer?.email as string | undefined) ?? null,
    title:          firstItem?.item?.title ?? "Producto",
    quantity:       firstItem?.quantity ?? 1,
    unit_price:     firstItem?.unit_price ?? null,
    seller_sku:     firstItem?.item?.seller_sku ?? null,
    attributes:     attributes,
    status:         rawStatus,
    status_label:   statusLabel(rawStatus, type),
    substatus:      (ship.substatus as string | undefined) ?? null,
    urgency:        classifyUrgency(deliveryDate),
    delivery_date:  deliveryDate,
    dispatch_date:  null,
    delivery_address: (() => {
      const addr = (ship.receiver_address as any) ?? {};
      if (addr.street_name && addr.street_number) {
        return `${addr.street_name} ${addr.street_number}${addr.apartment ? `, ${addr.apartment}` : ""}`;
      }
      return null;
    })(),
    delivery_city: (() => {
      const addr = (ship.receiver_address as any) ?? {};
      // Priorizar municipality (partido) sobre city (puede ser barrio en CABA)
      return (addr.municipality?.name ?? addr.city?.name ?? addr.neighborhood?.name ?? null) as string | null;
    })(),
    delivery_state: (((ship.receiver_address as any)?.state?.name as string | undefined)) ?? null,
    delivery_zip:   (((ship.receiver_address as any)?.zip_code as string | undefined)) ?? null,
    buyer_notes:    (order.buyer_notes as string | undefined) ?? null,
    total_price:    (order.total_amount as number | undefined) ?? null,
    shipping_cost:  (order.shipping_amount as number | undefined) ?? null,
    coupon_code:    (((order.coupon as any)?.code as string | undefined)) ?? null,
    thumbnail:      null,
    item_id:        firstItem?.item?.id ?? null,
    purchase_url:   (order.id as number | undefined) ? `https://www.mercadolibre.com.ar/compras/${order.id}` : null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "list";
  const format = searchParams.get("format") ?? "pdf";
  const tzOffset = parseFloat(searchParams.get("tz_offset") ?? "0");
  const supabase = getSupabase();

  // Función helper para ajustar fechas a zona horaria local
  const adjustDateToZone = (offset: number): { today: Date; yesterday: Date; weekAgo: Date } => {
    const offsetMs = offset * 3600000;
    
    const today = new Date();
    today.setTime(today.getTime() + offsetMs);
    today.setUTCHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    
    const weekAgo = new Date(today);
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    
    return { today, yesterday, weekAgo };
  };

  // ── Historial de impresas ──────────────────────────────────────────────────
  if (action === "history") {
    const period = searchParams.get("period") ?? "today";
    let query = supabase
      .from("meli_printed_labels")
      .select("*")
      .order("printed_at", { ascending: false })
      .limit(200);

    const { today, yesterday, weekAgo } = adjustDateToZone(tzOffset);

    if (period === "today") {
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      query = query.gte("printed_at", today.toISOString()).lt("printed_at", tomorrow.toISOString()) as typeof query;
    } else if (period === "yesterday") {
      query = query.gte("printed_at", yesterday.toISOString()).lt("printed_at", today.toISOString()) as typeof query;
    } else if (period === "week") {
      query = query.gte("printed_at", weekAgo.toISOString()) as typeof query;
    }

    const { data } = await query;
    return NextResponse.json({ shipments: data ?? [] });
  }

  try {
    const accounts = await getActiveAccounts();
    if (!accounts.length) return NextResponse.json({ shipments: [], full: [], in_transit: [], returns: [], delayed_unshipped: [], delayed_in_transit: [], summary: {} });

    const { data: printed } = await supabase.from("meli_printed_labels").select("shipment_id, printed_at");
    const printedMap = new Map((printed ?? []).map((p: { shipment_id: number; printed_at: string }) => [p.shipment_id, p.printed_at]));
    const printedSet = new Set(printedMap.keys());

    const allShipments:        ShipmentInfo[] = [];
    const allInTransit:        ShipmentInfo[] = [];
    const allReturns:          ShipmentInfo[] = [];
    const tokenCache = new Map<string, string>();

    await Promise.all(accounts.map(async (acc) => {
      try {
        const token = await getValidToken(acc);
        if (!token) return;
        tokenCache.set(String(acc.meli_user_id), token);

        const [dataReady, dataHandling, dataShipped, dataNotDelivered] = await Promise.all([
          meliGet(`/orders/search?seller=${acc.meli_user_id}&order.status=paid&sort=date_desc&limit=50&shipping.status=ready_to_ship`, token),
          meliGet(`/orders/search?seller=${acc.meli_user_id}&order.status=paid&sort=date_desc&limit=50&shipping.status=handling`, token),
          meliGet(`/orders/search?seller=${acc.meli_user_id}&order.status=paid&sort=date_desc&limit=50&shipping.status=shipped`, token),
          meliGet(`/orders/search?seller=${acc.meli_user_id}&order.status=paid&sort=date_desc&limit=50&shipping.status=not_delivered`, token),
        ]);

        const readyResults        = ((dataReady?.results        ?? []) as Array<Record<string, unknown>>);
        const handlingResults     = ((dataHandling?.results     ?? []) as Array<Record<string, unknown>>);
        const shippedResults      = ((dataShipped?.results      ?? []) as Array<Record<string, unknown>>);
        const notDeliveredResults = ((dataNotDelivered?.results ?? []) as Array<Record<string, unknown>>);

        const pendingOrders = [...readyResults, ...handlingResults];
        const seenPending   = new Set<number>();

        for (const order of pendingOrders) {
          const ship = order.shipping as Record<string, unknown> | undefined;
          if (!ship?.id) continue;
          const sid = ship.id as number;
          if (seenPending.has(sid)) continue;
          seenPending.add(sid);

          const info = parseOrder(order, acc);
          if (info) {
            // Estampar printed_at si ya fue impresa
            if (printedMap.has(sid)) {
              info.printed_at = printedMap.get(sid)!;
            }
            info.status = "pending";
            allShipments.push(info);
          }
        }

        // Envíos ya despachados (para detectar demorados en tránsito)
        const seenShipped = new Set<number>();
        for (const order of shippedResults) {
          const ship = order.shipping as Record<string, unknown> | undefined;
          if (!ship?.id) continue;
          const sid = ship.id as number;
          if (seenShipped.has(sid)) continue;
          seenShipped.add(sid);
          const info = parseOrder(order, acc);
          if (info) {
            // Set explicit status: pending for in-transit items
            info.status = "pending";
            allInTransit.push(info);
          }
        }

        // Devoluciones (not_delivered - envios que no pudieron entregarse)
        const seenReturns = new Set<number>();
        for (const order of notDeliveredResults) {
          const ship = order.shipping as Record<string, unknown> | undefined;
          if (!ship?.id) continue;
          const sid = ship.id as number;
          if (seenReturns.has(sid)) continue;
          seenReturns.add(sid);
          const info = parseOrder(order, acc);
          if (info) {
            info.status = "not_delivered";
            allReturns.push(info);
          }
        }

      } catch { /* skip account */ }
    }));

    // ── Enrichment con /shipments/{id} ─────────────────────────────────────
    const allToEnrich = [...allShipments, ...allInTransit, ...allReturns];
    const byAccountMap = new Map<string, { token: string; ids: number[] }>();
    for (const s of allToEnrich) {
      if (!byAccountMap.has(s.meli_user_id)) {
        const t = tokenCache.get(s.meli_user_id);
        if (!t) continue;
        byAccountMap.set(s.meli_user_id, { token: t, ids: [] });
      }
      byAccountMap.get(s.meli_user_id)!.ids.push(s.shipment_id);
    }

    // Batched enrichment — 10 shipments at a time to reduce rate-limit pressure
    for (const { token, ids } of Array.from(byAccountMap.values())) {
      for (let batchStart = 0; batchStart < ids.length; batchStart += 10) {
        const batch = ids.slice(batchStart, batchStart + 10);
        await Promise.all(
          batch.map(async (sid) => {
            const s = allToEnrich.find(x => x.shipment_id === sid);
            if (!s) return;
            try {
              const detail = await meliGetWithRetry(`/shipments/${sid}`, token) as Record<string, unknown> | null;
              if (!detail) {
                console.warn(`[etiquetas] Enrichment falló para shipment ${sid} (tipo actual: ${s.type})`);
                return; // conserva el tipo que parseOrder asignó — NO se sobreescribe
              }

              const lt        = ((detail.logistic_type as string | undefined) ?? "").toLowerCase();
              const tags      = (detail.tags as string[] | undefined) ?? [];
              const substatus = (detail.substatus as string | undefined) ?? "";
              const mode      = ((detail.mode as string | undefined) ?? "").toLowerCase();
              const trackingNumber = String(
                (detail.tracking_number ?? detail.tracking_id ?? "") as string
              ).toUpperCase();
              const shippingOptLt = ((detail.shipping_option as Record<string, unknown>)?.logistic_type as string | undefined) ?? "";

              s.substatus = substatus || null;

              // Tipo definitivo — cualquier señal de Full es suficiente
              if (
                trackingNumber.startsWith("INVE") ||
                lt === "fulfillment" || lt.includes("fulfillment") ||
                shippingOptLt === "fulfillment" || shippingOptLt.includes("fulfillment") ||
                mode === "fulfillment" || mode.includes("fulfillment") ||
                tags.some((t: string) => t.toLowerCase().includes("fulfillment"))
              ) {
                s.type = "full";
              } else {
                s.type = classifyType(lt, tags, substatus, mode);
              }

              // Siempre recomputar status_label con el tipo final
              const shipStatus = (detail.status as string | undefined);
              if (shipStatus) s.status = shipStatus;
              s.status_label = statusLabel(s.status, s.type);

              // Auto-sync: si MeLi ya marcó impresa, guardar también en printed_labels (historial)
              if (substatus === "printed" || substatus === "label_printed") {
                // Estampar en memoria
                if (!s.printed_at) {
                  s.printed_at = new Date().toISOString();
                }
                
                try {
                  await supabase.from("meli_printed_labels").upsert(
                    { shipment_id: s.shipment_id, printed_at: s.printed_at, account: s.account, type: s.type, buyer: s.buyer, title: s.title, thumbnail: s.thumbnail },
                    { onConflict: "shipment_id" }
                  );

                  // Sync a printed_labels (historial): solo si no existe ya
                  const { data: existing } = await supabase
                    .from("printed_labels")
                    .select("id")
                    .eq("shipment_id", s.shipment_id)
                    .eq("meli_user_id", s.meli_user_id)
                    .maybeSingle();

                  if (!existing) {
                    // Intentar descargar el PDF de MeLi y guardarlo en Storage
                    let filePath = "";
                    try {
                      const token = tokenCache.get(String(s.meli_user_id));
                      if (token) {
                        const pdfBuffer = await meliGetRaw(
                          `/shipment_labels?shipment_ids=${s.shipment_id}&response_type=pdf`,
                          token
                        );
                        if (pdfBuffer) {
                          const today = new Date().toISOString().split("T")[0];
                          const storagePath = `etiquetas/${today}/sync-${s.shipment_id}.pdf`;
                          
                          const { error: uploadErr } = await supabase.storage
                            .from("meli-labels")
                            .upload(storagePath, new Uint8Array(pdfBuffer), {
                              contentType: "application/pdf",
                              upsert: true,
                            });
                          
                          if (!uploadErr) {
                            const { data: pubData } = supabase.storage
                              .from("meli-labels")
                              .getPublicUrl(storagePath);
                            filePath = pubData?.publicUrl || storagePath;
                          }
                        }
                      }
                    } catch { /* PDF download failed, still save record */ }

                    // Insertar en printed_labels (historial) aunque no tengamos el PDF
                    await supabase.from("printed_labels").upsert(
                      {
                        shipment_id: s.shipment_id,
                        order_id: s.order_id,
                        tracking_number: null,
                        buyer_nickname: s.buyer_nickname || s.buyer,
                        sku: s.seller_sku || null,
                        variation: s.attributes || null,
                        quantity: s.quantity || 1,
                        account_id: s.account,
                        meli_user_id: s.meli_user_id,
                        shipping_method: s.type,
                        file_path: filePath,
                        print_date: s.printed_at,
                      },
                      { onConflict: "shipment_id,meli_user_id" }
                    );
                  }
                } catch { /* ignore sync errors */ }
              }

              // Fechas
              const tryDate = (obj: unknown): string | null => {
                if (!obj || typeof obj !== "object") return null;
                const o = obj as Record<string, unknown>;
                return (o.date ?? o.from ?? o.to) as string | null ?? null;
              };

              const deliveryDate =
                tryDate(detail.estimated_delivery_limit) ??
                tryDate((detail.shipping_option as Record<string, unknown> | undefined)?.estimated_delivery_limit) ??
                tryDate((detail.shipping_option as Record<string, unknown> | undefined)?.estimated_delivery_final) ??
                tryDate(detail.estimated_delivery_final) ?? null;

              if (deliveryDate) {
                s.delivery_date = deliveryDate;
                s.urgency = classifyUrgency(deliveryDate);
              }

              // dispatch_date: intentar multiples campos (MeLi varía la estructura)
              const dispatchLimit =
                (detail.shipping_option as Record<string, unknown> | undefined)?.estimated_handling_limit ??
                detail.estimated_handling_limit ??
                (detail.shipping_option as Record<string, unknown> | undefined)?.estimated_schedule_limit ??
                detail.estimated_schedule_limit;
              s.dispatch_date = tryDate(dispatchLimit);

              // Ciudad y CP del destinatario (más confiable desde /shipments/{id})
              const recvAddr = detail.receiver_address as Record<string, unknown> | undefined;
              if (recvAddr) {
                const cityObj = recvAddr.city as Record<string, unknown> | undefined;
                const muniObj = recvAddr.municipality as Record<string, unknown> | undefined;
                const neighObj = recvAddr.neighborhood as Record<string, unknown> | undefined;
                const cityName = (muniObj?.name ?? cityObj?.name ?? neighObj?.name ?? null) as string | null;
                if (cityName) s.delivery_city = cityName;
                const zip = recvAddr.zip_code as string | undefined;
                if (zip) s.delivery_zip = zip;
              }
            } catch { /* skip */ }
          })
        );
        // Pausa entre batches para no saturar la API
        if (batchStart + 10 < ids.length) await new Promise(r => setTimeout(r, 200));
      }
    }

    // ── Thumbnails ────────────────────────────────────────────────────────────
    const thumbnailMap  = new Map<string, string>();
    const itemsByAccount = new Map<string, { token: string; itemIds: string[] }>();
    for (const s of allToEnrich) {
      if (!s.item_id) continue;
      const t = tokenCache.get(s.meli_user_id);
      if (!t) continue;
      if (!itemsByAccount.has(s.meli_user_id)) itemsByAccount.set(s.meli_user_id, { token: t, itemIds: [] });
      const entry = itemsByAccount.get(s.meli_user_id)!;
      if (!entry.itemIds.includes(s.item_id)) entry.itemIds.push(s.item_id);
    }
    await Promise.all(
      Array.from(itemsByAccount.values()).map(async ({ token, itemIds }) => {
        for (let i = 0; i < itemIds.length; i += 20) {
          const batch = itemIds.slice(i, i + 20);
          try {
            const res = await meliGet(`/items?ids=${batch.join(",")}&attributes=id,thumbnail,secure_thumbnail`, token) as
              Array<{ code: number; body?: { id: string; thumbnail?: string; secure_thumbnail?: string } }> | null;
            if (Array.isArray(res)) {
              for (const e of res) {
                if (e.code === 200 && e.body?.id) {
                  let img = e.body.secure_thumbnail || e.body.thumbnail;
                  if (img) {
                    // Fix duplicated protocol: http://http2.mlstatic.com → https://http2.mlstatic.com
                    img = img.replace(/^https?:\/\/https?:\/\//, "https://").replace(/^http:\/\//, "https://");
                    thumbnailMap.set(e.body.id, img);
                  }
                }
              }
            }
          } catch { /* skip */ }
          if (i + 20 < itemIds.length) await new Promise(r => setTimeout(r, 150));
        }
      })
    );
    
    // Aplicar thumbnails de items
    for (const s of allToEnrich) {
      if (s.item_id && thumbnailMap.has(s.item_id)) s.thumbnail = thumbnailMap.get(s.item_id)!;
    }

    // ── Fallback: Enriquecimiento desde order_items si thumbnail sigue vacío ─────
    const missingThumbnails = allToEnrich.filter(s => !s.thumbnail && s.order_id);
    const ordersByAccount = new Map<string, { token: string; orderIds: number[] }>();
    for (const s of missingThumbnails) {
      if (!ordersByAccount.has(s.meli_user_id)) {
        const t = tokenCache.get(s.meli_user_id);
        if (!t) continue;
        ordersByAccount.set(s.meli_user_id, { token: t, orderIds: [] });
      }
      const entry = ordersByAccount.get(s.meli_user_id)!;
      if (!entry.orderIds.includes(s.order_id!)) entry.orderIds.push(s.order_id!);
    }
    
    await Promise.all(
      Array.from(ordersByAccount.values()).map(async ({ token, orderIds }) => {
        for (let i = 0; i < orderIds.length; i += 10) {
          const batch = orderIds.slice(i, i + 10);
          await Promise.all(
            batch.map(async (orderId) => {
              try {
                const orderDetail = await meliGetWithRetry(`/orders/${orderId}`, token) as Record<string, unknown> | null;
                if (!orderDetail) return;
                
                const items = (orderDetail.order_items as Array<{ item?: { thumbnail?: string } }> | undefined) ?? [];
                const firstItem = items[0];
                let thumbnail = firstItem?.item?.thumbnail as string | undefined;
                
                if (thumbnail) {
                  // Ensure HTTPS
                  thumbnail = thumbnail.replace(/^https?:\/\/https?:\/\//, "https://").replace(/^http:\/\//, "https://");
                  
                  // Aplicar al shipment correspondiente
                  const shipment = missingThumbnails.find(s => s.order_id === orderId);
                  if (shipment) shipment.thumbnail = thumbnail;
                }
              } catch { /* skip */ }
            })
          );
          if (i + 10 < orderIds.length) await new Promise(r => setTimeout(r, 200));
        }
      })
    );

    // ── Separación final ──────────────────────────────────────────────────────
    const urgencyOrder: Record<UrgencyType, number>   = { delayed: 0, today: 1, tomorrow: 2, week: 3, upcoming: 4 };
    const typeOrder:    Record<LogisticType, number>   = { correo: 0, turbo: 1, flex: 2, full: 3 };
    allShipments.sort((a, b) => {
      const ud = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      return ud !== 0 ? ud : typeOrder[a.type] - typeOrder[b.type];
    });

    // Post-enrichment: marcar shipments impresos (substatus o already in meli_printed_labels)
    for (const s of allShipments) {
      const isSubstatusPrinted = s.substatus === "printed" || s.substatus === "label_printed";
      s.is_printed = isSubstatusPrinted || !!s.printed_at;
    }

    // Obtener fecha de hoy a las 00:00 para filtrar etiquetas impresas
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Pending = no full, no impresos
    const pending   = allShipments.filter(s => s.type !== "full" && !s.is_printed);
    // Printed = impresas HOY solo (hasta las 00:00 se limpian automáticamente)
    const printedShipments = allShipments.filter(s => {
      if (s.type === "full" || !s.is_printed) return false;
      // Solo incluir si fue impresa hoy
      if (!s.printed_at) return false;
      const printedDate = new Date(s.printed_at);
      return printedDate >= todayStart && printedDate <= todayEnd;
    });
    const fullItems = allShipments.filter(s => s.type === "full");

    // Demorados sin despachar: pending con dispatch_date pasada o urgency delayed
    const delayed_unshipped = pending.filter(s =>
      isDatePast(s.dispatch_date) || s.urgency === "delayed"
    );

    // In-transit: todos los despachados no-full
    const in_transit = allInTransit.filter(s => s.type !== "full");

    // Devoluciones: todas las not_delivered (no-full)
    const returns = allReturns.filter(s => s.type !== "full");

    // Demorados en tránsito: ya despachados, delivery_date pasada
    const delayed_in_transit = in_transit.filter(s => isDatePast(s.delivery_date));

    if (action === "list") {
      return NextResponse.json({
        shipments:          pending,
        printed:            printedShipments,
        full:               fullItems,
        in_transit,
        returns,
        delayed_unshipped,
        delayed_in_transit,
        summary: {
          correo:             pending.filter(s => s.type === "correo").length,
          flex:               pending.filter(s => s.type === "flex").length,
          turbo:              pending.filter(s => s.type === "turbo").length,
          full:               fullItems.length,
          in_transit:         in_transit.length,
          returns:            returns.length,
          delayed_unshipped:  delayed_unshipped.length,
          delayed_in_transit: delayed_in_transit.length,
          printed_total:      printedShipments.length,
          printed_correo:     printedShipments.filter(s => s.type === "correo").length,
          printed_flex:       printedShipments.filter(s => s.type === "flex").length,
          printed_turbo:      printedShipments.filter(s => s.type === "turbo").length,
        },
      });
    }

    // ── Download ───────────────────────────────────────────────────────────────
    const selectedIds = searchParams.get("ids");
    const targetShipments = selectedIds
      ? allShipments.filter(s => s.type !== "full" && selectedIds.split(",").includes(String(s.shipment_id)))
      : pending;

    if (!targetShipments.length) {
      return NextResponse.json({ error: "No hay envíos seleccionados" }, { status: 400 });
    }

    // Ordenar por tipo de logística: correo → turbo → flex
    const printOrder: Record<LogisticType, number> = { correo: 0, turbo: 1, flex: 2, full: 3 };
    targetShipments.sort((a, b) => printOrder[a.type] - printOrder[b.type]);

    const byAccount = new Map<string, { token: string; ids: number[] }>();
    for (const s of targetShipments) {
      if (!byAccount.has(s.meli_user_id)) {
        const t = tokenCache.get(s.meli_user_id);
        if (!t) continue;
        byAccount.set(s.meli_user_id, { token: t, ids: [] });
      }
      byAccount.get(s.meli_user_id)!.ids.push(s.shipment_id);
    }

    const pdfChunks: ArrayBuffer[] = [];
    const response = format === "zpl" ? "zpl2" : "pdf";

    for (const accData of Array.from(byAccount.values())) {
      for (let i = 0; i < accData.ids.length; i += 50) {
        const batch    = accData.ids.slice(i, i + 50);
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

    const contentType = format === "zpl" ? "application/octet-stream" : "application/pdf";
    const ext = format === "zpl" ? "zpl" : "pdf";

    // ZPL: concatenar texto; PDF: mergear con pdf-lib
    if (format === "zpl") {
      // MeLi returns a ZIP file for zpl2 — extract the text content
      const zplTexts: string[] = [];
      for (const chunk of pdfChunks) {
        const bytes = new Uint8Array(chunk);
        // Check if it's a ZIP file (starts with PK\x03\x04)
        if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
          // Find sizes from Central Directory (local header may have 0 for streamed ZIPs)
          let compSize = bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24);
          const compMethod = bytes[8] | (bytes[9] << 8);
          const fnLen = bytes[26] | (bytes[27] << 8);
          const exLen = bytes[28] | (bytes[29] << 8);
          const dataStart = 30 + fnLen + exLen;

          // If compSize is 0, read from Central Directory entry (PK\x01\x02)
          if (compSize === 0) {
            for (let i = 0; i < bytes.length - 4; i++) {
              if (bytes[i] === 0x50 && bytes[i+1] === 0x4B && bytes[i+2] === 0x01 && bytes[i+3] === 0x02) {
                compSize = bytes[i+20] | (bytes[i+21] << 8) | (bytes[i+22] << 16) | (bytes[i+23] << 24);
                break;
              }
            }
          }
          // If still 0, estimate: data between local header and central directory
          if (compSize === 0) {
            for (let i = dataStart; i < bytes.length - 4; i++) {
              if (bytes[i] === 0x50 && bytes[i+1] === 0x4B && (bytes[i+2] === 0x01 || bytes[i+2] === 0x07)) {
                compSize = i - dataStart;
                // If data descriptor (PK\x07\x08), skip 4 bytes back
                if (bytes[i+2] === 0x07) compSize = i - dataStart;
                break;
              }
            }
          }

          if (compMethod === 0 && compSize > 0) {
            const raw = bytes.slice(dataStart, dataStart + compSize);
            zplTexts.push(new TextDecoder().decode(raw));
          } else if (compMethod === 8 && compSize > 0) {
            try {
              const compressed = bytes.slice(dataStart, dataStart + compSize);
              const decompressed = inflateRawSync(Buffer.from(compressed));
              zplTexts.push(decompressed.toString("utf8"));
            } catch {
              zplTexts.push(new TextDecoder().decode(bytes));
            }
          } else {
            zplTexts.push(new TextDecoder().decode(bytes));
          }
        } else {
          zplTexts.push(new TextDecoder().decode(bytes));
        }
      }

      const mergedText = zplTexts.join("\n");
      return new NextResponse(mergedText, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="etiquetas-appjeez.${ext}"`,
          "X-Total-Labels": String(targetShipments.length),
        },
      });
    }

    // PDF Merge — 3 etiquetas 10x15 cm en horizontal por hoja A4 (landscape)
    // A4 landscape: 842 x 595 puntos (297mm x 210mm)
    // Cada etiqueta 10x15 cm = 283 x 425 puntos aprox
    // 3 etiquetas horizontales: 3 x 283 = 849 puntos (ajuste mínimo)
    const A4_W = 841.89;  // A4 landscape ancho
    const A4_H = 595.28;  // A4 landscape alto
    const LABEL_W = 283.46; // 10 cm en puntos
    const LABEL_H = 425.20; // 15 cm en puntos (altura máxima disponible)
    const LABELS_PER_ROW = 3;
    const GAP = 10; // gap entre etiquetas en puntos

    // Cargar todos los chunks y recopilar páginas fuente
    const srcDocs: PDFDocument[] = [];
    const allLabelPages: { doc: PDFDocument; idx: number }[] = [];
    for (const chunk of pdfChunks) {
      try {
        const src = await PDFDocument.load(chunk, { ignoreEncryption: true });
        srcDocs.push(src);
        for (const idx of src.getPageIndices()) {
          allLabelPages.push({ doc: src, idx });
        }
      } catch {
        console.warn("[etiquetas] Chunk de PDF inválido, saltando...");
      }
    }

    if (allLabelPages.length === 0) {
      return NextResponse.json({ error: "No se pudo generar el PDF: las etiquetas no están disponibles o MeLi no las devolvió correctamente." }, { status: 502 });
    }

    const mergedPdf = await PDFDocument.create();

    // Calcular escala para que quepan 3 etiquetas de 10cm en el ancho A4
    const availableWidth = A4_W - (GAP * (LABELS_PER_ROW - 1));
    const scale = Math.min(1, availableWidth / (LABEL_W * LABELS_PER_ROW), A4_H / LABEL_H);
    const drawW = LABEL_W * scale;
    const drawH = LABEL_H * scale;
    const startX = (A4_W - (drawW * LABELS_PER_ROW + GAP * (LABELS_PER_ROW - 1))) / 2;
    const startY = (A4_H - drawH) / 2; // Centrar verticalmente

    // Componer páginas A4 landscape con 3 etiquetas horizontales cada una
    for (let i = 0; i < allLabelPages.length; i += LABELS_PER_ROW) {
      const group = allLabelPages.slice(i, i + LABELS_PER_ROW);
      const a4Page = mergedPdf.addPage([A4_W, A4_H]); // Landscape

      for (let j = 0; j < group.length; j++) {
        const { doc, idx } = group[j];
        const srcPage = doc.getPage(idx);

        // Posición horizontal: de izquierda a derecha
        const x = startX + j * (drawW + GAP);
        const y = startY;

        const embedded = await mergedPdf.embedPage(srcPage);
        a4Page.drawPage(embedded, { x, y, width: drawW, height: drawH });
      }
    }

    if (mergedPdf.getPageCount() === 0) {
      return NextResponse.json({ error: "No se pudo generar el PDF: las etiquetas no están disponibles o MeLi no las devolvió correctamente." }, { status: 502 });
    }

    const mergedBytes = await mergedPdf.save();
    const mergedBuffer = Buffer.from(mergedBytes);

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(mergedBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Etiquetas_AppJeez_${today}.pdf"`,
        "X-Total-Labels": String(targetShipments.length),
        "X-Total-Pages": String(mergedPdf.getPageCount()),
      },
    });

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { shipment_ids, shipments, action } = await req.json() as {
      shipment_ids?: number[];
      shipments?: Array<{
        shipment_id: number;
        account?: string;
        type?: string;
        buyer?: string;
        title?: string;
        thumbnail?: string;
        delivery_date?: string;
        delivery_city?: string;
        delivery_zip?: string;
        buyer_nickname?: string;
      }>;
      action?: string;
    };

    // Manejar acción "mark-printed" (nuevo batch endpoint)
    const ids = shipment_ids ?? [];
    if (!ids?.length) {
      return NextResponse.json({ error: "No shipment_ids" }, { status: 400 });
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();

    // Preparar filas para etiquetas_history
    const historyRows = ids.map(id => {
      const detail = shipments?.find(s => s.shipment_id === id);
      const zone = detail?.type === "flex"
        ? classifyFlexZone(detail?.delivery_city, detail?.delivery_zip)
        : calculateZoneDistance(detail?.delivery_date);

      return {
        shipment_id: id,
        account_id: detail?.account ?? null,
        shipping_type: detail?.type ?? null,
        status: "printed",
        buyer_name: detail?.buyer ?? null,
        buyer_nickname: detail?.buyer_nickname ?? null,
        product_title: detail?.title ?? null,
        product_image_url: detail?.thumbnail ?? null,
        zone_distance: zone,
        printed_at: now,
        label_url: null,
        created_at: now,
        updated_at: now,
      };
    });

    // Insertar en etiquetas_history (tabla nueva)
    const { error: historyError } = await supabase
      .from("etiquetas_history")
      .upsert(historyRows, { onConflict: "shipment_id" });

    if (historyError) {
      console.error("[meli-labels POST] etiquetas_history error:", historyError);
      return NextResponse.json({ error: historyError.message }, { status: 500 });
    }

    // Solo guardar en printed_labels (meli_printed_labels es legacy y tiene problemas de tipo)
    console.log(`[meli-labels POST] Marked ${ids.length} shipments as printed`);

    return NextResponse.json({ ok: true, marked: ids.length });
  } catch (e) {
    console.error("[meli-labels POST] Error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// ── PATCH: Cambiar estado de etiqueta ──────────────────────────────────────
export async function PATCH(req: Request) {
  try {
    const { shipment_id, status } = await req.json() as {
      shipment_id: number;
      status: 'pending' | 'printed' | 'cancelled';
    };

    if (!shipment_id || !status) {
      return NextResponse.json({ error: "Missing shipment_id or status" }, { status: 400 });
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();

    // Actualizar en etiquetas_history
    const updateData: any = { 
      status,
      updated_at: now,
    };

    // Si status es 'printed', setear printed_at
    if (status === 'printed') {
      updateData.printed_at = now;
    }
    // Si status es 'pending', limpiar printed_at
    else if (status === 'pending') {
      updateData.printed_at = null;
    }

    const { error } = await supabase
      .from("etiquetas_history")
      .update(updateData)
      .eq("shipment_id", shipment_id);

    if (error) {
      console.error("[meli-labels PATCH] Error updating:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[meli-labels PATCH] Updated shipment ${shipment_id} to status=${status}`);

    return NextResponse.json({ ok: true, updated_at: now });
  } catch (e) {
    console.error("[meli-labels PATCH] Error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
