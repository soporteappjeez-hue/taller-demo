import { NextResponse } from "next/server";
import { getActiveAccountsForUser, getValidToken, meliGet, getAuthenticatedUserId, LinkedMeliAccount } from "@/lib/meli";
import { createClient } from "@supabase/supabase-js";

export const dynamic  = "force-dynamic";
export const revalidate = 0;

// Formato simple para selector de publicaciones
async function getSimplePublications(accountId: string, limit: number, status: string, userId: string) {
  const accounts = await getActiveAccountsForUser(userId);
  const account = accounts.find(a => String(a.meli_user_id) === accountId);
  if (!account) return null;

  const token = await getValidToken(account);
  if (!token) return null;

  const searchData = await meliGet(
    `/users/${account.meli_user_id}/items/search?status=${status}&limit=${Math.min(limit, 100)}`,
    token
  ) as { results?: string[]; paging?: { total: number } } | null;

  const itemIds = searchData?.results ?? [];
  if (!itemIds.length) return { publications: [], total: 0, account: account.meli_nickname };

  // Obtener detalles en lotes de 20
  const publications: Array<{
    id: string;
    title: string;
    price: number;
    permalink: string;
    status: string;
    thumbnail?: string;
  }> = [];

  for (let i = 0; i < itemIds.length; i += 20) {
    const batch = itemIds.slice(i, i + 20);
    const data = await meliGet(
      `/items?ids=${batch.join(",")}&attributes=id,title,price,status,permalink,thumbnail`,
      token
    ) as Array<{ code: number; body: Record<string, unknown> }> | null;

    const items = (data ?? [])
      .filter(entry => entry.code === 200 && entry.body)
      .map(entry => entry.body);

    publications.push(...items.map(item => ({
      id: String(item.id),
      title: String(item.title),
      price: Number(item.price),
      permalink: String(item.permalink),
      status: String(item.status),
      thumbnail: String(item.thumbnail ?? "").replace("http://", "https://"),
    })));
  }

  return {
    ok: true,
    publications,
    total: searchData?.paging?.total ?? publications.length,
    account: account.meli_nickname,
  };
}

export async function GET(req: Request) {
  // Verificar usuario autenticado
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("account_id");
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const status = searchParams.get("status") ?? "active";
  const format = searchParams.get("format") ?? "detailed"; // "simple" o "detailed"

  // Si se pide formato simple, usar el nuevo método
  if (format === "simple" && accountId) {
    const result = await getSimplePublications(accountId, limit, status, userId);
    if (!result) {
      return NextResponse.json({ error: "Cuenta no encontrada o token inválido" }, { status: 404 });
    }
    return NextResponse.json(result);
  }

  try {
    let accounts = await getActiveAccountsForUser(userId);
    if (accountId) accounts = accounts.filter(a => a.id === accountId);
    if (!accounts.length) return NextResponse.json([]);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = supabaseUrl && serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey)
      : null;

    const results = await Promise.all(accounts.map(async (acc) => {
      try {
        const uid = String(acc.meli_user_id);

        // Intentar leer desde Supabase primero (cache)
        let items: any[] = [];
        let total = 0;
        let cached_at: string | null = null;

        if (supabase) {
          const { data, error } = await supabase
            .from("products_cache")
            .select("*", { count: "exact" })
            .eq("meli_user_id", uid)
            .order("last_updated", { ascending: false })
            .range(offset, offset + limit - 1);

          if (!error && data) {
            items = data;
            // Obtener el total sin limit
            const { count } = await supabase
              .from("products_cache")
              .select("*", { count: "exact", head: true })
              .eq("meli_user_id", uid);
            total = count ?? 0;
            cached_at = new Date().toISOString();
          } else {
            // Si hay error en Supabase, intentar fallback a MeLi
            console.warn(`[meli-publications] Supabase read failed for ${acc.meli_nickname}, falling back to MeLi`);
            items = [];
          }
        }

        // Si no hay datos en cache, sincronizar desde MeLi
        if (items.length === 0) {
          console.log(`[meli-publications] Syncing from MeLi for ${acc.meli_nickname}`);
          const token = await getValidToken(acc);
          if (!token) {
            return { account: acc.meli_nickname, meli_user_id: uid, items: [], total: 0, error: "token_expired" };
          }

          const searchData = await meliGet(
            `/users/${uid}/items/search?status=active&limit=100`,
            token
          );
          const itemIds: string[] = searchData?.results ?? [];

          if (!itemIds.length) {
            return { account: acc.meli_nickname, meli_user_id: uid, items: [], total: 0 };
          }

          const chunks: string[][] = [];
          for (let i = 0; i < itemIds.length; i += 20) {
            chunks.push(itemIds.slice(i, i + 20));
          }

          const allItems: object[] = [];
          await Promise.all(chunks.map(async (chunk) => {
            const data = await meliGet(`/items?ids=${chunk.join(",")}&attributes=id,title,price,currency_id,available_quantity,sold_quantity,thumbnail,status,permalink,logistic_type`, token);
            const list = (data ?? []) as Array<{ code: number; body: Record<string, unknown> }>;
            for (const entry of list) {
              if (entry.code === 200 && entry.body) {
                const b = entry.body;
                allItems.push({
                  id:                 b.id,
                  title:              b.title,
                  price:              b.price,
                  currency_id:        b.currency_id ?? "ARS",
                  available_quantity: b.available_quantity ?? 0,
                  sold_quantity:      b.sold_quantity ?? 0,
                  thumbnail:          (b.thumbnail as string | undefined)?.replace("http://", "https://") ?? null,
                  secure_thumbnail:   (b.thumbnail as string | undefined)?.replace("http://", "https://") ?? null,
                  status:             b.status,
                  permalink:          b.permalink,
                  logistic_type:      b.logistic_type ?? "not_specified",
                });
              }
            }
          }));

          allItems.sort((a, b) => {
            const as = (a as { sold_quantity: number }).sold_quantity;
            const bs = (b as { sold_quantity: number }).sold_quantity;
            return bs - as;
          });

          items = allItems.slice(offset, offset + limit);
          total = allItems.length;

          // Guardar en Supabase para futuro cache (async, no esperar)
          if (supabase) {
            const productsToCache = allItems.map(item => ({
              id: (item as any).id,
              meli_user_id: uid,
              account_name: acc.meli_nickname,
              title: (item as any).title,
              price: (item as any).price,
              currency_id: (item as any).currency_id,
              available_quantity: (item as any).available_quantity,
              sold_quantity: (item as any).sold_quantity,
              thumbnail: (item as any).thumbnail,
              secure_thumbnail: (item as any).secure_thumbnail,
              status: (item as any).status,
              permalink: (item as any).permalink,
              logistic_type: (item as any).logistic_type,
              last_updated: new Date().toISOString(),
              synced_at: new Date().toISOString(),
            }));
            (async () => {
              try {
                await supabase
                  .from("products_cache")
                  .upsert(productsToCache, { onConflict: "id" });
                console.log(`[meli-publications] Cached ${productsToCache.length} items for ${acc.meli_nickname}`);
              } catch (e) {
                console.error(`[meli-publications] Cache error:`, e);
              }
            })();
          }
        }

        return {
          account:      acc.meli_nickname,
          meli_user_id: uid,
          items:        items,
          total:        total,
          cached_at:    cached_at,
        };
      } catch (e) {
        return {
          account:      acc.meli_nickname,
          meli_user_id: String(acc.meli_user_id),
          items:        [],
          total:        0,
          error:        (e as Error).message,
        };
      }
    }));

    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
