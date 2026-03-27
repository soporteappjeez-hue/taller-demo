import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const SUPA_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENC_KEY     = process.env.APPJEEZ_MELI_ENCRYPTION_KEY!;

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const km  = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("appjeez-meli-salt"), iterations: 100000, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
  );
}
async function decrypt(enc64: string, pass: string): Promise<string> {
  const key      = await deriveKey(pass);
  const combined = Uint8Array.from(atob(enc64), c => c.charCodeAt(0));
  const plain    = await crypto.subtle.decrypt({ name: "AES-GCM", iv: combined.slice(0, 12) }, key, combined.slice(12));
  return new TextDecoder().decode(plain);
}

async function meliGet(path: string, token: string) {
  try {
    const res = await fetch(`https://api.mercadolibre.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function meliGetRaw(path: string, token: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`https://api.mercadolibre.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch { return null; }
}

interface ShipmentInfo {
  shipment_id: number;
  account: string;
  meli_user_id: string;
  type: "flex" | "turbo" | "correo";
  buyer: string;
  title: string;
  status: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "list";
  const format = searchParams.get("format") ?? "pdf";

  try {
    const supabase = createClient(SUPA_URL, SERVICE_KEY);
    const { data: accounts } = await supabase
      .from("meli_accounts")
      .select("id, meli_user_id, nickname, access_token_enc")
      .eq("status", "active")
      .order("nickname", { ascending: true });

    if (!accounts?.length) return NextResponse.json({ shipments: [], summary: {} });

    // Obtener etiquetas ya impresas para filtrarlas
    const { data: printed } = await supabase.from("meli_printed_labels").select("shipment_id");
    const printedSet = new Set((printed ?? []).map((p: { shipment_id: number }) => p.shipment_id));

    const allShipments: ShipmentInfo[] = [];

    await Promise.all(accounts.map(async (acc) => {
      try {
        const token = await decrypt(acc.access_token_enc, ENC_KEY);

        const data = await meliGet(
          `/orders/search?seller=${acc.meli_user_id}&order.status=paid&sort=date_desc&limit=50&shipping.status=ready_to_ship`,
          token
        );
        const dataHandling = await meliGet(
          `/orders/search?seller=${acc.meli_user_id}&order.status=paid&sort=date_desc&limit=50&shipping.status=handling`,
          token
        );
        const orders = [
          ...((data?.results ?? []) as Array<Record<string, unknown>>),
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
          let type: "flex" | "turbo" | "correo" = "correo";
          if (logistic === "self_service" || logistic.includes("flex")) type = "flex";
          else if (logistic.includes("fulfillment")) type = "turbo";

          const items = (order.order_items as Array<{ item?: { title?: string } }> | undefined) ?? [];
          const buyer = order.buyer as Record<string, unknown> | undefined;

          allShipments.push({
            shipment_id: ship.id as number,
            account:     acc.nickname,
            meli_user_id: String(acc.meli_user_id),
            type,
            buyer: `${(buyer?.first_name as string | undefined) ?? ""} ${(buyer?.last_name as string | undefined) ?? ""}`.trim(),
            title: items[0]?.item?.title ?? "Producto",
            status: (ship.status as string | undefined) ?? "ready_to_ship",
          });
        }
      } catch { /* skip account on error */ }
    }));

    // Ordenar: correo primero, luego turbo, luego flex
    const typeOrder = { correo: 0, turbo: 1, flex: 2 };
    allShipments.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

    if (action === "list") {
      const correo = allShipments.filter(s => s.type === "correo").length;
      const turbo  = allShipments.filter(s => s.type === "turbo").length;
      const flex   = allShipments.filter(s => s.type === "flex").length;

      return NextResponse.json({
        shipments: allShipments,
        summary: { total: allShipments.length, correo, turbo, flex },
      });
    }

    // action === "download" — Descargar etiquetas
    if (!allShipments.length) {
      return NextResponse.json({ error: "No hay envíos pendientes" }, { status: 404 });
    }

    // Seleccionar IDs específicos o todos
    const selectedIds = searchParams.get("ids");
    const targetShipments = selectedIds
      ? allShipments.filter(s => selectedIds.split(",").includes(String(s.shipment_id)))
      : allShipments;

    if (!targetShipments.length) {
      return NextResponse.json({ error: "No hay envíos seleccionados" }, { status: 400 });
    }

    // Agrupar por cuenta (cada cuenta necesita su propio token)
    const byAccount = new Map<string, { token: string; ids: number[] }>();
    for (const s of targetShipments) {
      if (!byAccount.has(s.meli_user_id)) {
        const acc = accounts.find(a => String(a.meli_user_id) === s.meli_user_id);
        if (!acc) continue;
        const token = await decrypt(acc.access_token_enc, ENC_KEY);
        byAccount.set(s.meli_user_id, { token, ids: [] });
      }
      byAccount.get(s.meli_user_id)!.ids.push(s.shipment_id);
    }

    // Descargar etiquetas en lotes por cuenta
    const pdfChunks: ArrayBuffer[] = [];
    const response = format === "zpl" ? "zpl2" : "pdf";

    for (const accData of Array.from(byAccount.values())) {
      // MeLi acepta hasta 50 shipment_ids por request
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

    // Si hay un solo PDF, devolverlo directo
    if (pdfChunks.length === 1) {
      const contentType = format === "zpl" ? "application/octet-stream" : "application/pdf";
      const ext = format === "zpl" ? "zpl" : "pdf";
      return new NextResponse(pdfChunks[0], {
        headers: {
          "Content-Type":        contentType,
          "Content-Disposition": `attachment; filename="etiquetas-appjeez.${ext}"`,
        },
      });
    }

    // Múltiples PDFs: concatenar en un solo blob (los PDFs de MeLi ya son multi-página)
    const totalSize = pdfChunks.reduce((s, c) => s + c.byteLength, 0);
    const merged    = new Uint8Array(totalSize);
    let offset      = 0;
    for (const chunk of pdfChunks) {
      merged.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    // Devolver como ZIP con múltiples PDFs para que el usuario los imprima
    // O simplemente devolver el primero más grande si no podemos mergear sin librería
    // Por ahora devolvemos el PDF más grande (MeLi ya agrupa por batch)
    const biggest = pdfChunks.reduce((a, b) => a.byteLength > b.byteLength ? a : b);

    const contentType = format === "zpl" ? "application/octet-stream" : "application/pdf";
    const ext = format === "zpl" ? "zpl" : "pdf";

    return new NextResponse(biggest, {
      headers: {
        "Content-Type":        contentType,
        "Content-Disposition": `attachment; filename="etiquetas-appjeez.${ext}"`,
        "X-Total-Labels":      String(targetShipments.length),
        "X-PDF-Parts":         String(pdfChunks.length),
      },
    });

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { shipment_ids } = await req.json() as { shipment_ids: number[] };
    if (!shipment_ids?.length) {
      return NextResponse.json({ error: "No shipment_ids" }, { status: 400 });
    }
    const supabase = createClient(SUPA_URL, SERVICE_KEY);
    const rows = shipment_ids.map(id => ({ shipment_id: id }));
    await supabase.from("meli_printed_labels").upsert(rows, { onConflict: "shipment_id" });
    return NextResponse.json({ ok: true, marked: shipment_ids.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
