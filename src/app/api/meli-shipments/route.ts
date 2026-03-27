import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const key = await deriveKey(pass);
  const combined = Uint8Array.from(atob(enc64), c => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: combined.slice(0, 12) }, key, combined.slice(12));
  return new TextDecoder().decode(plain);
}

async function meliGet(path: string, token: string) {
  try {
    const res = await fetch(`https://api.mercadolibre.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function classifyLogistic(type: string | null | undefined): "flex" | "turbo" | "full" | "correo" {
  if (!type) return "correo";
  const t = type.toLowerCase();
  if (t === "flex") return "flex";
  if (t === "turbo" || t === "self_service_turbo" || t.includes("turbo")) return "turbo";
  if (t === "fulfillment") return "full";
  return "correo";
}

function urgency(limitDate: string | null): "overdue" | "urgent" | "soon" | "ok" {
  if (!limitDate) return "ok";
  const diffH = (new Date(limitDate).getTime() - Date.now()) / 3600000;
  if (diffH < 0)   return "overdue";
  if (diffH < 2)   return "urgent";
  if (diffH < 6)   return "soon";
  return "ok";
}

interface MeliShipment {
  id: number;
  logistic_type?: string;
  substatus?: string;
  tracking_number?: string;
  date_created?: string;
  order_id?: number;
  shipping_limit?: string;
  estimated_handling_limit?: string;
  status?: string;
}

export async function GET() {
  try {
    const supabase = createClient(SUPA_URL, SERVICE_KEY);
    const { data: accounts, error } = await supabase
      .from("meli_accounts")
      .select("id, meli_user_id, nickname, access_token_enc")
      .eq("status", "active")
      .order("nickname", { ascending: true });

    if (error || !accounts?.length) return NextResponse.json({ ready: [], upcoming: [], full_count: 0, turbo_count: 0 });

    const ready:    object[] = [];
    const upcoming: object[] = [];
    let   fullCount  = 0;
    let   turboCount = 0;

    await Promise.all(accounts.map(async (acc) => {
      try {
        const token = await decrypt(acc.access_token_enc, ENC_KEY);

        const [readyShip, handlingShip, fullOrders, turboOrders] = await Promise.all([
          meliGet(`/shipments/search?seller_id=${acc.meli_user_id}&status=ready_to_ship&limit=50`, token),
          meliGet(`/shipments/search?seller_id=${acc.meli_user_id}&status=handling&limit=50`, token),
          meliGet(`/orders/search?seller=${acc.meli_user_id}&order.status=paid&shipping.logistic_type=fulfillment&limit=1`, token),
          meliGet(`/shipments/search?seller_id=${acc.meli_user_id}&logistic_type=turbo&status=handling&limit=1`, token),
        ]);

        fullCount  += fullOrders?.paging?.total  ?? 0;
        turboCount += turboOrders?.paging?.total ?? 0;

        const toItem = (s: MeliShipment, listType: "ready" | "upcoming") => {
          const logType = classifyLogistic(s.logistic_type);
          const limit   = s.shipping_limit ?? s.estimated_handling_limit ?? null;
          return {
            shipment_id:     s.id,
            order_id:        s.order_id ?? null,
            account:         acc.nickname,
            logistic_type:   s.logistic_type ?? "unknown",
            type:            logType,
            substatus:       s.substatus ?? null,
            tracking_number: s.tracking_number ?? null,
            date_created:    s.date_created ?? null,
            shipping_limit:  limit,
            urgency:         urgency(limit),
            list_type:       listType,
            label_url:       `https://www.mercadolibre.com.ar/envios/details/${s.id}`,
          };
        };

        for (const s of (readyShip?.results ?? []) as MeliShipment[]) {
          if (classifyLogistic(s.logistic_type) !== "full") {
            ready.push(toItem(s, "ready"));
          }
        }
        for (const s of (handlingShip?.results ?? []) as MeliShipment[]) {
          if (classifyLogistic(s.logistic_type) !== "full") {
            upcoming.push(toItem(s, "upcoming"));
          }
        }
      } catch { /* skip */ }
    }));

    // Ordenar por urgencia: overdue → urgent → soon → ok
    const urgencyOrder = { overdue: 0, urgent: 1, soon: 2, ok: 3 };
    const sortFn = (a: object, b: object) => {
      const au = urgencyOrder[(a as { urgency: keyof typeof urgencyOrder }).urgency] ?? 3;
      const bu = urgencyOrder[(b as { urgency: keyof typeof urgencyOrder }).urgency] ?? 3;
      return au - bu;
    };
    ready.sort(sortFn);
    upcoming.sort(sortFn);

    return NextResponse.json({ ready, upcoming, full_count: fullCount, turbo_count: turboCount });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
