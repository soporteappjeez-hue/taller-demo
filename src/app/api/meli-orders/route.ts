import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic  = "force-dynamic";
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
  const key      = await deriveKey(pass);
  const combined = Uint8Array.from(atob(enc64), c => c.charCodeAt(0));
  const plain    = await crypto.subtle.decrypt({ name: "AES-GCM", iv: combined.slice(0, 12) }, key, combined.slice(12));
  return new TextDecoder().decode(plain);
}

async function meliGet(path: string, token: string) {
  try {
    const res = await fetch(`https://api.mercadolibre.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

function todayArgentina(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export async function GET() {
  try {
    const supabase = createClient(SUPA_URL, SERVICE_KEY);
    const { data: accounts, error } = await supabase
      .from("meli_accounts")
      .select("id, meli_user_id, nickname, access_token_enc")
      .eq("status", "active")
      .order("nickname", { ascending: true });

    if (error || !accounts?.length) return NextResponse.json([]);

    const today = todayArgentina();

    const results = await Promise.all(accounts.map(async (acc) => {
      try {
        const token = await decrypt(acc.access_token_enc, ENC_KEY);

        // Últimas 50 órdenes pagadas
        const [ordersData, shipData] = await Promise.all([
          meliGet(`/orders/search?seller=${acc.meli_user_id}&order.status=paid&sort=date_desc&limit=50`, token),
          meliGet(`/shipments/search?seller_id=${acc.meli_user_id}&status=ready_to_ship&limit=50`, token),
        ]);

        // Filtrar órdenes de hoy en Argentina
        const allOrders = (ordersData?.results ?? []) as Record<string, unknown>[];
        const todayOrders = allOrders.filter(o => {
          const d = (o.date_created as string | undefined) ?? "";
          return d.startsWith(today);
        });

        // Totales
        const totalAmount = todayOrders.reduce((s, o) => {
          const total = o.total_amount as number | undefined;
          return s + (total ?? 0);
        }, 0);

        // Mapear órdenes con items
        const orderItems = await Promise.all(
          todayOrders.slice(0, 20).map(async (o) => {
            const rawItems = (o.order_items as Record<string, unknown>[] | undefined) ?? [];
            const items = rawItems.map((oi) => {
              const item = (oi.item as Record<string, unknown> | undefined) ?? {};
              return {
                title:     (item.title as string | undefined)     ?? "Producto",
                thumbnail: (item.thumbnail as string | undefined) ?? null,
                qty:       (oi.quantity as number | undefined)    ?? 1,
                price:     (oi.unit_price as number | undefined)  ?? 0,
              };
            });
            const buyer = (o.buyer as Record<string, unknown> | undefined) ?? {};
            return {
              id:          o.id as number,
              status:      o.status as string,
              date:        o.date_created as string,
              total:       (o.total_amount as number) ?? 0,
              currency:    (o.currency_id as string) ?? "ARS",
              buyer:       `${(buyer.first_name as string | undefined) ?? ""} ${(buyer.last_name as string | undefined) ?? ""}`.trim() || "Comprador",
              shipping_id: (o.shipping as Record<string, unknown> | undefined)?.id as number | null ?? null,
              items,
            };
          })
        );

        // Envíos listos para despachar
        const shipResults = (shipData?.results ?? []) as Record<string, unknown>[];
        const shipItems = shipResults.map(s => ({
          id:              s.id as number,
          status:          (s.status as string) ?? "",
          substatus:       (s.substatus as string) ?? "",
          date:            (s.date_created as string) ?? "",
          tracking_number: (s.tracking_number as string | null) ?? null,
          address:         ((s.receiver_address as Record<string, unknown> | undefined)?.street_name as string | undefined) ?? "Sin dirección",
          zip:             ((s.receiver_address as Record<string, unknown> | undefined)?.zip_code as string | undefined) ?? "",
        }));

        return {
          account:      acc.nickname,
          meli_user_id: String(acc.meli_user_id),
          orders: {
            total:   todayOrders.length,
            amount:  totalAmount,
            results: orderItems,
          },
          shipments: {
            total:   shipItems.length,
            results: shipItems,
          },
        };
      } catch (e) {
        return {
          account:      acc.nickname,
          meli_user_id: String(acc.meli_user_id),
          orders:    { total: 0, amount: 0, results: [] },
          shipments: { total: 0, results: [] },
          error:     (e as Error).message,
        };
      }
    }));

    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
