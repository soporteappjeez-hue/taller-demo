import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Helper para obtener el usuario desde el token o sesión
async function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    return user;
  }
  
  // Para requests con cookies (navegador)
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

// GET - Obtener cuentas MeLi del usuario autenticado
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user) {
      console.error("[meli-accounts] ❌ Usuario no autenticado");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[meli-accounts] ❌ Faltan variables de entorno");
      return NextResponse.json([], { status: 200 });
    }

    // Usar cliente con service_role para saltar RLS
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Multi-tenant: Solo obtener cuentas del usuario autenticado
    const { data, error } = await adminSupabase
      .from("linked_meli_accounts")
      .select("id, meli_user_id, meli_nickname, token_expiry_date, is_active, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[meli-accounts] ❌ Error consultando BD:", error.message);
      return NextResponse.json([], { status: 200 });
    }

    // Transformar datos al formato esperado por el frontend
    const accounts = data?.map(acc => ({
      id: acc.id,
      meli_user_id: acc.meli_user_id,
      nickname: acc.meli_nickname,
      expires_at: acc.token_expiry_date,
      status: acc.is_active ? "active" : "revoked",
      created_at: acc.created_at,
    })) || [];

    console.log("[meli-accounts] ✅ Encontradas", accounts.length, "cuentas para usuario", user.id);
    return NextResponse.json(accounts);
  } catch (err) {
    const errMsg = (err as Error).message;
    console.error("[meli-accounts] ❌ Error crítico:", errMsg);
    return NextResponse.json([], { status: 200 });
  }
}

// PATCH - Actualizar cuenta (revocar o renombrar)
export async function PATCH(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, status, nickname } = body as { id?: string; status?: string; nickname?: string };
    
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status)   update.is_active = status === "active";
    if (nickname) update.meli_nickname = nickname;

    // Multi-tenant: Solo actualizar si pertenece al usuario autenticado
    const { error } = await adminSupabase
      .from("linked_meli_accounts")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[meli-accounts PATCH] ❌ Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    console.log("[meli-accounts PATCH] ✅ Cuenta actualizada:", id, "para usuario:", user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[meli-accounts PATCH] ❌ Error crítico:", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// DELETE - Eliminar cuenta
export async function DELETE(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Multi-tenant: Solo eliminar si pertenece al usuario autenticado
    const { error } = await adminSupabase
      .from("linked_meli_accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[meli-accounts DELETE] ❌ Error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    console.log("[meli-accounts DELETE] ✅ Cuenta eliminada:", id, "para usuario:", user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[meli-accounts DELETE] ❌ Error crítico:", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
