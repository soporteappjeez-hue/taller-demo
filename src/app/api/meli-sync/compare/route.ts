import { NextResponse } from "next/server";
import { getSupabase, getValidToken, meliGet, MeliAccount } from "@/lib/meli";

export const dynamic  = "force-dynamic";
export const revalidate = 0;

async function getAllItemIds(
  userId: string,
  token: string,
  status: string,
  categoryId?: string
): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;
  const limit = 100;
  const maxItems = 2000;
  const catParam = categoryId ? `&category=${categoryId}` : "";
  while (offset < maxItems) {
    const data = await meliGet(
      `/users/${userId}/items/search?status=${status}&limit=${limit}&offset=${offset}${catParam}`,
      token
    );
    const results = (data?.results ?? []) as string[];
    if (!results.length) break;
    ids.push(...results);
    const total = (data?.paging?.total as number | undefined) ?? results.length;
    offset += limit;
    if (offset >= total) break;
    await new Promise(r => setTimeout(r, 150));
  }
  return ids;
}

async function getAccountItems(
  userId: string,
  token: string,
  categoryIds?: string[]
) {
  let ids: string[];
  if (categoryIds && categoryIds.length > 0) {
    // Fetch each category in parallel (MeLi only supports 1 category filter at a time)
    const perCatIds = await Promise.all(
      categoryIds.flatMap(catId => [
        getAllItemIds(userId, token, "active", catId),
        getAllItemIds(userId, token, "paused", catId),
      ])
    );
    const merged = new Set<string>(perCatIds.flat());
    ids = Array.from(merged);
  } else {
    const [activeIds, pausedIds] = await Promise.all([
      getAllItemIds(userId, token, "active"),
      getAllItemIds(userId, token, "paused"),
    ]);
    ids = [...activeIds, ...pausedIds];
  }
  if (!ids.length) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 20) chunks.push(ids.slice(i, i + 20));

  const items: object[] = [];
  for (const chunk of chunks) {
    const data = await meliGet(
      `/items?ids=${chunk.join(",")}&attributes=id,title,price,currency_id,available_quantity,sold_quantity,thumbnail,status,permalink,category_id,condition,listing_type_id,logistic_type`,
      token
    );
    const list = (data ?? []) as Array<{ code: number; body: Record<string, unknown> }>;
    for (const entry of list) {
      if (entry.code === 200 && entry.body) {
        const b = entry.body;
        items.push({
          id: b.id, title: b.title, price: b.price,
          currency_id: b.currency_id ?? "ARS",
          available_quantity: b.available_quantity ?? 0,
          sold_quantity: b.sold_quantity ?? 0,
          thumbnail: (b.thumbnail as string | undefined)?.replace("http://", "https://") ?? null,
          status: b.status, permalink: b.permalink,
          category_id: b.category_id, condition: b.condition,
          listing_type_id: b.listing_type_id, logistic_type: b.logistic_type,
        });
      }
    }
    if (chunks.length > 3) await new Promise(r => setTimeout(r, 200));
  }
  return items;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const originId   = searchParams.get("origin_id");
  const destId     = searchParams.get("dest_id");
  const categoryIdsParam = searchParams.get("category_ids"); // comma-separated
  const categoryIds = categoryIdsParam ? categoryIdsParam.split(",").filter(Boolean) : undefined;

  if (!originId || !destId) {
    return NextResponse.json({ error: "origin_id y dest_id son requeridos" }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const { data: accounts } = await supabase
      .from("meli_accounts")
      .select("id, meli_user_id, nickname, access_token_enc, refresh_token_enc, expires_at, status")
      .in("id", [originId, destId])
      .eq("status", "active");

    if (!accounts || accounts.length < 2) {
      return NextResponse.json({ error: "No se encontraron las dos cuentas activas" }, { status: 404 });
    }

    const origin = accounts.find(a => a.id === originId)! as MeliAccount;
    const dest   = accounts.find(a => a.id === destId)! as MeliAccount;

    const [originToken, destToken] = await Promise.all([
      getValidToken(origin),
      getValidToken(dest),
    ]);

    if (!originToken || !destToken) {
      return NextResponse.json({ error: "Token expirado en una de las cuentas, reconecta" }, { status: 401 });
    }

    // Origin: filtered by selected categories. Dest: always full (for dedup check)
    const [originItems, destItems] = await Promise.all([
      getAccountItems(String(origin.meli_user_id), originToken, categoryIds),
      getAccountItems(String(dest.meli_user_id), destToken),
    ]);

    // Fetch category names for origin items (batch by unique category_ids)
    const categoryNames = new Map<string, string>();
    const uniqueCatIds = Array.from(new Set((originItems as Array<{ category_id?: string }>).map(i => i.category_id).filter(Boolean))) as string[];
    if (uniqueCatIds.length > 0) {
      try {
        const catData = await meliGet(`/categories?ids=${uniqueCatIds.join(",")}`, originToken);
        const list = (Array.isArray(catData) ? catData : []) as Array<{ code?: number; body?: { id: string; name: string } } | { id?: string; name?: string }>;
        for (const entry of list) {
          // Handle both multi-get format and single object
          const id   = (entry as Record<string, unknown>).id as string | undefined
                    ?? ((entry as Record<string, unknown>).body as Record<string, unknown> | undefined)?.id as string | undefined;
          const name = (entry as Record<string, unknown>).name as string | undefined
                    ?? ((entry as Record<string, unknown>).body as Record<string, unknown> | undefined)?.name as string | undefined;
          if (id && name) categoryNames.set(id, name);
        }
      } catch { /* category names are optional */ }
    }

    const destTitlesNorm = new Set(
      (destItems as Array<{ title: string }>).map(i => i.title.toLowerCase().trim())
    );

    type OriginItem = { id: string; title: string; available_quantity: number; category_id?: string; [k: string]: unknown };
    const canClone:      OriginItem[] = [];
    const alreadyExists: OriginItem[] = [];

    for (const item of originItems as OriginItem[]) {
      const normTitle = item.title.toLowerCase().trim();
      const enriched  = { ...item, category_name: categoryNames.get(item.category_id ?? "") ?? item.category_id ?? "" };
      if (destTitlesNorm.has(normTitle)) {
        alreadyExists.push(enriched);
      } else {
        canClone.push(enriched);
      }
    }

    return NextResponse.json({
      origin: { id: originId, nickname: origin.nickname, total: originItems.length },
      dest:   { id: destId,   nickname: dest.nickname,   total: destItems.length },
      can_clone:      canClone,
      already_exists: alreadyExists,
      filter_applied: categoryIds ? { category_ids: categoryIds, count: originItems.length } : null,
      summary: {
        origin_total:   originItems.length,
        dest_total:     destItems.length,
        can_clone:      canClone.length,
        already_exists: alreadyExists.length,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
