import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Configuración
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ENC_KEY = process.env.APPJEEZ_MELI_ENCRYPTION_KEY!;
const APP_ID = process.env.APPJEEZ_MELI_APP_ID ?? "";
const SECRET_KEY = process.env.APPJEEZ_MELI_SECRET_KEY ?? "";

// Cliente Supabase Admin (saltea RLS)
export function getSupabase() {
  return createClient(SUPA_URL, SERVICE_KEY);
}

// Cliente Supabase con sesión de usuario (respeta RLS)
export async function getSupabaseWithAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("sb-access-token")?.value;
  
  if (!token) return null;
  
  return createClient(SUPA_URL, ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

// Obtener user_id del usuario autenticado
export async function getAuthenticatedUserId(): Promise<string | null> {
  const supa = await getSupabaseWithAuth();
  if (!supa) return null;
  
  const { data: { user } } = await supa.auth.getUser();
  return user?.id ?? null;
}

// ── ENCRIPTACIÓN AES-GCM ───────────────────────────────────────
async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("appjeez-meli-salt"), iterations: 100000, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

export async function decrypt(enc64: string, pass: string = ENC_KEY): Promise<string> {
  const key = await deriveKey(pass);
  const combined = Uint8Array.from(atob(enc64), c => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: combined.slice(0, 12) }, key, combined.slice(12));
  return new TextDecoder().decode(plain);
}

export async function encrypt(text: string, pass: string = ENC_KEY): Promise<string> {
  const key = await deriveKey(pass);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
  const combined = new Uint8Array(iv.byteLength + ct.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ct), iv.byteLength);
  return btoa(String.fromCharCode.apply(null, Array.from(combined)));
}

// ── TIPOS ─────────────────────────────────────────────────────
export interface LinkedMeliAccount {
  id: string;
  user_id: string;
  meli_user_id: string;
  meli_nickname: string;
  access_token_enc: string;
  refresh_token_enc: string;
  token_expiry_date: string;
  is_active: boolean;
}

interface RefreshResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// ── REFRESH TOKEN ─────────────────────────────────────────────
export async function refreshMeliToken(refreshTokenEnc: string): Promise<RefreshResult | null> {
  if (!APP_ID || !SECRET_KEY) return null;
  try {
    const rt = await decrypt(refreshTokenEnc);
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: APP_ID,
      client_secret: SECRET_KEY,
      refresh_token: rt,
    });
    const res = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// ── ACTUALIZAR TOKENS EN BD ───────────────────────────────────
export async function updateLinkedAccountTokens(
  accountId: string,
  newTokens: RefreshResult
): Promise<string> {
  const [encAt, encRt] = await Promise.all([
    encrypt(newTokens.access_token),
    encrypt(newTokens.refresh_token),
  ]);
  const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
  const supabase = getSupabase();
  
  const { error } = await supabase
    .from("linked_meli_accounts")
    .update({
      access_token_enc: encAt,
      refresh_token_enc: encRt,
      token_expiry_date: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);

  if (error) {
    console.error("[updateLinkedAccountTokens] Error:", error);
    throw error;
  }
  
  return newTokens.access_token;
}

// ── OBTENER CUENTAS ACTIVAS DE UN USUARIO ─────────────────────
export async function getUserLinkedAccounts(userId: string): Promise<LinkedMeliAccount[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("linked_meli_accounts")
    .select("id, user_id, meli_user_id, meli_nickname, access_token_enc, refresh_token_enc, token_expiry_date, is_active")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getUserLinkedAccounts] Error:", error);
    return [];
  }
  
  return (data ?? []) as LinkedMeliAccount[];
}

