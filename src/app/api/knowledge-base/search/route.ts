import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Cliente Supabase con service role
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = supabaseUrl && serviceRoleKey 
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

interface SearchRequest {
  item_id: string;
  question_text: string;
  limit?: number;
}

// Función para calcular similitud simple entre strings
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Si son iguales, similitud máxima
  if (s1 === s2) return 1.0;
  
  // Calcular palabras en común
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  const commonWords = words1.filter(w => words2.includes(w));
  const uniqueWords = Array.from(new Set(words1.concat(words2)));
  
  return commonWords.length / uniqueWords.length;
}

export async function POST(req: Request) {
  try {
    const body: SearchRequest = await req.json();
    const { item_id, question_text, limit = 3 } = body;

    if (!item_id || !question_text) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: item_id, question_text" },
        { status: 400 }
      );
    }

    // Obtener usuario actual
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Buscar en la base de conocimiento
    const { data: knowledgeEntries, error } = await supabaseAdmin
      ?.from("product_knowledge_base")
      .select("*")
      .eq("user_id", user.id)
      .eq("item_id", item_id)
      .order("use_count", { ascending: false })
      .limit(20) || { data: null, error: null };

    if (error) {
      console.error("[Knowledge Base] Error buscando:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!knowledgeEntries || knowledgeEntries.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        suggestions: [],
        message: "No hay respuestas guardadas para este producto" 
      });
    }

    // Calcular similitud y ordenar
    const scoredSuggestions = knowledgeEntries.map(entry => {
      const scored: any = Object.assign({}, entry);
      scored.similarity = calculateSimilarity(question_text, entry.question_keywords);
      return scored;
    });

    // Ordenar por similitud (descendente) y tomar los mejores
    scoredSuggestions.sort((a, b) => b.similarity - a.similarity);
    
    // Filtrar solo sugerencias con similitud > 0.3 (30%)
    const goodSuggestions = scoredSuggestions
      .filter(s => s.similarity > 0.3)
      .slice(0, limit);

    console.log("[Knowledge Base] Búsqueda:", {
      item_id,
      question: question_text.substring(0, 50),
      found: knowledgeEntries.length,
      suggestions: goodSuggestions.length,
    });

    return NextResponse.json({
      ok: true,
      suggestions: goodSuggestions.map(s => ({
        id: s.id,
        question_keywords: s.question_keywords,
        answer_text: s.answer_text,
        use_count: s.use_count,
        similarity: Math.round(s.similarity * 100),
      })),
      total_entries: knowledgeEntries.length,
    });

  } catch (error) {
    console.error("[Knowledge Base] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Endpoint para guardar una nueva respuesta en la base de conocimiento
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { item_id, question_keywords, answer_text } = body;

    if (!item_id || !question_keywords || !answer_text) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Upsert en la base de conocimiento
    const { data, error } = await supabaseAdmin
      ?.from("product_knowledge_base")
      .upsert({
        user_id: user.id,
        item_id,
        question_keywords: question_keywords.toLowerCase().trim(),
        answer_text,
        use_count: 1,
        updated_at: new Date().toISOString(),
      }, { 
        onConflict: "user_id,item_id,question_keywords",
        ignoreDuplicates: false 
      })
      .select()
      .single() || { data: null, error: null };

    if (error) {
      console.error("[Knowledge Base] Error guardando:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Respuesta guardada en base de conocimiento",
      entry: data,
    });

  } catch (error) {
    console.error("[Knowledge Base] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}