import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MELI_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const MELI_ME_URL    = "https://api.mercadolibre.com/users/me";

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

async function encrypt(text: string, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  // Formato: base64(iv + ciphertext)
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

// ── Handler principal ──────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  const APP_ID       = Deno.env.get("APPJEEZ_MELI_APP_ID");
  const SECRET_KEY   = Deno.env.get("APPJEEZ_MELI_SECRET_KEY");
  const FRONTEND_URL = Deno.env.get("APPJEEZ_FRONTEND_URL") ?? "https://taller-motos-app-two.vercel.app";
  const ENC_KEY      = Deno.env.get("APPJEEZ_MELI_ENCRYPTION_KEY");
  const SUPA_URL     = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const redirectOk    = (userId: number) =>
    Response.redirect(`${FRONTEND_URL}/configuracion/meli?status=success&user_id=${userId}`, 302);
  const redirectError = (msg: string) =>
    Response.redirect(`${FRONTEND_URL}/configuracion/meli?status=error&message=${msg}`, 302);

  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  if (!APP_ID || !SECRET_KEY || !ENC_KEY) {
    console.error("Missing required env vars");
    return redirectError("config_error");
  }

  // ── 1. Extraer código ──────────────────────────────────────
  const code = url.searchParams.get("code");
  if (!code) return new Response(JSON.stringify({ error: "Missing code" }), {
    status: 400, headers: { "Content-Type": "application/json" },
  });

  const redirectUri = `${url.protocol}//${url.host}${url.pathname}`;

  // ── 2. Intercambio de código por tokens (server-side) ─────
  let tokenData: {
    access_token: string; refresh_token: string;
    user_id: number; expires_in: number;
  };

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code", client_id: APP_ID,
      client_secret: SECRET_KEY, code, redirect_uri: redirectUri,
    });
    const res = await fetch(MELI_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) {
      console.error("MeLi token exchange failed:", res.status, await res.text());
      return redirectError("auth_failed");
    }
    tokenData = await res.json();
  } catch (err) {
    console.error("Network error:", err);
    return redirectError("network_error");
  }

  // ── 3. Obtener nickname ────────────────────────────────────
  let nickname = "";
  try {
    const meRes = await fetch(MELI_ME_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json() as { nickname?: string };
      nickname = me.nickname ?? "";
    }
  } catch { /* nickname opcional */ }

  // ── 4. Encriptar tokens antes de guardar ──────────────────
  const [encAccessToken, encRefreshToken] = await Promise.all([
    encrypt(tokenData.access_token,  ENC_KEY),
    encrypt(tokenData.refresh_token, ENC_KEY),
  ]);

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  // ── 5. Guardar en Supabase (tokens encriptados) ────────────
  const supabase = createClient(SUPA_URL, SERVICE_KEY);

  const { error: rpcError } = await supabase.rpc("upsert_meli_account", {
    p_meli_user_id:  tokenData.user_id,
    p_nickname:      nickname,
    p_access_token:  encAccessToken,
    p_refresh_token: encRefreshToken,
    p_expires_at:    expiresAt,
  });

  if (rpcError) {
    console.error("Supabase RPC error:", rpcError);
    return redirectError("db_error");
  }

  return redirectOk(tokenData.user_id);
});
