import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENC_KEY     = process.env.APPJEEZ_MELI_ENCRYPTION_KEY!;
const MELI        = "https://api.mercadolibre.com";

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const km  = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("appjeez-meli-salt"), iterations: 100000, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
  );
}

async function decrypt(encBase64: string, passphrase: string): Promise<string> {
  const key      = await deriveKey(passphrase);
  const combined = Uint8Array.from(atob(encBase64), (c) => c.charCodeAt(0));
  const plain    = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: combined.slice(0, 12) }, key, combined.slice(12)
  );
  return new TextDecoder().decode(plain);
}

async function meliGet(path: string, token: string) {
  try {
    const res = await fetch(`${MELI}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function processAccount(acc: {
  id: string; nickname: string; meli_user_id: string; access_token_enc: string;
}) {
  try {
    const token   = await decrypt(acc.access_token_enc, ENC_KEY);
    const uid     = acc.meli_user_id;
    const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

    const [userData, ordersToday, shipments, itemsSearch, questions] = await Promise.all([
      meliGet(`/users/${uid}`, token),
      meliGet(`/orders/search?seller=${uid}&order.status=paid&order.date_created.from=${todayISO}&limit=50`, token),
      meliGet(`/shipments/search?seller_id=${uid}&status=ready_to_ship&limit=1`, token),
      meliGet(`/users/${uid}/items/search?limit=1`, token),
      meliGet(`/questions/search?seller_id=${uid}&status=UNANSWERED&limit=1`, token),
    ]);

    const rep = userData?.seller_reputation ?? null;
    const totalAmount = (ordersToday?.results ?? []).reduce(
      (s: number, o: { total_amount?: number }) => s + (o.total_amount ?? 0), 0
    );

    return {
      account:              acc.nickname,
      meli_user_id:         uid,
      unanswered_questions: questions?.total ?? 0,
      pending_messages:     0,
      ready_to_ship:        shipments?.paging?.total ?? 0,
      total_items:          itemsSearch?.paging?.total ?? 0,
      today_orders:         ordersToday?.paging?.total ?? 0,
      today_sales_amount:   totalAmount,
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
    return {
      account:      acc.nickname,
      meli_user_id: acc.meli_user_id,
      error:        (err as Error).message,
      unanswered_questions: 0,
      pending_messages: 0,
      ready_to_ship: 0,
      total_items: 0,
      today_orders: 0,
      today_sales_amount: 0,
      reputation: null,
    };
  }
}

export async function GET() {
  try {
    const supabase = createClient(SUPA_URL, SERVICE_KEY);

    const { data: accounts, error } = await supabase
      .from("meli_accounts")
      .select("id, meli_user_id, nickname, access_token_enc")
      .eq("status", "active");

    if (error || !accounts?.length) {
      return NextResponse.json([]);
    }

    // Procesar todas las cuentas en paralelo
    const results = await Promise.all(accounts.map(processAccount));

    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
