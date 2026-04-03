import { NextResponse } from "next/server";
import { getActiveAccounts, getValidToken, meliGet } from "@/lib/meli";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface CampaignItem {
  item_id: string;
  discount_percentage: number;
}

interface CreateCampaignRequest {
  account_id: string;
  name: string;
  discount_percentage: number;
  start_date: string;
  end_date: string;
  item_ids: string[];
  promotion_type?: "TRADITIONAL" | "VOLUME" | "PRICE_DISCOUNT";
  volume_config?: {
    min_quantity: number;
    discount_percentage: number;
  };
}

// Crear una campaña de promoción propia
export async function POST(req: Request) {
  try {
    const body: CreateCampaignRequest = await req.json();
    const {
      account_id,
      name,
      discount_percentage,
      start_date,
      end_date,
      item_ids,
      promotion_type = "TRADITIONAL",
      volume_config,
    } = body;

    // Validaciones
    if (!account_id || !name || !discount_percentage || !start_date || !end_date || !item_ids?.length) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: account_id, name, discount_percentage, start_date, end_date, item_ids" },
        { status: 400 }
      );
    }

    if (discount_percentage < 1 || discount_percentage > 99) {
      return NextResponse.json(
        { error: "El porcentaje de descuento debe estar entre 1 y 99" },
        { status: 400 }
      );
    }

    if (item_ids.length > 1000) {
      return NextResponse.json(
        { error: "Máximo 1000 items por campaña" },
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
      campaign_created: false,
      campaign_id: null as string | null,
      items_added: 0,
      items_failed: [] as string[],
      errors: [] as string[],
    };

    // 1. Crear la campaña
    const campaignBody: Record<string, unknown> = {
      name,
      type: promotion_type,
      start_date,
      end_date,
      benefits: {
        type: "PRICE_DISCOUNT",
        value: discount_percentage,
      },
    };

    // Si es promoción por volumen, agregar configuración específica
    if (promotion_type === "VOLUME" && volume_config) {
      campaignBody.benefits = {
        type: "VOLUME_DISCOUNT",
        min_quantity: volume_config.min_quantity,
        value: volume_config.discount_percentage,
      };
    }

    const campaignRes = await fetch(
      `https://api.mercadolibre.com/seller-promotions/campaigns`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(campaignBody),
      }
    );

    if (!campaignRes.ok) {
      const errorData = await campaignRes.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: "Error al crear campaña",
          details: errorData,
          status: campaignRes.status,
        },
        { status: 500 }
      );
    }

    const campaignData = await campaignRes.json();
    results.campaign_created = true;
    results.campaign_id = campaignData.id;

    // 2. Agregar items en lotes de 50 (límite de la API de MeLi)
    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < item_ids.length; i += BATCH_SIZE) {
      batches.push(item_ids.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const itemsPayload = batch.map(itemId => ({
        item_id: itemId,
        discount_percentage: discount_percentage,
      }));

      try {
        const itemsRes = await fetch(
          `https://api.mercadolibre.com/seller-promotions/campaigns/${campaignData.id}/items`,
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
          // Algunos items pueden fallar individualmente
          if (errorData.failed_items) {
            results.items_failed.push(...errorData.failed_items.map((f: { item_id: string }) => f.item_id));
          } else {
            results.items_failed.push(...batch);
          }
          if (errorData.error) {
            results.errors.push(errorData.error);
          }
        }
      } catch (e) {
        results.items_failed.push(...batch);
        results.errors.push((e as Error).message);
      }
    }

    return NextResponse.json({
      ok: true,
      campaign: {
        id: results.campaign_id,
        name,
        type: promotion_type,
        discount_percentage,
        start_date,
        end_date,
      },
      items_total: item_ids.length,
      items_added: results.items_added,
      items_failed: results.items_failed,
      errors: results.errors,
    });

  } catch (e) {
    return NextResponse.json(
      { error: "Error interno del servidor", details: (e as Error).message },
      { status: 500 }
    );
  }
}

// Listar campañas propias activas
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("account_id");
  const status = searchParams.get("status") ?? "active"; // active, paused, finished

  try {
    const accounts = accountId
      ? (await getActiveAccounts()).filter(a => String(a.meli_user_id) === accountId)
      : await getActiveAccounts();

    if (!accounts.length) {
      return NextResponse.json({ error: "No hay cuentas disponibles" }, { status: 400 });
    }

    const allCampaigns = [];

    for (const account of accounts) {
      const token = await getValidToken(account);
      if (!token) continue;

      try {
        // Obtener campañas del vendedor
        const campaignsData = await meliGet(
          `/seller-promotions/campaigns?status=${status}&limit=100`,
          token
        ) as { results?: Array<Record<string, unknown>> } | null;

        const campaigns = (campaignsData?.results ?? []) as Array<Record<string, unknown>>;

        for (const campaign of campaigns) {
          // Obtener items de cada campaña
          let itemsCount = 0;
          try {
            const itemsData = await meliGet(
              `/seller-promotions/campaigns/${campaign.id}/items?limit=1`,
              token
            ) as { paging?: { total: number } } | null;
            itemsCount = itemsData?.paging?.total ?? 0;
          } catch { /* ignorar error de conteo */ }

          allCampaigns.push({
            id: campaign.id,
            name: campaign.name,
            type: campaign.type,
            status: campaign.status,
            start_date: campaign.start_date,
            end_date: campaign.end_date,
            benefits: campaign.benefits,
            items_count: itemsCount,
            account: account.nickname,
            meli_user_id: String(account.meli_user_id),
          });
        }
      } catch (e) {
        console.error(`Error al obtener campañas de ${account.nickname}:`, e);
      }
    }

    return NextResponse.json({
      ok: true,
      campaigns: allCampaigns,
      total: allCampaigns.length,
    });

  } catch (e) {
    return NextResponse.json(
      { error: "Error interno del servidor", details: (e as Error).message },
      { status: 500 }
    );
  }
}
