import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceKey || "placeholder-key"
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const accountId = searchParams.get("account_id") || "";
    const meliUserId = searchParams.get("meli_user_id") || "";
    const loadAll = searchParams.get("all") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");

    // Si no hay query y no es loadAll, devolver vacío
    if (q.length < 2 && !loadAll) {
      return NextResponse.json({ results: [], total: 0 });
    }

    // Construir query base con service role key (sin problemas de RLS)
    let query = supabaseAdmin
      .from("printed_labels")
      .select("*")
      .order("print_date", { ascending: false })
      .limit(limit);

    // Filtrar por meli_user_id (opcional)
    if (meliUserId) {
      query = query.eq("meli_user_id", meliUserId) as typeof query;
    }

    // Filtrar por account_id (opcional)
    if (accountId) {
      query = query.eq("account_id", accountId) as typeof query;
    }

    // Si hay query de búsqueda, aplicar filtros OR
    if (q.length >= 2) {
      const searchTerm = `%${q}%`;
      const orFilters: string[] = [
        `sku.ilike.${searchTerm}`,
        `tracking_number.ilike.${searchTerm}`,
        `buyer_nickname.ilike.${searchTerm}`,
        `shipment_id::text.ilike.${searchTerm}`,
      ];
      query = query.or(orFilters.join(",")) as typeof query;
    }

    const { data: results, error } = await query;

    if (error) {
      console.error("Search query error:", error);
      return NextResponse.json(
        { error: "Search failed", results: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      results: results || [],
      total: (results || []).length,
      query: q,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed", results: [] },
      { status: 500 }
    );
  }
}

