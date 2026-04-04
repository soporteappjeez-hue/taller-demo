import { NextResponse } from "next/server";
import { getSupabase, getActiveAccountsForUser, getValidToken, meliGet, getAuthenticatedUserId } from "@/lib/meli";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

type ActionType = "accepted" | "skipped" | "error";

interface PromotionOffer {
  item_id: string;
  item_title: string;
  promotion_id: string;
  promotion_type: string;
  original_price: number;
  discount_seller_amount: number;
  discount_meli_amount: number;
  discount_pct: number;
  status: string;
}

interface ScanResult {
  account: string;
  meli_user_id: string;
  accepted: PromotionOffer[];
  skipped: PromotionOffer[];
  errors: PromotionOffer[];
  total: number;
}

async function logAction(
  supabase: ReturnType<typeof getSupabase>,
  entry: {
    meli_user_id: string;
    account: string;
    item_id: string;
    item_title: string;
    promotion_id: string;
    promotion_type: string;
    requested_discount_pct: number;
    max_allowed_pct: number;
    action: ActionType;
    reason: string;
  }
) {
  try {
    await supabase.from("meli_promotions_log").insert([entry]);
  } catch { /* no-op */ }
}

export async function GET(req: Request) {
  // Verificar usuario autenticado
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "scan";
  const supabase = getSupabase();

  // Retornar logs recientes
  if (action === "logs") {
    const limit  = parseInt(searchParams.get("limit") ?? "100");
    const { data } = await supabase
      .from("meli_promotions_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    return NextResponse.json({ logs: data ?? [] });
  }

  // Escanear y aceptar automáticamente
  const maxPct       = parseFloat(searchParams.get("max_pct") ?? "15");
  const accountIdRaw = searchParams.get("account_id") ?? "all";
  const dryRun       = searchParams.get("dry_run") === "true"; // solo simular sin aceptar

  try {
    const allAccounts = await getActiveAccountsForUser(userId);
    const accounts = accountIdRaw === "all"
      ? allAccounts
      : allAccounts.filter(a => String(a.meli_user_id) === accountIdRaw);

    if (!accounts.length) {
      return NextResponse.json({ error: "No hay cuentas disponibles" }, { status: 400 });
    }

    const results: ScanResult[] = [];

    for (const acc of accounts) {
      const token = await getValidToken(acc);
      if (!token) continue;

      const result: ScanResult = {
        account: acc.meli_nickname,
        meli_user_id: String(acc.meli_user_id),
        accepted: [],
        skipped:  [],
        errors:   [],
        total:    0,
      };

      try {
        // Obtener ofertas disponibles para el vendedor
        const offersData = await meliGet(
          `/seller-promotions/users/${acc.meli_user_id}/offers?status=candidate&limit=100`,
          token
        ) as { results?: Array<Record<string, unknown>>; paging?: { total: number } } | null;

        const offers = (offersData?.results ?? []) as Array<Record<string, unknown>>;
        result.total = offersData?.paging?.total ?? offers.length;

        for (const offer of offers) {
          const itemId        = String(offer.item_id ?? "");
          const itemTitle     = String(offer.item_title ?? (offer.title ?? "Sin título"));
          const promotionId   = String(offer.promotion_id ?? (offer.id ?? ""));
          const promotionType = String(offer.type ?? (offer.promotion_type ?? "UNKNOWN"));
          const origPrice     = Number(offer.original_price ?? offer.price ?? 0);
          const discSeller    = Number(offer.discount_seller_amount ?? 0);
          const discMeli      = Number(offer.discount_meli_amount ?? 0);

          // Calcular % real de descuento que paga el vendedor
          const discountPct = origPrice > 0
            ? Math.round((discSeller / origPrice) * 10000) / 100
            : 0;

          const offerObj: PromotionOffer = {
            item_id:               itemId,
            item_title:            itemTitle,
            promotion_id:          promotionId,
            promotion_type:        promotionType,
            original_price:        origPrice,
            discount_seller_amount: discSeller,
            discount_meli_amount:  discMeli,
            discount_pct:          discountPct,
            status:                "candidate",
          };

          if (discountPct <= maxPct) {
            // Aceptar la promoción
            if (!dryRun) {
              try {
                await fetch(
                  `https://api.mercadolibre.com/seller-promotions/${promotionId}/items/${itemId}`,
                  {
                    method: "PUT",
                    headers: {
                      Authorization: `Bearer ${token}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ status: "active" }),
                  }
                );
                offerObj.status = "accepted";
              } catch {
                offerObj.status = "error";
                result.errors.push(offerObj);
                await logAction(supabase, {
                  meli_user_id: String(acc.meli_user_id),
                  account: acc.meli_nickname,
                  item_id: itemId, item_title: itemTitle,
                  promotion_id: promotionId, promotion_type: promotionType,
                  requested_discount_pct: discountPct, max_allowed_pct: maxPct,
                  action: "error", reason: "Error al llamar a la API de MeLi",
                });
                continue;
              }
            } else {
              offerObj.status = "would_accept";
            }
            result.accepted.push(offerObj);
            await logAction(supabase, {
              meli_user_id: String(acc.meli_user_id),
              account: acc.meli_nickname,
              item_id: itemId, item_title: itemTitle,
              promotion_id: promotionId, promotion_type: promotionType,
              requested_discount_pct: discountPct, max_allowed_pct: maxPct,
              action: "accepted",
              reason: dryRun
                ? `[SIMULACIÓN] ${discountPct}% ≤ límite ${maxPct}%`
                : `Aceptada: ${discountPct}% ≤ límite ${maxPct}%`,
            });
          } else {
            offerObj.status = "skipped";
            result.skipped.push(offerObj);
            await logAction(supabase, {
              meli_user_id: String(acc.meli_user_id),
              account: acc.meli_nickname,
              item_id: itemId, item_title: itemTitle,
              promotion_id: promotionId, promotion_type: promotionType,
              requested_discount_pct: discountPct, max_allowed_pct: maxPct,
              action: "skipped",
              reason: `Omitida: ${discountPct}% > límite ${maxPct}%`,
            });
          }
        }
      } catch (e) {
        result.errors.push({
          item_id: "", item_title: "Error de consulta",
          promotion_id: "", promotion_type: "",
          original_price: 0, discount_seller_amount: 0,
          discount_meli_amount: 0, discount_pct: 0,
          status: `Error: ${(e as Error).message}`,
        });
      }

      results.push(result);
    }

    const totalAccepted = results.reduce((s, r) => s + r.accepted.length, 0);
    const totalSkipped  = results.reduce((s, r) => s + r.skipped.length, 0);
    const totalErrors   = results.reduce((s, r) => s + r.errors.length, 0);

    return NextResponse.json({
      ok: true,
      dry_run: dryRun,
      max_pct: maxPct,
      summary: { accepted: totalAccepted, skipped: totalSkipped, errors: totalErrors },
      results,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
