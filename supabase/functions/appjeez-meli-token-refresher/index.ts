import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MELI_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

// ── AES-GCM helpers ────────────────────────────────────────────
async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("appjeez-meli-salt"), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function decrypt(encBase64: string, passphrase: string): Promise<string> {
  const key      = await deriveKey(passphrase);
  const combined = Uint8Array.from(atob(encBase64), c => c.charCodeAt(0));
  const iv       = combined.slice(0, 12);
  const data     = combined.slice(12);
  const plain    = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(plain);
}

async function encrypt(text: string, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

// ── Tipos ──────────────────────────────────────────────────────
interface MeliAccountRow {
  id:                string;
  meli_user_id:      number;
  nickname:          string;
  access_token_enc:  string;
  refresh_token_enc: string;
  expires_at:        string;
  status:            string;
}

// ── Handler principal ──────────────────────────────────────────
Deno.serve(async (_req: Request) => {
  const APP_ID      = Deno.env.get("APPJEEZ_MELI_APP_ID");
  const SECRET_KEY  = Deno.env.get("APPJEEZ_MELI_SECRET_KEY");
  const ENC_KEY     = Deno.env.get("APPJEEZ_MELI_ENCRYPTION_KEY");
  const SUPA_URL    = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!APP_ID || !SECRET_KEY || !ENC_KEY) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), { status: 500 });
  }

  const supabase = createClient(SUPA_URL, SERVICE_KEY);

  // ── 1. Obtener cuentas que expiran en 30 min ──────────────
  const { data: accounts, error: fetchErr } = await supabase
    .rpc("get_meli_accounts_to_refresh");

  if (fetchErr) {
    console.error("Error fetching accounts:", fetchErr);
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  if (!accounts || (accounts as MeliAccountRow[]).length === 0) {
    return new Response(JSON.stringify({ refreshed: 0, message: "No accounts need refresh" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  const results = { refreshed: 0, failed: 0, errors: [] as string[] };

  // ── 2. Renovar cada cuenta ────────────────────────────────
  for (const account of accounts as MeliAccountRow[]) {
    try {
      // Desencriptar refresh_token
      const refreshToken = await decrypt(account.refresh_token_enc, ENC_KEY);

      const body = new URLSearchParams({
        grant_type:    "refresh_token",
        client_id:     APP_ID,
        client_secret: SECRET_KEY,
        refresh_token: refreshToken,
      });

      const res = await fetch(MELI_TOKEN_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    body.toString(),
      });

      if (!res.ok) {
        console.error(`Refresh failed for ${account.meli_user_id}:`, res.status);
        if (res.status === 400 || res.status === 401) {
          await supabase.rpc("expire_meli_account", { p_meli_user_id: account.meli_user_id });
        }
        results.failed++;
        results.errors.push(`${account.meli_user_id}: ${res.status}`);
        continue;
      }

      const newTokens = await res.json() as {
        access_token: string; refresh_token: string; expires_in: number;
      };

      // Encriptar nuevos tokens
      const [encAt, encRt] = await Promise.all([
        encrypt(newTokens.access_token,  ENC_KEY),
        encrypt(newTokens.refresh_token, ENC_KEY),
      ]);

      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      const { error: rpcErr } = await supabase.rpc("upsert_meli_account", {
        p_meli_user_id:  account.meli_user_id,
        p_nickname:      account.nickname,
        p_access_token:  encAt,
        p_refresh_token: encRt,
        p_expires_at:    newExpiresAt,
      });

      if (rpcErr) {
        console.error(`DB update failed for ${account.meli_user_id}:`, rpcErr);
        results.failed++;
        results.errors.push(`${account.meli_user_id}: db_error`);
      } else {
        console.log(`Refreshed: ${account.meli_user_id} (${account.nickname})`);
        results.refreshed++;
      }

    } catch (err) {
      console.error(`Error for ${account.meli_user_id}:`, err);
      results.failed++;
      results.errors.push(`${account.meli_user_id}: unexpected_error`);
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
