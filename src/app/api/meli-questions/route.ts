import { NextResponse } from "next/server";
import { getActiveAccounts, getValidToken } from "@/lib/meli";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";
  const logs: string[] = [];

  try {
    const accounts = await getActiveAccounts();
    logs.push(`accounts_count:${accounts.length}`);

    if (!accounts.length) {
      return NextResponse.json(debug ? { logs, questions: [] } : []);
    }

    const allQuestions: object[] = [];
    const itemCache: Record<string, { title: string; thumbnail: string }> = {};
    const accLogs: object[] = [];

    for (let accIdx = 0; accIdx < accounts.length; accIdx++) {
      const acc   = accounts[accIdx];
      const alog: Record<string, unknown> = { nickname: acc.nickname, meli_user_id: acc.meli_user_id };
      try {
        const token = await getValidToken(acc);
        if (!token) { alog.token_ok = false; alog.error = "token_expired"; accLogs.push(alog); continue; }
        alog.token_ok = true;

        const url = `https://api.mercadolibre.com/questions/search?seller_id=${acc.meli_user_id}&status=UNANSWERED&limit=50`;
        const qRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        alog.meli_status = qRes.status;

        if (!qRes.ok) {
          const body = await qRes.text();
          alog.meli_error = body.slice(0, 300);
          accLogs.push(alog);
          continue;
        }

        const qData = await qRes.json() as {
          questions?: {
            id: number; item_id: string; text: string; status: string;
            date_created: string; from: { id: number; nickname?: string };
            answer?: { text: string; date_created: string };
          }[];
          total?: number;
        };

        alog.total_meli = qData.total ?? 0;
        const questions = qData.questions ?? [];
        alog.questions_count = questions.length;

        for (const q of questions) {
          if (!itemCache[q.item_id]) {
            try {
              const iRes = await fetch(
                `https://api.mercadolibre.com/items/${q.item_id}?attributes=id,title,thumbnail`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (iRes.ok) {
                const iData = await iRes.json() as { title?: string; thumbnail?: string };
                itemCache[q.item_id] = { title: iData.title ?? q.item_id, thumbnail: iData.thumbnail ?? "" };
              } else {
                itemCache[q.item_id] = { title: q.item_id, thumbnail: "" };
              }
            } catch { itemCache[q.item_id] = { title: q.item_id, thumbnail: "" }; }
          }

          allQuestions.push({
            id:               crypto.randomUUID(),
            meli_question_id: q.id,
            meli_account_id:  acc.id,
            item_id:          q.item_id,
            item_title:       itemCache[q.item_id].title,
            item_thumbnail:   (itemCache[q.item_id].thumbnail || "").replace("http://", "https://"),
            buyer_id:         q.from?.id ?? null,
            buyer_nickname:   q.from?.nickname ?? null,
            question_text:    q.text,
            status:           q.status,
            date_created:     q.date_created,
            answer_text:      q.answer?.text ?? null,
            answer_date:      q.answer?.date_created ?? null,
            meli_accounts:    { nickname: acc.nickname },
          });
        }
      } catch (err) {
        alog.token_ok = false;
        alog.error = String(err).slice(0, 200);
      }
      accLogs.push(alog);
    }

    const seen = new Set<number>();
    const unique = allQuestions.filter(q => {
      const id = (q as { meli_question_id: number }).meli_question_id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    if (debug) return NextResponse.json({ logs, accLogs, total: unique.length, questions: unique });
    return NextResponse.json(unique);

  } catch (e) {
    const msg = (e as Error).message;
    if (debug) return NextResponse.json({ logs, fatal: msg }, { status: 500 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
