import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { webcrypto } from "crypto";

const subtle = webcrypto.subtle;

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const km = await subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("appjeez-meli-salt"), iterations: 100000, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
  );
}

async function decrypt(encBase64: string, passphrase: string): Promise<string> {
  const key      = await deriveKey(passphrase);
  const combined = Buffer.from(encBase64, "base64");
  const plain    = await subtle.decrypt({ name: "AES-GCM", iv: combined.slice(0, 12) }, key, combined.slice(12));
  return new TextDecoder().decode(plain);
}

async function meliGet(path: string, token: string) {
  const res = await fetch(`https://api.mercadolibre.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function GET() {
  const ENC_KEY     = process.env.APPJEEZ_MELI_ENCRYPTION_KEY;
  const SUPA_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!ENC_KEY) return NextResponse.json({ error: "Missing APPJEEZ_MELI_ENCRYPTION_KEY" }, { status: 500 });
  if (!SERVICE_KEY) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  if (!SUPA_URL) return NextResponse.json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });

  const supabase = createClient(SUPA_URL, SERVICE_KEY);
  const { data: accounts, error } = await supabase
    .from("meli_accounts")
    .select("id, meli_user_id, nickname, access_token_enc, status")
    .eq("status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!accounts || accounts.length === 0) return NextResponse.json([]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  const result = [];

  for (const acc of accounts as { id: string; meli_user_id: string; nickname: string; access_token_enc: string; status: string }[]) {
    try {
      const token = await decrypt(acc.access_token_enc, ENC_KEY);
      const uid   = acc.meli_user_id;

      const [questions, reputation, ordersToday, shipments, messages, itemsSearch] = await Promise.allSettled([
        meliGet(`/my/received_questions/search?status=UNANSWERED&limit=1`, token),
        meliGet(`/users/${uid}/reputation`, token),
        meliGet(`/orders/search?seller=${uid}&order.status=paid&order.date_created.from=${todayISO}&limit=50`, token),
        meliGet(`/shipments/search?seller_id=${uid}&status=ready_to_ship&limit=1`, token),
        meliGet(`/messages/unread?user_id=${uid}&limit=1`, token),
        meliGet(`/users/${uid}/items/search?limit=1`, token),
      ]);

      const qData    = questions.status    === "fulfilled" ? questions.value    : null;
      const repData  = reputation.status   === "fulfilled" ? reputation.value   : null;
      const ordData  = ordersToday.status  === "fulfilled" ? ordersToday.value  : null;
      const shipData = shipments.status    === "fulfilled" ? shipments.value    : null;
      const msgData  = messages.status     === "fulfilled" ? messages.value     : null;
      const itmData  = itemsSearch.status  === "fulfilled" ? itemsSearch.value  : null;

      const totalSalesAmount: number = (ordData?.results ?? []).reduce(
        (s: number, o: { total_amount?: number }) => s + (o.total_amount ?? 0), 0
      );

      result.push({
        account:          acc.nickname,
        meli_user_id:     uid,
        unanswered_questions: qData?.total ?? 0,
        pending_messages:     msgData?.total ?? 0,
        ready_to_ship:        shipData?.paging?.total ?? 0,
        total_items:          itmData?.paging?.total ?? 0,
        today_orders:         ordData?.paging?.total ?? 0,
        today_sales_amount:   totalSalesAmount,
        reputation: {
          level_id:           repData?.level_id ?? null,
          power_seller_status: repData?.power_seller_status ?? null,
          transactions:       repData?.transactions?.total ?? 0,
          positive:           repData?.transactions?.ratings?.positive ?? 0,
          negative:           repData?.transactions?.ratings?.negative ?? 0,
          neutral:            repData?.transactions?.ratings?.neutral ?? 0,
          delayed_handling_time: repData?.metrics?.delayed_handling_time?.rate ?? 0,
          claims:             repData?.metrics?.claims?.rate ?? 0,
          cancellations:      repData?.metrics?.cancellations?.rate ?? 0,
          immediate_payment:  repData?.immediate_payment ?? false,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error for ${acc.meli_user_id}:`, msg);
      result.push({ account: acc.nickname, meli_user_id: acc.meli_user_id, error: msg });
    }
  }

  return NextResponse.json(result);
}
