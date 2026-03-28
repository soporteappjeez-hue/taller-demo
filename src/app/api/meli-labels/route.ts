import { NextResponse } from "next/server";
import { getSupabase, getActiveAccounts, getValidToken, meliGet, meliGetRaw, meliGetWithRetry } from "@/lib/meli";
import { PDFDocument } from "pdf-lib";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

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
  title: string;
  quantity: number;
  unit_price: number | null;
  seller_sku: string | null;
  status: string;
  status_label: string | null;
  substatus: string | null;
  urgency: UrgencyType;
  delivery_date: string | null;
  dispatch_date: string | null;
  thumbnail: string | null;
  item_id: string | null;
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
  }> | undefined) ?? [];
  const buyer = order.buyer as Record<string, unknown> | undefined;
  const firstItem = items[0];

  let deliveryDate: string | null = null;
  const shippingOpt    = ship.shipping_option as Record<string, unknown> | undefined;
  const deliveryLimit  = shippingOpt?.estimated_delivery_limit as Record<string, unknown> | undefined;
  if (deliveryLimit?.date) deliveryDate = deliveryLimit.date as string;

  const rawStatus = (ship.status as string | undefined) ?? "ready_to_ship";
  const type = isFullByTracking ? "full" : classifyType(logistic, allTags, undefined, mode);

  return {
    shipment_id:    sid,
    order_id:       (order.id as number | undefined) ?? null,
    order_date:     (order.date_created as string | undefined) ?? null,
    account:        String(acc.nickname),
    meli_user_id:   String(acc.meli_user_id),
    type,
    buyer:          `${(buyer?.first_name as string | undefined) ?? ""} ${(buyer?.last_name as string | undefined) ?? ""}`.trim(),
    buyer_nickname: (buyer?.nickname as string | undefined) ?? null,
    title:          firstItem?.item?.title ?? "Producto",
    quantity:       firstItem?.quantity ?? 1,
    unit_price:     firstItem?.unit_price ?? null,
    seller_sku:     firstItem?.item?.seller_sku ?? null,
    status:         rawStatus,
    status_label:   statusLabel(rawStatus, type),
    substatus:      (ship.substatus as string | undefined) ?? null,
    urgency:        classifyUrgency(deliveryDate),
    delivery_date:  deliveryDate,
    dispatch_date:  null,
    thumbnail:      null,
    item_id:        firstItem?.item?.id ?? null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "list";
  const format = searchParams.get("format") ?? "pdf";
  const supabase = getSupabase();

  // ── Historial de impresas ──────────────────────────────────────────────────
  if (action === "history") {
    const period = searchParams.get("period") ?? "today";
    let query = supabase
      .from("meli_printed_labels")
      .select("*")
      .order("printed_at", { ascending: false })
      .limit(200);

    if (period === "today") {
      const s = new Date(); s.setHours(0, 0, 0, 0);
      query = query.gte("printed_at", s.toISOString()) as typeof query;
    } else if (period === "yesterday") {
      const s = new Date(); s.setDate(s.getDate() - 1); s.setHours(0, 0, 0, 0);
      const e = new Date(); e.setHours(0, 0, 0, 0);
      query = query.gte("printed_at", s.toISOString()).lt("printed_at", e.toISOString()) as typeof query;
    } else if (period === "week") {
      const s = new Date(); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0);
      query = query.gte("printed_at", s.toISOString()) as typeof query;
    }

    const { data } = await query;
    return NextResponse.json({ shipments: data ?? [] });
  }

  try {
    const accounts = await getActiveAccounts();
    if (!accounts.length) return NextResponse.json({ shipments: [], full: [], delayed_unshipped: [], delayed_in_transit: [], summary: {} });

    const { data: printed } = await supabase.from("meli_printed_labels").select("shipment_id");
    const printedSet = new Set((printed ?? []).map((p: { shipment_id: number }) => p.shipment_id));

    const allShipments:        ShipmentInfo[] = [];
    const allInTransit:        ShipmentInfo[] = [];
    const tokenCache = new Map<string, string>();

    await Promise.all(accounts.map(async (acc) => {
      try {
        const token = await getValidToken(acc);
        if (!token) return;
        tokenCache.set(String(acc.meli_user_id), token);

        const [dataReady, dataHandling, dataShipped] = await Promise.all([
          meliGet(`/orders/search?seller=${acc.meli_user_id}&order.status=paid&sort=date_desc&limit=50&shipping.status=ready_to_ship`, token),
          meliGet(`/orders/search?seller=${acc.meli_user_id}&order.status=paid&sort=date_desc&limit=50&shipping.status=handling`, token),
          meliGet(`/orders/search?seller=${acc.meli_user_id}&order.status=paid&sort=date_desc&limit=50&shipping.status=shipped`, token),
        ]);

        const readyResults    = ((dataReady?.results    ?? []) as Array<Record<string, unknown>>);
        const handlingResults = ((dataHandling?.results ?? []) as Array<Record<string, unknown>>);
        const shippedResults  = ((dataShipped?.results  ?? []) as Array<Record<string, unknown>>);

        const pendingOrders = [...readyResults, ...handlingResults];
        const seenPending   = new Set<number>();

        for (const order of pendingOrders) {
          const ship = order.shipping as Record<string, unknown> | undefined;
          if (!ship?.id) continue;
          const sid = ship.id as number;
          if (seenPending.has(sid) || printedSet.has(sid)) continue;
          seenPending.add(sid);

          const info = parseOrder(order, acc);
          if (info) allShipments.push(info);
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
          if (info) allInTransit.push(info);
        }

      } catch { /* skip account */ }
    }));

    // ── Enrichment con /shipments/{id} ─────────────────────────────────────
    const allToEnrich = [...allShipments, ...allInTransit];
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

              s.substatus = substatus || null;

              // Tipo definitivo — cualquier señal de Full es suficiente
              if (
                trackingNumber.startsWith("INVE") ||
                lt === "fulfillment" || lt.includes("fulfillment") ||
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

              // Auto-sync: si MeLi ya marcó impresa
              if (substatus === "printed" || substatus === "label_printed") {
                try {
                  const { createClient } = await import("@supabase/supabase-js");
                  const sb = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                  );
                  await sb.from("meli_printed_labels").upsert(
                    { shipment_id: s.shipment_id, printed_at: new Date().toISOString(), account: s.account, type: s.type, buyer: s.buyer, title: s.title, thumbnail: s.thumbnail },
                    { onConflict: "shipment_id" }
                  );
                } catch { /* ignore */ }
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

              const dispatchLimit =
                (detail.shipping_option as Record<string, unknown> | undefined)?.estimated_handling_limit ??
                detail.estimated_handling_limit;
              if (dispatchLimit && typeof dispatchLimit === "object") {
                s.dispatch_date = ((dispatchLimit as Record<string, unknown>).date ?? null) as string | null;
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
                  const img = e.body.secure_thumbnail || e.body.thumbnail;
                  if (img) thumbnailMap.set(e.body.id, img);
                }
              }
            }
          } catch { /* skip */ }
          if (i + 20 < itemIds.length) await new Promise(r => setTimeout(r, 150));
        }
      })
    );
    for (const s of allToEnrich) {
      if (s.item_id && thumbnailMap.has(s.item_id)) s.thumbnail = thumbnailMap.get(s.item_id)!;
    }

    // ── Separación final ──────────────────────────────────────────────────────
    const urgencyOrder: Record<UrgencyType, number>   = { delayed: 0, today: 1, tomorrow: 2, week: 3, upcoming: 4 };
    const typeOrder:    Record<LogisticType, number>   = { correo: 0, turbo: 1, flex: 2, full: 3 };
    allShipments.sort((a, b) => {
      const ud = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      return ud !== 0 ? ud : typeOrder[a.type] - typeOrder[b.type];
    });

    // Pending = no full, no impresos
    const pending   = allShipments.filter(s => s.type !== "full");
    const fullItems = allShipments.filter(s => s.type === "full");

    // Demorados sin despachar: pending con dispatch_date pasada o urgency delayed
    const delayed_unshipped = pending.filter(s =>
      isDatePast(s.dispatch_date) || s.urgency === "delayed"
    );

    // In-transit: todos los despachados no-full
    const in_transit = allInTransit.filter(s => s.type !== "full");

    // Demorados en tránsito: ya despachados, delivery_date pasada
    const delayed_in_transit = in_transit.filter(s => isDatePast(s.delivery_date));

    if (action === "list") {
      return NextResponse.json({
        shipments:          pending,
        full:               fullItems,
        in_transit,
        delayed_unshipped,
        delayed_in_transit,
        summary: {
          correo:             pending.filter(s => s.type === "correo").length,
          flex:               pending.filter(s => s.type === "flex").length,
          turbo:              pending.filter(s => s.type === "turbo").length,
          full:               fullItems.length,
          in_transit:         in_transit.length,
          delayed_unshipped:  delayed_unshipped.length,
          delayed_in_transit: delayed_in_transit.length,
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
          // Simple ZIP extraction: find the file data between headers
          // Local file header: PK\x03\x04 (30 bytes + filename + extra)
          const fnLen = bytes[26] | (bytes[27] << 8);
          const exLen = bytes[28] | (bytes[29] << 8);
          const compMethod = bytes[8] | (bytes[9] << 8);
          const compSize = bytes[18] | (bytes[19] << 8) | (bytes[20] << 16) | (bytes[21] << 24);
          const dataStart = 30 + fnLen + exLen;

          if (compMethod === 0) {
            // Stored (no compression)
            const raw = bytes.slice(dataStart, dataStart + compSize);
            zplTexts.push(new TextDecoder().decode(raw));
          } else if (compMethod === 8) {
            // Deflated — use Node.js zlib
            const { inflateRawSync } = require("zlib");
            const compressed = bytes.slice(dataStart, dataStart + compSize);
            const decompressed = inflateRawSync(Buffer.from(compressed));
            zplTexts.push(decompressed.toString("utf8"));
          } else {
            // Unknown compression — send raw bytes as-is
            zplTexts.push(new TextDecoder().decode(bytes));
          }
        } else {
          // Not a ZIP — already plain text ZPL
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

    // PDF Merge — unificar todos los chunks en un solo documento
    const mergedPdf = await PDFDocument.create();
    for (const chunk of pdfChunks) {
      try {
        const src = await PDFDocument.load(chunk, { ignoreEncryption: true });
        const pages = await mergedPdf.copyPages(src, src.getPageIndices());
        for (const page of pages) mergedPdf.addPage(page);
      } catch {
        // Si un chunk es inválido, lo saltamos sin romper el resto
        console.warn("[etiquetas] Chunk de PDF inválido, saltando...");
      }
    }

    const mergedBytes = await mergedPdf.save();
    const mergedBuffer = Buffer.from(mergedBytes);

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(mergedBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Etiquetas_MaqJeez_${today}.pdf"`,
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
    const { shipment_ids, shipments } = await req.json() as {
      shipment_ids: number[];
      shipments?: Array<{ shipment_id: number; account?: string; type?: string; buyer?: string; title?: string; thumbnail?: string }>;
    };
    if (!shipment_ids?.length) {
      return NextResponse.json({ error: "No shipment_ids" }, { status: 400 });
    }
    const supabase = getSupabase();
    const rows = shipment_ids.map(id => {
      const detail = shipments?.find(s => s.shipment_id === id);
      return {
        shipment_id: id,
        account:     detail?.account ?? null,
        type:        detail?.type ?? null,
        buyer:       detail?.buyer ?? null,
        title:       detail?.title ?? null,
        thumbnail:   detail?.thumbnail ?? null,
        printed_at:  new Date().toISOString(),
      };
    });
    await supabase.from("meli_printed_labels").upsert(rows, { onConflict: "shipment_id" });
    return NextResponse.json({ ok: true, marked: shipment_ids.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
