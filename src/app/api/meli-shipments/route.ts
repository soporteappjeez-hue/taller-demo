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

function classifyLogistic(type: string | null | undefined): "flex" | "full" | "correo" {
  if (!type) return "correo";
  const t = type.toLowerCase();
  if (t === "flex") return "flex";
  if (t === "fulfillment") return "full";
  return "correo";
}

export async function GET() {
  try {
    const supabase = createClient(SUPA_URL, SERVICE_KEY);
    const { data: accounts, error } = await supabase
      .from("meli_accounts")
      .select("id, meli_user_id, nickname, access_token_enc")
      .eq("status", "active")
      .order("nickname", { ascending: true });

    if (error || !accounts?.length) return NextResponse.json({ flex: [], correo: [], full_count: 0 });

    const flex:   object[] = [];
    const correo: object[] = [];
    let   fullCount = 0;

    await Promise.all(accounts.map(async (acc) => {
      try {
        const token = await decrypt(acc.access_token_enc, ENC_KEY);

        // Envíos listos para despachar
        const [readyShip, fullOrders] = await Promise.all([
          meliGet(`/shipments/search?seller_id=${acc.meli_user_id}&status=ready_to_ship&limit=50`, token),
          meliGet(`/orders/search?seller=${acc.meli_user_id}&order.status=paid&shipping.logistic_type=fulfillment&limit=1`, token),
        ]);

        fullCount += fullOrders?.paging?.total ?? 0;

        const shipments: {
          id: number;
          logistic_type?: string;
          substatus?: string;
          tracking_number?: string;
          date_created?: string;
          order_id?: number;
        }[] = readyShip?.results ?? [];

        for (const s of shipments) {
          const type = classifyLogistic(s.logistic_type);
          const item = {
            shipment_id:     s.id,
            order_id:        s.order_id,
            account:         acc.nickname,
            logistic_type:   s.logistic_type ?? "unknown",
            type,
            substatus:       s.substatus ?? null,
            tracking_number: s.tracking_number ?? null,
            date_created:    s.date_created ?? null,
            label_url:       `https://api.mercadolibre.com/shipments/${s.id}/labels?response_type=zpl2&caller.id=${acc.meli_user_id}`,
          };
          if (type === "flex")   flex.push(item);
          else if (type === "full") { /* Full lo maneja MeLi */ }
          else                   correo.push(item);
        }
      } catch { /* skip account */ }
    }));

    return NextResponse.json({ flex, correo, full_count: fullCount });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
