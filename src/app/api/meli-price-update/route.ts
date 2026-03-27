import { getSupabase, getActiveAccounts, getValidToken } from "@/lib/meli";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

type AdjustmentType = "percentage" | "fixed_floor" | "fixed_add";

/* ── Helpers ─────────────────────────────────────────────────────── */
function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function isExcluded(normTitle: string, excludeNorm: string[]): string | null {
  for (const word of excludeNorm) {
    if (!word) continue;
    // Busca la palabra como token completo (ignora mayúsculas/tildes)
    const rx = new RegExp(`(^|\\s|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s|[^a-z0-9])`);
    if (rx.test(` ${normTitle} `)) return word;
  }
  return null;
}

function computeNewPrice(currentPrice: number, type: AdjustmentType, value: number): number {
  let result: number;
  switch (type) {
    case "percentage":  result = currentPrice * (1 + value / 100); break;
    case "fixed_floor": result = currentPrice < value ? value : currentPrice; break;
    case "fixed_add":   result = currentPrice + value; break;
    default:            result = currentPrice;
  }
  return Math.round(result * 100) / 100;
}

function shouldUpdate(currentPrice: number, newPrice: number, type: AdjustmentType): boolean {
  if (type === "fixed_floor") return currentPrice < newPrice;
  return Math.abs(newPrice - currentPrice) >= 0.01;
}

