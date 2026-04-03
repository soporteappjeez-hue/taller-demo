import { NextResponse } from "next/server";
import { getActiveAccounts, getValidToken } from "@/lib/meli";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Agregar items a una campaña existente
export async function POST(
  req: Request,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params;
    const body = await req.json();
    const { account_id, item_ids, discount_percentage } = body;

    if (!account_id || !item_ids?.length || !discount_percentage) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: account_id, item_ids, discount_percentage" },
        { status: 400 }
      );
    }

    // Obtener cuenta
    const accounts = await getActiveAccounts();
    const account = accounts.find(a => String(a.meli_user_id) === account_id);
    if (!account) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    const token = await getValidToken(account);
    if (!token) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
    }

    const results = {
      items_added: 0,
      items_failed: [] as Array<{ item_id: string; reason: string }>,
    };

    // Procesar en lotes de 50
    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < item_ids.length; i += BATCH_SIZE) {
      batches.push(item_ids.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const itemsPayload = batch.map((itemId: string) => ({
        item_id: itemId,
        discount_percentage: discount_percentage,
      }));

      try {
        const itemsRes = await fetch(
          `https://api.mercadolibre.com/seller-promotions/campaigns/${campaignId}/items`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ items: itemsPayload }),
          }
        );

        if (itemsRes.ok) {
          results.items_added += batch.length;
        } else {
          const errorData = await itemsRes.json().catch(() => ({}));
          
          // Si hay detalle de items fallidos
          if (errorData.failed_items?.length) {
            results.items_failed.push(
              ...errorData.failed_items.map((f: { item_id: string; error?: string }) => ({
                item_id: f.item_id,
                reason: f.error || `HTTP ${itemsRes.status}`,
              }))
            );
          } else {
            // Falló todo el batch
            results.items_failed.push(
              ...batch.map((id: string) => ({
                item_id: id,
                reason: errorData.error || errorData.message || `HTTP ${itemsRes.status}`,
              }))
            );
          }
        }
      } catch (e) {
        results.items_failed.push(
          ...batch.map((id: string) => ({
            item_id: id,
            reason: (e as Error).message,
          }))
        );
      }
    }

    return NextResponse.json({
      ok: true,
      campaign_id: campaignId,
      items_total: item_ids.length,
      items_added: results.items_added,
      items_failed: results.items_failed,
    });

  } catch (e) {
    return NextResponse.json(
      { error: "Error interno del servidor", details: (e as Error).message },
      { status: 500 }
    );
  }
}

// Eliminar items de una campaña
export async function DELETE(
  req: Request,
  { params }: { params: { campaignId: string } }
) {
  try {
    const { campaignId } = params;
    const { searchParams } = new URL(req.url);
    const account_id = searchParams.get("account_id");
    const item_ids_param = searchParams.get("item_ids");

    if (!account_id || !item_ids_param) {
      return NextResponse.json(
        { error: "Faltan parámetros: account_id, item_ids" },
        { status: 400 }
      );
    }

    const item_ids = item_ids_param.split(",");

    // Obtener cuenta
    const accounts = await getActiveAccounts();
    const account = accounts.find(a => String(a.meli_user_id) === account_id);
    if (!account) {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }

    const token = await getValidToken(account);
    if (!token) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
    }

    const results = {
      items_removed: 0,
      items_failed: [] as Array<{ item_id: string; reason: string }>,
    };

    // Eliminar uno por uno (la API no soporta batch para DELETE)
    for (const itemId of item_ids) {
      try {
        const deleteRes = await fetch(
          `https://api.mercadolibre.com/seller-promotions/campaigns/${campaignId}/items/${itemId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (deleteRes.ok || deleteRes.status === 404) {
          // 404 = ya no existe, consideramos éxito
          results.items_removed++;
        } else {
          const errorData = await deleteRes.json().catch(() => ({}));
          results.items_failed.push({
            item_id: itemId,
            reason: errorData.error || errorData.message || `HTTP ${deleteRes.status}`,
          });
        }
      } catch (e) {
        results.items_failed.push({
          item_id: itemId,
          reason: (e as Error).message,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      campaign_id: campaignId,
      items_total: item_ids.length,
      items_removed: results.items_removed,
      items_failed: results.items_failed,
    });

  } catch (e) {
    return NextResponse.json(
      { error: "Error interno del servidor", details: (e as Error).message },
      { status: 500 }
    );
  }
}