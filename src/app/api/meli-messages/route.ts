import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveAccounts, getValidToken, meliGet } from "@/lib/meli";

export const dynamic = "force-dynamic";

// Cliente Supabase con service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = supabaseUrl && serviceRoleKey 
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sync = searchParams.get("sync") === "true";
    
    // Obtener cuentas activas para determinar el usuario
    const accounts = await getActiveAccounts();
    if (!accounts.length) {
      return NextResponse.json({ error: "No hay cuentas configuradas" }, { status: 401 });
    }

    // Obtener user_id de la primera cuenta
    const { data: accountData } = await supabaseAdmin
      ?.from("linked_meli_accounts")
      .select("user_id")
      .eq("meli_user_id", String(accounts[0].meli_user_id))
      .single() || { data: null };

    const userId = accountData?.user_id;

    // Si no es sincronización forzada y tenemos userId, leer de caché
    if (!sync && userId) {
      const { data: cachedQuestions, error } = await supabaseAdmin
        ?.from("meli_questions_sync")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "UNANSWERED")
        .order("meli_created_date", { ascending: false })
        .limit(100) || { data: null, error: null };

      if (error) {
        console.error("[Mensajes] Error leyendo caché:", error);
      } else if (cachedQuestions && cachedQuestions.length > 0) {
        console.log(`[Mensajes] ${cachedQuestions.length} preguntas desde caché`);
        
        const questions = cachedQuestions.map(q => ({
          id: q.id,
          meli_question_id: parseInt(q.id),
          meli_account_id: q.meli_user_id,
          item_id: q.item_id,
          item_title: q.title_item,
          item_thumbnail: q.item_thumbnail,
          buyer_id: 0,
          buyer_nickname: q.buyer_nickname,
          question_text: q.question_text,
          status: q.status,
          date_created: q.meli_created_date,
          answer_text: null,
          meli_accounts: { nickname: q.meli_user_id },
        }));

        return NextResponse.json({ 
          ok: true, 
          questions,
          source: "cache",
          count: questions.length 
        });
      }
    }

    // Fallback: Sincronizar desde MeLi
    console.log("[Mensajes] Sincronizando desde MeLi...");
    
    const allQuestions: any[] = [];
    
    for (const account of accounts) {
      try {
        const token = await getValidToken(account);
        if (!token) continue;

        const meliUserId = String(account.meli_user_id);
        
        const searchData = await meliGet(
          `/users/${meliUserId}/questions/search?status=UNANSWERED&limit=50`,
          token
        ) as Record<string, unknown> | null;

        const questions = (searchData?.questions || []) as Array<{
          id: string;
          item_id: string;
          status: string;
          text: string;
          date_created: string;
          from?: { nickname: string };
        }>;

        for (const q of questions) {
          const itemData = await meliGet(`/items/${q.item_id}`, token) as { title: string; thumbnail: string } | null;

          // Guardar en caché si tenemos userId
          if (userId) {
            const questionRecord = {
              id: q.id,
              user_id: userId,
              meli_user_id: meliUserId,
              item_id: q.item_id,
              title_item: itemData?.title || "Producto sin título",
              item_thumbnail: itemData?.thumbnail?.replace("http://", "https://") || null,
              question_text: q.text,
              status: q.status,
              buyer_nickname: q.from?.nickname || "Usuario",
              meli_created_date: q.date_created,
              updated_at: new Date().toISOString(),
            };

            await supabaseAdmin
              ?.from("meli_questions_sync")
              .upsert(questionRecord, { onConflict: "id" });
          }

          allQuestions.push({
            id: q.id,
            meli_question_id: parseInt(q.id),
            meli_account_id: meliUserId,
            item_id: q.item_id,
            item_title: itemData?.title,
            item_thumbnail: itemData?.thumbnail?.replace("http://", "https://"),
            buyer_id: 0,
            buyer_nickname: q.from?.nickname || "Usuario",
            question_text: q.text,
            status: q.status,
            date_created: q.date_created,
            answer_text: null,
            meli_accounts: { nickname: meliUserId },
          });
        }
      } catch (e) {
        console.error(`[Mensajes] Error sincronizando cuenta ${account.nickname}:`, e);
      }
    }

    return NextResponse.json({
      ok: true,
      questions: allQuestions,
      source: "meli",
      count: allQuestions.length,
    });

  } catch (error) {
    console.error("[Mensajes] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}