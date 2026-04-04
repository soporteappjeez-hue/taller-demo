import { NextResponse } from "next/server";
import { getActiveAccountsForUser, getValidToken, meliGet, getAuthenticatedUserId } from "@/lib/meli";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function classifyLogistic(type: string | null | undefined): "flex" | "turbo" | "full" | "correo" {
  if (!type) return "correo";
  const t = type.toLowerCase();
  if (t === "self_service" || t === "flex" || t.includes("flex")) return "flex";
  if (t === "turbo" || t === "self_service_turbo" || t.includes("turbo")) return "turbo";
  if (t === "fulfillment") return "full";
  return "correo";
}

function urgency(limitDate: string | null): "overdue" | "urgent" | "soon" | "ok" {
  if (!limitDate) return "ok";
  const diffH = (new Date(limitDate).getTime() - Date.now()) / 3600000;
  if (diffH < 0)   return "overdue";
  if (diffH < 2)   return "urgent";
  if (diffH < 6)   return "soon";
  return "ok";
}

interface MeliShipment {
  id: number;
  logistic_type?: string;
  substatus?: string;
  tracking_number?: string;
  date_created?: string;
  order_id?: number;
  shipping_limit?: string;
  estimated_handling_limit?: string;
  status?: string;
}

export async function GET() {
  try {
    // Verificar usuario autenticado
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    
    const accounts = await getActiveAccountsForUser(userId);
    if (!accounts.length) return NextResponse.json({ ready: [], upcoming: [], full_count: 0, turbo_count: 0 });

    const ready:    object[] = [];
    const upcoming: object[] = [];
    let   fullCount  = 0;
    let   turboCount = 0;

    await Promise.all(accounts.map(async (acc) => {
      try {
        const token = await getValidToken(acc);
        if (!token) return;

        const [readyShip, handlingShip, fullOrders, turboOrders] = await Promise.all([
          meliGet(`/shipments/search?seller_id=${acc.meli_user_id}&status=ready_to_ship&limit=50`, token),
          meliGet(`/shipments/search?seller_id=${acc.meli_user_id}&status=handling&limit=50`, token),
          meliGet(`/orders/search?seller=${acc.meli_user_id}&order.status=paid&shipping.logistic_type=fulfillment&limit=1`, token),
          meliGet(`/shipments/search?seller_id=${acc.meli_user_id}&logistic_type=turbo&status=handling&limit=1`, token),
        ]);

        fullCount  += fullOrders?.paging?.total  ?? 0;
        turboCount += turboOrders?.paging?.total ?? 0;

        const toItem = (s: MeliShipment, listType: "ready" | "upcoming") => {
          const logType = classifyLogistic(s.logistic_type);
          const limit   = s.shipping_limit ?? s.estimated_handling_limit ?? null;
          return {
            shipment_id:     s.id,
            order_id:        s.order_id ?? null,
            account:         acc.meli_nickname,
            logistic_type:   s.logistic_type ?? "unknown",
            type:            logType,
            substatus:       s.substatus ?? null,
            tracking_number: s.tracking_number ?? null,
            date_created:    s.date_created ?? null,
            shipping_limit:  limit,
            urgency:         urgency(limit),
            list_type:       listType,
            label_url:       `https://www.mercadolibre.com.ar/envios/details/${s.id}`,
          };
        };

        for (const s of (readyShip?.results ?? []) as MeliShipment[]) {
          if (classifyLogistic(s.logistic_type) !== "full") ready.push(toItem(s, "ready"));
        }
        for (const s of (handlingShip?.results ?? []) as MeliShipment[]) {
          if (classifyLogistic(s.logistic_type) !== "full") upcoming.push(toItem(s, "upcoming"));
        }
      } catch { /* skip */ }
    }));

    const urgencyOrder = { overdue: 0, urgent: 1, soon: 2, ok: 3 };
    const sortFn = (a: object, b: object) => {
      const au = urgencyOrder[(a as { urgency: keyof typeof urgencyOrder }).urgency] ?? 3;
      const bu = urgencyOrder[(b as { urgency: keyof typeof urgencyOrder }).urgency] ?? 3;
      return au - bu;
    };
    ready.sort(sortFn);
    upcoming.sort(sortFn);

    return NextResponse.json({ ready, upcoming, full_count: fullCount, turbo_count: turboCount });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
