import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ENC_KEY     = process.env.APPJEEZ_MELI_ENCRYPTION_KEY!;

async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const km  = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("appjeez-meli-salt"), iterations: 100000, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
  );
}

async function decrypt(encBase64: string, passphrase: string): Promise<string> {
  const key      = await deriveKey(passphrase);
  const combined = Uint8Array.from(atob(encBase64), (c) => c.charCodeAt(0));
  const plain    = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: combined.slice(0, 12) },
    key,
    combined.slice(12)
  );
  return new TextDecoder().decode(plain);
}

export async function GET(req: Request) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  const logs: string[] = [];
  logs.push(`enc_key_set:${!!ENC_KEY}`);
  logs.push(`service_key_set:${!!SERVICE_KEY}`);
  logs.push(`supa_url:${SUPA_URL}`);

  try {
    const supabase = createClient(SUPA_URL, SERVICE_KEY);

    const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];

    const { data: accounts, error } = await supabase
      .from("meli_accounts")
      .select("id, meli_user_id, nickname, access_token_enc")
      .eq("status", "active")
      .order("created_at", { ascending: true });

    logs.push(`accounts_count:${accounts?.length ?? 0}`);
    if (error) logs.push(`db_error:${error.message}`);

    if (error || !accounts?.length) {
      return NextResponse.json(debug ? { logs, questions: [] } : []);
    }

    const allQuestions: object[] = [];
    const itemCache: Record<string, { title: string; thumbnail: string }> = {};
    const accLogs: object[] = [];

    for (const [accIdx, acc] of accounts.entries()) {
      const roman = ROMAN[accIdx] ?? String(accIdx + 1);
      const alog: Record<string, unknown> = { nickname: acc.nickname, meli_user_id: acc.meli_user_id };
      try {
        const token = await decrypt(acc.access_token_enc, ENC_KEY);
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
            item_thumbnail:   itemCache[q.item_id].thumbnail,
            buyer_id:         q.from?.id ?? null,
            buyer_nickname:   q.from?.nickname ?? null,
            question_text:    q.text,
            status:           q.status,
            date_created:     q.date_created,
            answer_text:      q.answer?.text ?? null,
            answer_date:      q.answer?.date_created ?? null,
            meli_accounts:    { nickname: acc.nickname, roman_index: roman },
          });
        }
      } catch (err) {
        alog.token_ok = false;
        alog.error = String(err).slice(0, 200);
      }
      accLogs.push(alog);
    }

    // Deduplicar por meli_question_id (por si una pregunta aparece en múltiples cuentas)
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
