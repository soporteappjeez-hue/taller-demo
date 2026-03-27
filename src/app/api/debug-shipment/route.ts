import { NextResponse } from "next/server";
import { getSupabase, getValidToken, meliGet, MeliAccount } from "@/lib/meli";

export const dynamic = "force-dynamic";

// Diagnóstico: GET /api/debug-shipment?shipment_id=XXXXXX
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sid = searchParams.get("shipment_id");
  if (!sid) return NextResponse.json({ error: "shipment_id requerido" }, { status: 400 });

  const supabase = getSupabase();
  const { data: accounts } = await supabase
    .from("meli_accounts")
    .select("id, meli_user_id, nickname, access_token_enc, refresh_token_enc, expires_at, status")
    .eq("status", "active");

  if (!accounts?.length) return NextResponse.json({ error: "Sin cuentas activas" });

  const results = [];
  for (const acc of accounts) {
    const token = await getValidToken(acc as MeliAccount);
    if (!token) { results.push({ account: acc.nickname, error: "token inválido" }); continue; }
    try {
      const detail = await meliGet(`/shipments/${sid}`, token);
      results.push({
        account: acc.nickname,
        shipment_id: sid,
        logistic_type: (detail as Record<string, unknown>)?.logistic_type,
        mode:          (detail as Record<string, unknown>)?.mode,
        status:        (detail as Record<string, unknown>)?.status,
        substatus:     (detail as Record<string, unknown>)?.substatus,
        tracking_number: (detail as Record<string, unknown>)?.tracking_number,
        tracking_id:   (detail as Record<string, unknown>)?.tracking_id,
        tags:          (detail as Record<string, unknown>)?.tags,
        raw:           detail,
      });
    } catch (e) {
      results.push({ account: acc.nickname, error: (e as Error).message });
    }
  }
  return NextResponse.json(results);
}
