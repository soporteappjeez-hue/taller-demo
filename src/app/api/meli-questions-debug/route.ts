import { NextResponse } from "next/server";
import { getActiveAccounts, getValidToken } from "@/lib/meli";

/**
 * Debug endpoint para verificar qué está devolviendo la API de preguntas
 * Llamá: /api/meli-questions-debug
 */
export async function GET(req: Request) {
  try {
    const accounts = await getActiveAccounts();
    const results: any[] = [];

    for (const acc of accounts.slice(0, 1)) {
      // Solo primera cuenta para debugging
      const token = await getValidToken(acc);
      if (!token) {
        results.push({ account: acc.nickname, error: "Token not available" });
        continue;
      }

      // Obtener preguntas
      const qRes = await fetch(
        `https://api.mercadolibre.com/questions/search?seller_id=${acc.meli_user_id}&status=UNANSWERED&limit=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!qRes.ok) {
        results.push({
          account: acc.nickname,
          error: "Failed to fetch questions",
          status: qRes.status,
        });
        continue;
      }

      const qData = (await qRes.json()) as {
        questions?: Array<{ id: number; item_id: string; text: string }>;
      };

      const questions = qData.questions ?? [];

      for (const q of questions.slice(0, 2)) {
        try {
          // Obtener detalles del item
          const iRes = await fetch(
            `https://api.mercadolibre.com/items/${q.item_id}?attributes=id,title,thumbnail`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const iData = (await iRes.json()) as {
            title?: string;
            thumbnail?: string;
          };

          results.push({
            account: acc.nickname,
            question_id: q.id,
            item_id: q.item_id,
            item_title: iData.title,
            thumbnail_http: iData.thumbnail || "(empty)",
            thumbnail_https:
              (iData.thumbnail || "").replace("http://", "https://") || "(empty)",
            meli_status: iRes.status,
          });
        } catch (e) {
          results.push({
            account: acc.nickname,
            question_id: q.id,
            item_id: q.item_id,
            error: String(e),
          });
        }
      }
    }

    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
