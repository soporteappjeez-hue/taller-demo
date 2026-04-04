import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupa() {
  return createClient(SUPA_URL, SERVICE_KEY);
}

// GET /api/ventas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// GET /api/ventas?action=today
// GET /api/ventas?action=stats&desde=...&hasta=...
// GET /api/ventas?action=por_dia&desde=...&hasta=...
// GET /api/ventas?action=top_productos&desde=...&hasta=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const desde = searchParams.get("desde") ?? undefined;
    const hasta = searchParams.get("hasta") ?? undefined;
    const supa = getSupa();

    if (action === "stats") {
      if (!desde || !hasta) return NextResponse.json({ error: "desde y hasta requeridos" }, { status: 400 });
      const { data, error } = await supa.rpc("get_ventas_stats", {
        fecha_desde: desde,
        fecha_hasta: hasta,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    if (action === "por_dia") {
      if (!desde || !hasta) return NextResponse.json({ error: "desde y hasta requeridos" }, { status: 400 });
      const { data, error } = await supa.rpc("get_ventas_por_dia", {
        fecha_desde: desde,
        fecha_hasta: hasta,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    if (action === "top_productos") {
      if (!desde || !hasta) return NextResponse.json({ error: "desde y hasta requeridos" }, { status: 400 });
      const { data, error } = await supa.rpc("get_top_productos", {
        fecha_desde: desde,
        fecha_hasta: hasta,
        top_n: 5,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    // Default: getAll (con filtros opcionales desde/hasta)
    let q = supa
      .from("ventas_repuestos")
      .select("*, ventas_items(*)")
      .order("created_at", { ascending: false });

    if (action === "today") {
      // Usar fecha del cliente (evita desfase UTC vs Argentina)
      const fecha = searchParams.get("fecha");
      const hoy = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
        ? fecha
        : new Date().toISOString().slice(0, 10);
      q = q.gte("created_at", hoy).lte("created_at", hoy + "T23:59:59");
    } else {
      if (desde) q = q.gte("created_at", desde);
      if (hasta) q = q.lte("created_at", hasta + "T23:59:59");
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? "Error interno" }, { status: 500 });
  }
}

// POST /api/ventas - crear venta
// POST /api/ventas { action: "update", ...venta } - actualizar venta
// POST /api/ventas { action: "cancelar", id } - cancelar venta
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supa = getSupa();
    const action = body.action as string | undefined;

    if (action === "cancelar") {
      const { error } = await supa
        .from("ventas_repuestos")
        .update({ status: "cancelada" })
        .eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "update") {
      const v = body.venta;
      const { error: ve } = await supa
        .from("ventas_repuestos")
        .update({
          vendedor: v.vendedor,
          metodo_pago: v.metodoPago,
          total: v.total,
          notas: v.notas,
        })
        .eq("id", v.id);
      if (ve) return NextResponse.json({ error: ve.message }, { status: 500 });

      // Reemplazar items
      await supa.from("ventas_items").delete().eq("venta_id", v.id);
      if (v.items?.length > 0) {
        const { error: ie } = await supa.from("ventas_items").insert(
          v.items.map((i: Record<string, unknown>) => ({
            id: i.id,
            venta_id: v.id,
            producto: i.producto,
            sku: i.sku,
            cantidad: i.cantidad,
            precio_unit: i.precioUnit,
          }))
        );
        if (ie) return NextResponse.json({ error: ie.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // Default: crear venta
    const v = body;
    const { error: ve } = await supa.from("ventas_repuestos").insert({
      id: v.id,
      vendedor: v.vendedor,
      metodo_pago: v.metodoPago,
      total: v.total,
      status: v.status,
      notas: v.notas,
      created_at: v.createdAt,
    });
    if (ve) return NextResponse.json({ error: ve.message }, { status: 500 });

    if (v.items?.length > 0) {
      const { error: ie } = await supa.from("ventas_items").insert(
        v.items.map((i: Record<string, unknown>) => ({
          id: i.id,
          venta_id: v.id,
          producto: i.producto,
          sku: i.sku,
          cantidad: i.cantidad,
          precio_unit: i.precioUnit,
        }))
      );
      if (ie) return NextResponse.json({ error: ie.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? "Error interno" }, { status: 500 });
  }
}
