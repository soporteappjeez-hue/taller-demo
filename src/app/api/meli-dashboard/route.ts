import { NextResponse } from "next/server";
import { getActiveAccountsForUser, getValidToken, meliGet, getAuthenticatedUserId, LinkedMeliAccount } from "@/lib/meli";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function processAccount(acc: LinkedMeliAccount) {
  try {
    const token = await getValidToken(acc);
    if (!token) {
      return {
        account: acc.meli_nickname, meli_user_id: String(acc.meli_user_id),
        error: "token_expired", unanswered_questions: 0, pending_messages: 0,
        ready_to_ship: 0, total_items: 0, today_orders: 0, today_sales_amount: 0, 
        claims_count: 0, measurement_date: new Date().toISOString(), metrics_period: "Últimos 60 días",
        reputation: null,
      };
    }
    const uid = String(acc.meli_user_id);

    const [userData, ordersRes, shipments, itemsSearch, questions, disputes] = await Promise.all([
      meliGet(`/users/${uid}`, token),
      meliGet(`/orders/search?seller=${uid}&order.status=paid&sort=date_desc&limit=50`, token),
      meliGet(`/shipments/search?seller_id=${uid}&status=ready_to_ship&limit=1`, token),
      meliGet(`/users/${uid}/items/search?limit=1`, token),
      meliGet(`/questions/search?seller_id=${uid}&status=UNANSWERED&limit=1`, token),
      meliGet(`/orders/search?seller=${uid}&order.status=disputed&limit=1`, token),
    ]);

    const nowArg = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const todayArgStr = `${nowArg.getFullYear()}-${String(nowArg.getMonth()+1).padStart(2,"0")}-${String(nowArg.getDate()).padStart(2,"0")}`;
    const allOrders: { total_amount?: number; date_created?: string }[] = ordersRes?.results ?? [];
    const todayOrders = allOrders.filter(o => (o.date_created ?? "").startsWith(todayArgStr));
    const totalAmount = todayOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const rep = userData?.seller_reputation ?? null;

    return {
      account:              acc.meli_nickname,
      meli_user_id:         uid,
      unanswered_questions: questions?.total ?? 0,
      pending_messages:     0,
      ready_to_ship:        shipments?.paging?.total ?? 0,
      total_items:          itemsSearch?.paging?.total ?? 0,
      today_orders:         todayOrders.length,
      today_sales_amount:   totalAmount,
      claims_count:         disputes?.paging?.total ?? 0,
      measurement_date:     new Date().toISOString(),
      metrics_period:       "Últimos 60 días",
      reputation: rep ? {
        level_id:               rep.level_id ?? null,
        power_seller_status:    rep.power_seller_status ?? null,
        transactions_total:     rep.transactions?.total ?? 0,
        transactions_completed: rep.transactions?.completed ?? 0,
        ratings_positive:       rep.transactions?.ratings?.positive ?? 0,
        ratings_negative:       rep.transactions?.ratings?.negative ?? 0,
        ratings_neutral:        rep.transactions?.ratings?.neutral ?? 0,
        delayed_handling_time:  rep.metrics?.delayed_handling_time?.rate ?? 0,
        claims:                 rep.metrics?.claims?.rate ?? 0,
        cancellations:          rep.metrics?.cancellations?.rate ?? 0,
        immediate_payment:      rep.immediate_payment ?? false,
      } : null,
    };
  } catch (err) {
    const errMsg = (err as Error).message;
    console.error(`[processAccount] Error para ${acc.meli_nickname}:`, errMsg);
    
    if (errMsg.includes("HTTP_451_BLOCKED")) {
      return {
        account: acc.meli_nickname, meli_user_id: String(acc.meli_user_id),
        error: "http_451_blocked", unanswered_questions: 0, pending_messages: 0,
        ready_to_ship: 0, total_items: 0, today_orders: 0, today_sales_amount: 0, 
        claims_count: 0, measurement_date: new Date().toISOString(), metrics_period: "Últimos 60 días",
        reputation: null,
      };
    }

    return {
      account: acc.meli_nickname, meli_user_id: String(acc.meli_user_id),
      error: errMsg, unanswered_questions: 0, pending_messages: 0,
      ready_to_ship: 0, total_items: 0, today_orders: 0, today_sales_amount: 0, 
      claims_count: 0, measurement_date: new Date().toISOString(), metrics_period: "Últimos 60 días",
      reputation: null,
    };
  }
}

export async function GET() {
  try {
    // Verificar usuario autenticado
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    
    console.log("[meli-dashboard] Consultando cuentas activas para usuario:", userId);
    const accounts = await getActiveAccountsForUser(userId);
    console.log("[meli-dashboard] ✅ Cuentas encontradas:", accounts.length);
    
    if (!accounts.length) return NextResponse.json([]);

    const results = await Promise.all(accounts.map(processAccount));

    return NextResponse.json(results);
  } catch (e) {
    console.error("[meli-dashboard] ERROR:", (e as Error).message);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