// ── OBTENER TOKEN VÁLIDO (con auto-refresh) ───────────────────
// Acepta tanto LinkedMeliAccount como MeliAccount
export async function getValidToken(
  account: LinkedMeliAccount | MeliAccount
): Promise<string | null> {
  try {
    // Normalizar campos (soportar ambos formatos)
    const tokenExpiryDate = (account as LinkedMeliAccount).token_expiry_date || (account as MeliAccount).expires_at;
    const meliUserId = (account as LinkedMeliAccount).meli_user_id || (account as MeliAccount).meli_user_id;
    const accountId = account.id;

    // Verificar si está por expirar (con margen de 5 minutos)
    const isExpired = tokenExpiryDate && 
      new Date(tokenExpiryDate).getTime() < Date.now() + 5 * 60 * 1000;

    if (!isExpired) {
      try {
        const token = await decrypt(account.access_token_enc);
        // Verificar que el token funcione
        const testUserId = typeof meliUserId === 'string' ? meliUserId : String(meliUserId);
        const test = await fetch(`https://api.mercadolibre.com/users/${testUserId}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });
        if (test.ok) return token;
      } catch {
        // Si falla el decrypt o el test, continuar a refresh
      }
    }

    // Intentar refresh
    if (!account.refresh_token_enc) return null;
    const newTokens = await refreshMeliToken(account.refresh_token_enc);
    if (!newTokens) return null;
    
    await updateLinkedAccountTokens(accountId, newTokens);
    return newTokens.access_token;
  } catch (err) {
    console.error("[getValidToken] Error:", err);
    return null;
  }
}

// ── OBTENER TOKEN VÁLIDO POR IDs ──────────────────────────────
export async function getValidTokenForAccount(
  userId: string, 
  meliUserId: string
): Promise<{ token: string; account: LinkedMeliAccount } | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from("linked_meli_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("meli_user_id", meliUserId)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    console.error("[getValidTokenForAccount] Cuenta no encontrada:", error);
    return null;
  }

  const account = data as LinkedMeliAccount;
  const token = await getValidToken(account);
  
  if (!token) return null;
  return { token, account };
}

// ── LLAMADAS API MELI ─────────────────────────────────────────
export async function meliGet(path: string, token: string) {
  try {
    const res = await fetch(`https://api.mercadolibre.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      console.error(`[meliGet] HTTP ${res.status} en ${path}`, await res.text().catch(() => ""));
      if (res.status === 451) throw new Error("HTTP_451_BLOCKED");
      return null;
    }
    return res.json();
  } catch (err) {
    if ((err as Error).message === "HTTP_451_BLOCKED") throw err;
    return null;
  }
}

export async function meliGetWithRetry(
  path: string,
  token: string,
  retries = 1,
  delayMs = 1000
): Promise<unknown | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`https://api.mercadolibre.com${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429 && attempt < retries) {
        console.warn(`[meli] 429 rate limit en ${path}, reintentando...`);
        await new Promise(r => setTimeout(r, delayMs * 2));
        continue;
      }
      if (!res.ok) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
        return null;
      }
      return res.json();
    } catch {
      if (attempt < retries) {
        console.warn(`[meli] Timeout en ${path}, intento ${attempt + 1}/${retries + 1}`);
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      return null;
    }
  }
  return null;
}

export async function meliGetRaw(path: string, token: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`https://api.mercadolibre.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return res.arrayBuffer();
  } catch { return null; }
}

// ── FUNCIÓN PARA PROCESAR MÚLTIPLES CUENTAS ───────────────────
export async function processMultipleAccounts<T>(
  userId: string,
  meliUserIds: string[],
  processor: (token: string, account: LinkedMeliAccount) => Promise<T>
): Promise<Map<string, { success: boolean; result?: T; error?: string }>> {
  const results = new Map<string, { success: boolean; result?: T; error?: string }>();

  for (const meliUserId of meliUserIds) {
    try {
      const validTokenData = await getValidTokenForAccount(userId, meliUserId);
      
      if (!validTokenData) {
        results.set(meliUserId, { 
          success: false, 
          error: "No se pudo obtener token válido" 
        });
        continue;
      }

      const { token, account } = validTokenData;
      const result = await processor(token, account);
      results.set(meliUserId, { success: true, result });
    } catch (err) {
      results.set(meliUserId, { 
        success: false, 
        error: (err as Error).message 
      });
    }
  }

  return results;
}

// ── BACKWARDS COMPATIBILITY (legacy functions) ────────────────
// Mantenemos las funciones antiguas para no romper código existente
export interface MeliAccount {
  id: string;
  meli_user_id: number;
  nickname: string;
  access_token_enc: string;
  refresh_token_enc: string;
  expires_at: string;
  status: string;
}

export async function getActiveAccounts(): Promise<MeliAccount[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("meli_accounts")
    .select("id, meli_user_id, nickname, access_token_enc, refresh_token_enc, expires_at, status")
    .eq("status", "active")
    .order("nickname", { ascending: true });
  return (data ?? []) as MeliAccount[];
}

export async function updateAccountTokens(
  meliUserId: number | string,
  nickname: string,
  newTokens: RefreshResult
): Promise<string> {
  const [encAt, encRt] = await Promise.all([
    encrypt(newTokens.access_token),
    encrypt(newTokens.refresh_token),
  ]);
  const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
  const supabase = getSupabase();
  await supabase.rpc("upsert_meli_account", {
    p_meli_user_id: Number(meliUserId),
    p_nickname: nickname,
    p_access_token: encAt,
    p_refresh_token: encRt,
    p_expires_at: expiresAt,
  });
  return newTokens.access_token;
}

// ── FUNCIÓN SEGURA: Obtener cuentas del usuario autenticado ────────────────
// Esta es la función que DEBES usar en las APIs para respetar el multi-tenant
export async function getActiveAccountsForUser(userId: string): Promise<LinkedMeliAccount[]> {
  return getUserLinkedAccounts(userId);
}

// ── FUNCIÓN SEGURA: Obtener cuentas desde el request ──────────────────────
// Usa esta función en las APIs para obtener las cuentas del usuario autenticado
export async function getUserAccountsFromRequest(): Promise<LinkedMeliAccount[]> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return [];
  return getUserLinkedAccounts(userId);
}
