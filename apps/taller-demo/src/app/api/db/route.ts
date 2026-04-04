import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupa() {
  return createClient(SUPA_URL, SERVICE_KEY);
}

// Tablas permitidas (whitelist de seguridad)
const ALLOWED_TABLES = new Set([
  "reparaciones",
  "stock",
  "repuestos_a_pedir",
  "pagos",
  "plantillas_whatsapp",
  "agenda_clientes",
  "historial_reparaciones",
  "flex_envios",
  "flex_tarifas",
]);

// POST /api/db
// Body: { action, table, data?, id?, filters?, order?, rpc?, rpcParams? }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, table, data, id, filters, order, rpc, rpcParams, onConflict, ignoreDuplicates } = body as {
      action: string;
      table?: string;
      data?: Record<string, unknown> | Record<string, unknown>[];
      id?: string;
      filters?: Array<{ col: string; op: string; val: unknown }>;
      order?: { col: string; asc: boolean };
      rpc?: string;
      rpcParams?: Record<string, unknown>;
      onConflict?: string;
      ignoreDuplicates?: boolean;
    };

    const supa = getSupa();

    // RPC calls (funciones almacenadas)
    if (action === "rpc" && rpc) {
      const { data: result, error } = await supa.rpc(rpc, rpcParams ?? {});
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: result });
    }

    if (!table || !ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: `Tabla '${table}' no permitida` }, { status: 400 });
    }

    // SELECT
    if (action === "select") {
      const select = (body.select as string) ?? "*";
      let q = supa.from(table).select(select);
      if (filters) {
        for (const f of filters) {
          if (f.op === "eq") q = q.eq(f.col, f.val);
          else if (f.op === "gte") q = q.gte(f.col, f.val);
          else if (f.op === "lte") q = q.lte(f.col, f.val);
          else if (f.op === "not.is") q = q.not(f.col, "is", f.val);
          else if (f.op === "maybeSingle") { /* handled below */ }
        }
      }
      if (order) q = q.order(order.col, { ascending: order.asc });
      const maybeSingle = filters?.some(f => f.op === "maybeSingle");
      if (maybeSingle) {
        const { data: result, error } = await q.maybeSingle();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ data: result });
      }
      const { data: result, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: result ?? [] });
    }

    // SELECT SINGLE
    if (action === "selectSingle") {
      let q = supa.from(table).select("*");
      if (filters) {
        for (const f of filters) {
          if (f.op === "eq") q = q.eq(f.col, f.val);
        }
      }
      const { data: result, error } = await q.single();
      if (error) return NextResponse.json({ error: error.message }, { status: 404 });
      return NextResponse.json({ data: result });
    }

    // INSERT
    if (action === "insert") {
      if (!data) return NextResponse.json({ error: "data requerido" }, { status: 400 });
      const { error } = await supa.from(table).insert(data);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // UPSERT
    if (action === "upsert") {
      if (!data) return NextResponse.json({ error: "data requerido" }, { status: 400 });
      const opts: { onConflict?: string; ignoreDuplicates?: boolean } = {};
      if (onConflict) opts.onConflict = onConflict;
      if (ignoreDuplicates !== undefined) opts.ignoreDuplicates = ignoreDuplicates;
      const { error } = await supa.from(table).upsert(data, opts);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // UPDATE
    if (action === "update") {
      if (!data || !id) return NextResponse.json({ error: "data e id requeridos" }, { status: 400 });
      const idCol = (body.idCol as string) ?? "id";
      const { error } = await supa.from(table).update(data).eq(idCol, id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // DELETE
    if (action === "delete") {
      if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
      const idCol = (body.idCol as string) ?? "id";
      const { error } = await supa.from(table).delete().eq(idCol, id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // DELETE con filtro custom (ej: delete venta_id = X)
    if (action === "deleteWhere") {
      if (!filters?.length) return NextResponse.json({ error: "filters requerido" }, { status: 400 });
      let q = supa.from(table).delete();
      for (const f of filters) {
        if (f.op === "eq") q = q.eq(f.col, f.val);
      }
      const { error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Accion '${action}' no soportada` }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message ?? "Error interno" }, { status: 500 });
  }
}
