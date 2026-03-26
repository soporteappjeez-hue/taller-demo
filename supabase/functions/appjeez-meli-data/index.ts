import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MELI = "https://api.mercadolibre.com";

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
  const combined = Uint8Array.from(atob(encBase64), c => c.charCodeAt(0));
  const plain    = await crypto.subtle.decrypt({ name: "AES-GCM", iv: combined.slice(0, 12) }, key, combined.slice(12));
  return new TextDecoder().decode(plain);
}
async function meliGet(path: string, token: string) {
  const res = await fetch(`${MELI}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const ENC_KEY     = Deno.env.get("APPJEEZ_MELI_ENCRYPTION_KEY")!;
  const SUPA_URL    = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!ENC_KEY) return new Response(JSON.stringify({ error: "Missing ENC_KEY" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  const supabase = createClient(SUPA_URL, SERVICE_KEY);
  const { data: accounts, error } = await supabase
    .from("meli_accounts")
    .select("id, meli_user_id, nickname, access_token_enc, status")
    .eq("status", "active");

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  if (!accounts || accounts.length === 0) return new Response("[]", { headers: { ...cors, "Content-Type": "application/json" } });

  const todayISO = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  const result   = [];

  for (const acc of accounts) {
    try {
      const token = await decrypt(acc.access_token_enc, ENC_KEY);
      const uid   = acc.meli_user_id;

      const [userData, ordersToday, shipments, itemsSearch, questions] = await Promise.allSettled([
        meliGet(`/users/${uid}`, token),
        meliGet(`/orders/search?seller=${uid}&order.status=paid&order.date_created.from=${todayISO}&limit=50`, token),
        meliGet(`/shipments/search?seller_id=${uid}&status=ready_to_ship&limit=1`, token),
        meliGet(`/users/${uid}/items/search?limit=1`, token),
        meliGet(`/questions/search?seller_id=${uid}&status=UNANSWERED&limit=1`, token),
      ]);

      const user  = userData.status    === "fulfilled" ? userData.value    : null;
      const ord   = ordersToday.status === "fulfilled" ? ordersToday.value : null;
      const ship  = shipments.status   === "fulfilled" ? shipments.value   : null;
      const itm   = itemsSearch.status === "fulfilled" ? itemsSearch.value : null;
      const qData = questions.status   === "fulfilled" ? questions.value   : null;

      // Reputación desde /users/{id} → seller_reputation
      const rep = user?.seller_reputation ?? null;

      const totalAmount = (ord?.results ?? []).reduce(
        (s: number, o: { total_amount?: number }) => s + (o.total_amount ?? 0), 0
      );

      result.push({
        account:              acc.nickname,
        meli_user_id:         uid,
        unanswered_questions: qData?.total ?? 0,
        pending_messages:     0,
        ready_to_ship:        ship?.paging?.total ?? 0,
        total_items:          itm?.paging?.total ?? 0,
        today_orders:         ord?.paging?.total ?? 0,
        today_sales_amount:   totalAmount,
        reputation: rep ? {
          level_id:              rep.level_id ?? null,
          power_seller_status:   rep.power_seller_status ?? null,
          transactions_total:    rep.transactions?.total ?? 0,
          transactions_completed: rep.transactions?.completed ?? 0,
          ratings_positive:      rep.transactions?.ratings?.positive ?? 0,
          ratings_negative:      rep.transactions?.ratings?.negative ?? 0,
          ratings_neutral:       rep.transactions?.ratings?.neutral ?? 0,
          delayed_handling_time: rep.metrics?.delayed_handling_time?.rate ?? 0,
          claims:                rep.metrics?.claims?.rate ?? 0,
          cancellations:         rep.metrics?.cancellations?.rate ?? 0,
        } : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.push({ account: acc.nickname, meli_user_id: acc.meli_user_id, error: msg });
    }
  }

  return new Response(JSON.stringify(result), { headers: { ...cors, "Content-Type": "application/json" } });
});
