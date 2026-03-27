import { NextResponse } from "next/server";
import { getSupabase, getValidToken, meliGet, MeliAccount } from "@/lib/meli";

export const dynamic  = "force-dynamic";
export const revalidate = 0;

async function meliPost(path: string, token: string, body: unknown) {
  try {
    const res = await fetch(`https://api.mercadolibre.com${path}`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(20000),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { message: (e as Error).message } };
  }
}

interface CloneRequest {
  origin_id: string;
  dest_id:   string;
  item_ids:  string[];
}

export async function POST(req: Request) {
  let body: CloneRequest;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON invalido" }, { status: 400 }); }

  const { origin_id, dest_id, item_ids } = body;
  if (!origin_id || !dest_id || !item_ids?.length) {
    return NextResponse.json({ error: "origin_id, dest_id y item_ids son requeridos" }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const { data: accounts } = await supabase
      .from("meli_accounts")
      .select("id, meli_user_id, nickname, access_token_enc, refresh_token_enc, expires_at, status")
      .in("id", [origin_id, dest_id])
      .eq("status", "active");

    if (!accounts || accounts.length < 2) {
      return NextResponse.json({ error: "Cuentas no encontradas o inactivas" }, { status: 404 });
    }

    const origin = accounts.find(a => a.id === origin_id)! as MeliAccount;
    const dest   = accounts.find(a => a.id === dest_id)! as MeliAccount;

    const [originToken, destToken] = await Promise.all([
      getValidToken(origin),
      getValidToken(dest),
    ]);

    if (!originToken || !destToken) {
      return NextResponse.json({ error: "Token expirado, reconecta las cuentas" }, { status: 401 });
    }

    const getAllIds = async (userId: string, token: string, status: string): Promise<string[]> => {
      const ids: string[] = [];
      let offset = 0;
      while (offset < 2000) {
        const d = await meliGet(`/users/${userId}/items/search?status=${status}&limit=100&offset=${offset}`, token);
        const r = (d?.results ?? []) as string[];
        if (!r.length) break;
        ids.push(...r);
        const total = (d?.paging?.total as number | undefined) ?? r.length;
        offset += 100;
        if (offset >= total) break;
      }
      return ids;
    };
    const [dActive, dPaused] = await Promise.all([
      getAllIds(String(dest.meli_user_id), destToken, "active"),
      getAllIds(String(dest.meli_user_id), destToken, "paused"),
    ]);
    const destIds = [...dActive, ...dPaused];
    const destTitlesNorm = new Set<string>();
    for (let i = 0; i < destIds.length; i += 20) {
      const chunk = destIds.slice(i, i + 20);
      const data  = await meliGet(`/items?ids=${chunk.join(",")}&attributes=title`, destToken);
      const list  = (data ?? []) as Array<{ code: number; body: { title: string } }>;
      for (const e of list) {
        if (e.code === 200) destTitlesNorm.add(e.body.title.toLowerCase().trim());
      }
    }

    const results: Array<{
      item_id: string;
      title:   string;
      status:  "cloned" | "skipped_duplicate" | "error";
      new_id?: string;
      reason?: string;
    }> = [];

    for (const itemId of item_ids.slice(0, 100)) {
      try {
        const itemRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
          headers: { Authorization: `Bearer ${originToken}` },
          signal:  AbortSignal.timeout(12000),
        });
        if (!itemRes.ok) {
          results.push({ item_id: itemId, title: itemId, status: "error", reason: `HTTP ${itemRes.status} al obtener item` });
          continue;
        }
        const item  = await itemRes.json() as Record<string, unknown>;
        const title = (item.title as string) ?? "";

        if (destTitlesNorm.has(title.toLowerCase().trim())) {
          results.push({ item_id: itemId, title, status: "skipped_duplicate", reason: "Titulo ya existe en destino" });
          continue;
        }

        const pictures = (item.pictures as Array<{ id?: string; url?: string; secure_url?: string }> | undefined) ?? [];
        const picturePayload = pictures.slice(0, 12).map(p => {
          const url = (p.secure_url ?? p.url ?? "").replace("http://", "https://");
          return { source: url };
        }).filter(p => p.source);

        const newItem: Record<string, unknown> = {
          title:              item.title,
          category_id:        item.category_id,
          price:              item.price,
          currency_id:        item.currency_id ?? "ARS",
          available_quantity: (item.available_quantity as number) > 0 ? item.available_quantity : 1,
          buying_mode:        item.buying_mode ?? "buy_it_now",
          condition:          item.condition ?? "new",
          listing_type_id:    item.listing_type_id ?? "gold_special",
        };

        // family_name NO se incluye — MeLi lo rechaza con "field invalid" en la cuenta destino

        const shipping = item.shipping as Record<string, unknown> | undefined;
        if (shipping) {
          const shippingPayload: Record<string, unknown> = {};
          if (shipping.mode)             shippingPayload.mode           = shipping.mode;
          if (shipping.local_pick_up !== undefined) shippingPayload.local_pick_up = shipping.local_pick_up;
          if (shipping.free_shipping !== undefined) shippingPayload.free_shipping = shipping.free_shipping;
          if (Array.isArray(shipping.methods) && (shipping.methods as unknown[]).length) {
            shippingPayload.methods = shipping.methods;
          }
          if (Object.keys(shippingPayload).length) newItem.shipping = shippingPayload;
        }

        const blockedTerms = new Set(["INSTALLMENTS_CAMPAIGN","INSTALLMENTS","FINANCING"]);
        const rawSaleTerms = (item.sale_terms as Array<Record<string, unknown>> | undefined) ?? [];
        const allowedTerms = rawSaleTerms
          .filter(t => t.id && !blockedTerms.has(String(t.id)))
          .map(t => {
            const term: Record<string, unknown> = { id: t.id };
            if (t.value_id)   term.value_id   = t.value_id;
            if (t.value_name) term.value_name = t.value_name;
            return term;
          });
        if (allowedTerms.length) {
          newItem.sale_terms = allowedTerms;
        } else {
          newItem.sale_terms = [
            { id: "WARRANTY_TYPE",  value_name: "Garantia del vendedor" },
            { id: "WARRANTY_TIME",  value_name: "90 dias" },
          ];
        }

        if (picturePayload.length) newItem.pictures = picturePayload;

        const catAttrsData = await meliGet(`/categories/${item.category_id}/attributes`, originToken);
        const requiredAttrIds = new Set<string>(
          ((catAttrsData ?? []) as Array<{ id: string; tags?: { required?: boolean } }>)
            .filter(a => a.tags?.required)
            .map(a => a.id)
        );

        const rawAttrs = (item.attributes as Array<Record<string, unknown>> | undefined) ?? [];
        const readonlyIds = new Set(["ITEM_CONDITION","SELLER_SKU"]);
        const safeAttrs = rawAttrs
          .filter(a => a.id && !readonlyIds.has(String(a.id)))
          .map(a => {
            const attr: Record<string, unknown> = { id: a.id };
            if (a.value_id)   attr.value_id   = a.value_id;
            if (a.value_name) attr.value_name = a.value_name;
            if (a.value_struct) attr.value_struct = a.value_struct;
            if (Array.isArray(a.values) && (a.values as unknown[]).length) {
              attr.value_id   = (a.values as Array<{ id?: string; name?: string }>)[0]?.id   ?? a.value_id;
              attr.value_name = (a.values as Array<{ id?: string; name?: string }>)[0]?.name ?? a.value_name;
            }
            return attr;
          })
          .filter(a => a.value_id || a.value_name || a.value_struct);

        const coveredIds = new Set(safeAttrs.map(a => String(a.id)));
        const missingRequired = Array.from(requiredAttrIds).filter(id => !coveredIds.has(id));
        for (const missingId of missingRequired) {
          safeAttrs.push({ id: missingId, value_name: "Does not apply" });
        }

        if (safeAttrs.length) newItem.attributes = safeAttrs;

        let postRes = await meliPost("/items", destToken, newItem);

        if (!postRes.ok) {
          const errStr = JSON.stringify(postRes.data ?? {});
          // Retry sin título si MeLi lo rechaza
          if (errStr.includes("title") && errStr.includes("invalid")) {
            delete newItem.title;
            postRes = await meliPost("/items", destToken, newItem);
          }
        }

        if (postRes.ok) {
          const newId = (postRes.data as Record<string, unknown>)?.id as string;
          destTitlesNorm.add(title.toLowerCase().trim());

          const descData = await meliGet(`/items/${itemId}/description`, originToken);
          const plainText = (descData?.plain_text as string | undefined) ?? "";
          if (plainText && newId) {
            await meliPost(`/items/${newId}/description`, destToken, { plain_text: plainText });
          }

          results.push({ item_id: itemId, title, status: "cloned", new_id: newId });
        } else {
          const d = postRes.data as Record<string, unknown>;
          // Extraer mensaje de error legible desde la respuesta de MeLi
          const causes = (d?.cause ?? []) as Array<Record<string, unknown>>;
          const causeMsg = causes.length
            ? causes.map(c => c.description ?? c.message ?? c.code ?? JSON.stringify(c)).join("; ")
            : (d?.message as string | undefined) ?? `HTTP ${postRes.status}`;
          results.push({ item_id: itemId, title, status: "error", reason: causeMsg });
        }

        await new Promise(r => setTimeout(r, 250));

      } catch (e) {
        results.push({ item_id: itemId, title: itemId, status: "error", reason: (e as Error).message });
      }
    }

    const cloned  = results.filter(r => r.status === "cloned").length;
    const skipped = results.filter(r => r.status === "skipped_duplicate").length;
    const errors  = results.filter(r => r.status === "error").length;

    return NextResponse.json({
      origin:  origin.nickname,
      dest:    dest.nickname,
      results,
      summary: { total: results.length, cloned, skipped_duplicate: skipped, errors },
    });

  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
