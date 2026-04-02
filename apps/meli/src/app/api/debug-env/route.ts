import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "NO DEFINIDA";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "NO DEFINIDA";
  const enc = process.env.APPJEEZ_MELI_ENCRYPTION_KEY ?? "NO DEFINIDA";
  const appId = process.env.APPJEEZ_MELI_APP_ID ?? "NO DEFINIDA";
  const secret = process.env.APPJEEZ_MELI_SECRET_KEY ?? "NO DEFINIDA";

  const info: Record<string, unknown> = {
    SUPABASE_URL: url ? url.substring(0, 30) + "..." : "VACIA",
    SERVICE_KEY_LENGTH: key.length,
    SERVICE_KEY_PREFIX: key.substring(0, 10),
    ENC_KEY_LENGTH: enc.length,
    APP_ID: appId,
    SECRET_KEY_LENGTH: secret.length,
  };

  // Test conexión a Supabase
  try {
    const supabase = createClient(url, key);
    const { data, error, count } = await supabase
      .from("meli_accounts")
      .select("id, nickname, status", { count: "exact" });

    info.supabase_error = error?.message ?? null;
    info.accounts_count = count ?? data?.length ?? 0;
    info.accounts = (data ?? []).map((a: Record<string, unknown>) => ({
      nickname: a.nickname,
      status: a.status,
    }));
  } catch (e) {
    info.supabase_error = String(e);
  }

  return NextResponse.json(info);
}
