import { NextResponse } from "next/server";
import { getSupabase, getValidToken, meliGet, MeliAccount } from "@/lib/meli";

export const dynamic = "force-dynamic";

interface CategoryOption {
  id:    string;
  name:  string;
  count: number;
}

async function getFacets(userId: string, token: string, status: string): Promise<CategoryOption[]> {
  const data = await meliGet(
    `/users/${userId}/items/search?status=${status}&limit=1&facets=category`,
    token
  );
  if (!data) return [];
  const facets = (data.facets ?? []) as Array<{ id: string; values?: Array<{ id: string; name: string; results: number }> }>;
  const catFacet = facets.find(f => f.id === "category");
  if (!catFacet?.values) return [];
  return catFacet.values.map(v => ({ id: v.id, name: v.name, count: v.results }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("account_id");
  if (!accountId) return NextResponse.json({ error: "account_id requerido" }, { status: 400 });

  try {
    const supabase = getSupabase();
    const { data: acc } = await supabase
      .from("meli_accounts")
      .select("id, meli_user_id, nickname, access_token_enc, refresh_token_enc, expires_at, status")
      .eq("id", accountId)
      .eq("status", "active")
      .single();

    if (!acc) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });

    const token = await getValidToken(acc as MeliAccount);
    if (!token) return NextResponse.json({ error: "Token expirado, reconectá la cuenta" }, { status: 401 });

    const userId = String(acc.meli_user_id);

    // Get facets for active + paused — merge counts
    const [activeCategories, pausedCategories] = await Promise.all([
      getFacets(userId, token, "active"),
      getFacets(userId, token, "paused"),
    ]);

    const merged = new Map<string, CategoryOption>();
    for (const c of [...activeCategories, ...pausedCategories]) {
      if (merged.has(c.id)) {
        merged.get(c.id)!.count += c.count;
      } else {
        merged.set(c.id, { ...c });
      }
    }

    const result = Array.from(merged.values()).sort((a, b) => b.count - a.count);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