async function meliPut(path: string, token: string, body: unknown, signal?: AbortSignal) {
  try {
    const res = await fetch(`https://api.mercadolibre.com${path}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(15000),
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  } catch (e) {
    return { ok: false, status: 0, data: { message: (e as Error).message } };
  }
}

async function meliGetWithRetry(path: string, token: string, signal?: AbortSignal, retries = 3): Promise<unknown> {
  for (let attempt = 0; attempt < retries; attempt++) {
    if (signal?.aborted) return null;
    try {
      const res = await fetch(`https://api.mercadolibre.com${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 429) { await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); continue; }
      if (!res.ok) return null;
      return res.json();
    } catch {
      if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

async function fetchIdsByStatus(userId: string, token: string, status: string, signal?: AbortSignal): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;
  const limit = 100;
  const first = await meliGetWithRetry(
    `/users/${userId}/items/search?status=${status}&limit=${limit}&offset=0`, token, signal
  ) as { results?: string[]; paging?: { total?: number } } | null;
  if (!first?.results?.length) return ids;
  ids.push(...first.results);
  const total = first.paging?.total ?? first.results.length;
  while (offset + limit < total && offset < 10000 && !signal?.aborted) {
    offset += limit;
    const page = await meliGetWithRetry(
      `/users/${userId}/items/search?status=${status}&limit=${limit}&offset=${offset}`, token, signal
    ) as { results?: string[] } | null;
    if (!page?.results?.length) break;
    ids.push(...page.results);
    await new Promise(r => setTimeout(r, 180));
  }
  return ids;
}

async function getAllItemIds(userId: string, token: string, signal?: AbortSignal): Promise<string[]> {
  // Busca en TODOS los estados para no perder ninguna publicación
  const statuses = ["active", "paused", "under_review", "not_yet_active"];
  const arrays = await Promise.all(statuses.map(s => fetchIdsByStatus(userId, token, s, signal)));
  const seen = new Set<string>();
  const all: string[] = [];
  for (const arr of arrays) {
    for (const id of arr) {
      if (!seen.has(id)) { seen.add(id); all.push(id); }
    }
  }
  return all;
}

interface ItemDetail {
  id: string; title: string; price: number;
  catalog_listing?: boolean; catalog_product_id?: string;
  deal_ids?: string[];
  variations?: Array<{ id: number; price: number; [k: string]: unknown }>;
}

/* ── SSE helper ──────────────────────────────────────────────────── */
function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/* ── POST handler ────────────────────────────────────────────────── */
export async function POST(req: Request) {
  const body = await req.json() as {
    keyword: string;
    exclude_words?: string;
    adjustment_type: AdjustmentType;
    adjustment_value: number;
    dry_run?: boolean;
    account_ids?: string[];
    clear_cache?: boolean;
    // legacy
    target_price?: number;
  };

  let { keyword, adjustment_type, adjustment_value, dry_run = false, account_ids, clear_cache = false } = body;
  const excludeRaw = body.exclude_words ?? "";

  if (!adjustment_type && body.target_price) {
    adjustment_type = "fixed_floor";
    adjustment_value = body.target_price;
  }

  if (!keyword?.trim()) {
    return new Response(sse({ type: "error", message: "keyword es requerida" }), { status: 400, headers: { "Content-Type": "text/event-stream" } });
  }

  const normKeyword  = normalize(keyword);
  const excludeNorm  = excludeRaw.split(",").map(w => normalize(w)).filter(Boolean);
  const supabase = getSupabase();

  if (clear_cache) {
    await supabase.from("items_keyword_cache").delete().eq("keyword", normKeyword);
  }

  let accounts = await getActiveAccounts();
  if (account_ids?.length) {
    accounts = accounts.filter(a => account_ids!.includes(String(a.meli_user_id)));
  }

  const abortCtrl = new AbortController();
  const signal = abortCtrl.signal;

  // Si el cliente cierra la conexión → abortar
  req.signal?.addEventListener("abort", () => abortCtrl.abort());

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const send = async (data: unknown) => {
    try { await writer.write(encoder.encode(sse(data))); } catch { /* stream closed */ }
  };

  /* ── Proceso principal en background ─────────────────────────── */
  (async () => {
    const results: unknown[] = [];
    let totalScanned = 0;
    let cacheHits = 0;
    let processed = 0;
    let stopped = false;

    try {
      const { data: cachedRows } = await supabase
        .from("items_keyword_cache")
        .select("item_id, contains_match")
        .eq("keyword", normKeyword);
      const cacheMap = new Map<string, boolean>();
      for (const row of cachedRows ?? []) cacheMap.set(row.item_id, row.contains_match);

      for (const acc of accounts) {
        if (signal.aborted) { stopped = true; break; }

        const token = await getValidToken(acc);
        if (!token) {
          await send({ type: "account_skip", account: acc.nickname, reason: "token_expired" });
          continue;
        }

        await send({ type: "account_start", account: acc.nickname });

        const [activeIds] = await Promise.all([
          getAllItemIds(String(acc.meli_user_id), token, signal),
        ]);
        const allIds = activeIds;
        totalScanned += allIds.length;

        const idsToCheck = allIds.filter(id => {
          if (cacheMap.get(id) === false) { cacheHits++; return false; }
          return true;
        });

        const total = idsToCheck.length;
        await send({ type: "account_total", account: acc.nickname, total, totalScanned });

        const newCacheRows: Array<{ item_id: string; keyword: string; contains_match: boolean; last_price: number | null; checked_at: string }> = [];

        for (let i = 0; i < idsToCheck.length; i += 20) {
          if (signal.aborted) { stopped = true; break; }

          const chunk = idsToCheck.slice(i, i + 20);
          const data = await meliGetWithRetry(
            `/items?ids=${chunk.join(",")}&attributes=id,title,price,catalog_listing,catalog_product_id,deal_ids,variations`,
            token, signal
          );
          if (!data) { await new Promise(r => setTimeout(r, 500)); continue; }

          const list = (data as Array<{ code: number; body: ItemDetail }>) ?? [];

          for (const entry of list) {
            if (signal.aborted) { stopped = true; break; }
            if (entry.code !== 200 || !entry.body) continue;

            const item = entry.body;
            processed++;
            const normTitle = normalize(item.title);
            const matches = normTitle.includes(normKeyword);

            if (!matches) {
              newCacheRows.push({ item_id: item.id, keyword: normKeyword, contains_match: false, last_price: item.price, checked_at: new Date().toISOString() });
              await send({ type: "progress", current: processed, total, item_id: item.id, title: item.title, status: "no_match", account: acc.nickname });
              continue;
            }

            // Filtro excluyentes
            const excludedBy = isExcluded(normTitle, excludeNorm);
            if (excludedBy) {
              newCacheRows.push({ item_id: item.id, keyword: normKeyword, contains_match: true, last_price: item.price, checked_at: new Date().toISOString() });
              await send({ type: "progress", current: processed, total, item_id: item.id, title: item.title, status: "excluded", excluded_by: excludedBy, account: acc.nickname });
              results.push({ account: acc.nickname, item_id: item.id, title: item.title, old_price: item.price, new_price: item.price, status: "excluded", reason: `Excluido por: "${excludedBy}"` });
              continue;
            }

            newCacheRows.push({ item_id: item.id, keyword: normKeyword, contains_match: true, last_price: item.price, checked_at: new Date().toISOString() });

            const isCatalog = !!(item.catalog_listing || item.catalog_product_id);
            const hasPromo  = Array.isArray(item.deal_ids) && item.deal_ids.length > 0;

            // Calcular nuevo precio (soporta variaciones)
            const baseNew = computeNewPrice(item.price, adjustment_type, adjustment_value);
            const needsBase = shouldUpdate(item.price, baseNew, adjustment_type);

            if (item.variations?.length) {
              const updatedVars = item.variations.map(v => ({
                ...v, price: computeNewPrice(v.price, adjustment_type, adjustment_value),
              }));
              const varsToUpdate = updatedVars.filter((v, idx) =>
                shouldUpdate(item.variations![idx].price, v.price, adjustment_type)
              );

              if (!needsBase && varsToUpdate.length === 0) {
                await send({ type: "progress", current: processed, total, item_id: item.id, title: item.title, status: "skipped", account: acc.nickname });
                results.push({ account: acc.nickname, item_id: item.id, title: item.title, old_price: item.price, new_price: item.price, status: "skipped", reason: "Ya cumple la condición" });
                continue;
              }

              await send({ type: "progress", current: processed, total, item_id: item.id, title: item.title, status: dry_run ? "would_update" : "updating", old_price: item.price, new_price: baseNew, account: acc.nickname });

              if (!dry_run) {
                const putBody: Record<string, unknown> = { variations: updatedVars.map(v => ({ id: v.id, price: v.price })) };
                if (needsBase) putBody.price = baseNew;
                const putRes = await meliPut(`/items/${item.id}`, token, putBody, signal);
                const status = putRes.ok ? (isCatalog ? "catalog_warning" : "updated") : (hasPromo ? "promo_blocked" : "error");
                results.push({ account: acc.nickname, item_id: item.id, title: item.title, old_price: item.price, new_price: baseNew, status, reason: putRes.ok ? (isCatalog ? "Verificar Buy Box" : undefined) : (putRes.data as Record<string,unknown>)?.message, variations_updated: varsToUpdate.length });
              } else {
                results.push({ account: acc.nickname, item_id: item.id, title: item.title, old_price: item.price, new_price: baseNew, status: isCatalog ? "catalog_warning" : "updated", variations_updated: varsToUpdate.length });
              }
            } else {
              if (!needsBase) {
                await send({ type: "progress", current: processed, total, item_id: item.id, title: item.title, status: "skipped", account: acc.nickname });
                results.push({ account: acc.nickname, item_id: item.id, title: item.title, old_price: item.price, new_price: item.price, status: "skipped", reason: "Ya cumple la condición" });
                continue;
              }

              await send({ type: "progress", current: processed, total, item_id: item.id, title: item.title, status: dry_run ? "would_update" : "updating", old_price: item.price, new_price: baseNew, account: acc.nickname });

              if (!dry_run) {
                const putRes = await meliPut(`/items/${item.id}`, token, { price: baseNew }, signal);
                const status = putRes.ok ? (isCatalog ? "catalog_warning" : "updated") : (hasPromo ? "promo_blocked" : "error");
                results.push({ account: acc.nickname, item_id: item.id, title: item.title, old_price: item.price, new_price: baseNew, status, reason: putRes.ok ? (isCatalog ? "Verificar Buy Box" : undefined) : (putRes.data as Record<string,unknown>)?.message });
              } else {
                results.push({ account: acc.nickname, item_id: item.id, title: item.title, old_price: item.price, new_price: baseNew, status: isCatalog ? "catalog_warning" : "updated" });
              }
            }

            await new Promise(r => setTimeout(r, 220));
          }

          // Guardar caché en batch
          if (newCacheRows.length >= 100) {
            await supabase.from("items_keyword_cache").upsert(newCacheRows, { onConflict: "item_id,keyword" });
            newCacheRows.length = 0;
          }
          await new Promise(r => setTimeout(r, 200));
        }

        if (newCacheRows.length > 0) {
          await supabase.from("items_keyword_cache").upsert(newCacheRows, { onConflict: "item_id,keyword" });
        }

        if (stopped) break;
      }
    } catch (e) {
      await send({ type: "error", message: (e as Error).message });
    }

    const updated  = (results as Array<{ status: string }>).filter(r => r.status === "updated" || r.status === "catalog_warning").length;
    const skipped  = (results as Array<{ status: string }>).filter(r => r.status === "skipped").length;
    const excluded = (results as Array<{ status: string }>).filter(r => r.status === "excluded").length;
    const errors   = (results as Array<{ status: string }>).filter(r => r.status === "error" || r.status === "promo_blocked").length;

    await send({
      type: stopped ? "stopped" : "done",
      keyword,
      adjustment_type,
      adjustment_value,
      dry_run,
      results,
      summary: {
        total_items_scanned: totalScanned,
        cache_hits_skipped: cacheHits,
        matched: results.length,
        updated, skipped, excluded, errors,
        stopped,
      },
    });

    await writer.close();
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
    },
  });
}
