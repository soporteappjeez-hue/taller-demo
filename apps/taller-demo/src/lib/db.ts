// ============================================================
// CAPA DE DATOS — API Routes server-side (Railway + Supabase)
// ============================================================

import { WorkOrder, StockItem, PartToOrder, Pago, PlantillaWhatsApp, AgendaCliente, HistorialReparacion, FlexEnvio, VentaRepuesto, VentaItem, VentasStats, VentasPorDia, TopProducto } from "./types";

// ─── Helper genérico para llamar a /api/db ────────────────────

async function dbCall(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Error de base de datos");
  return json;
}

// ─── Helpers de mapeo (snake_case DB → camelCase app) ─────────

function toOrder(r: Record<string, unknown>): WorkOrder {
  return {
    id:                 r.id as string,
    clientName:         r.client_name as string,
    clientPhone:        r.client_phone as string,
    motorType:          r.motor_type as WorkOrder["motorType"],
    brand:              r.brand as string,
    model:              r.model as string,
    reportedIssues:     r.reported_issues as string,
    budget:             r.budget as number | null,
    estimatedDays:      r.estimated_days as number | null,
    status:             r.status as WorkOrder["status"],
    clientNotification: r.client_notification as WorkOrder["clientNotification"],
    budgetAccepted:     r.budget_accepted as boolean,
    entryDate:          r.entry_date as string,
    completionDate:     r.completion_date as string | null,
    deliveryDate:       r.delivery_date as string | null,
    linkedParts:        (r.linked_parts as string[]) ?? [],
    internalNotes:      r.internal_notes as string,
    photoUrls:          (r.photo_urls as string[]) ?? [],
    extraMachines:      (r.extra_machines as WorkOrder["extraMachines"]) ?? [],
    machineTypeOther:   r.machine_type_other as string | undefined,
    deposit:            r.deposit as number | undefined,
    totalPaid:          r.total_paid as number | undefined,
  };
}

function fromOrder(o: WorkOrder) {
  return {
    id:                  o.id,
    client_name:         o.clientName,
    client_phone:        o.clientPhone,
    motor_type:          o.motorType,
    brand:               o.brand,
    model:               o.model,
    reported_issues:     o.reportedIssues,
    budget:              o.budget,
    estimated_days:      o.estimatedDays,
    status:              o.status,
    client_notification: o.clientNotification,
    budget_accepted:     o.budgetAccepted,
    entry_date:          o.entryDate,
    completion_date:     o.completionDate,
    delivery_date:       o.deliveryDate,
    linked_parts:        o.linkedParts,
    internal_notes:      o.internalNotes,
    photo_urls:          o.photoUrls ?? [],
    extra_machines:      o.extraMachines ?? [],
    machine_type_other:  o.machineTypeOther ?? null,
    deposit:             o.deposit ?? null,
    total_paid:          o.totalPaid ?? null,
  };
}

function toStock(r: Record<string, unknown>): StockItem {
  return {
    id:          r.id as string,
    name:        r.name as string,
    quantity:    r.quantity as number,
    location:    r.location as string,
    minQuantity: r.min_quantity as number,
    notes:       r.notes as string,
  };
}

function fromStock(s: StockItem) {
  return {
    id:           s.id,
    name:         s.name,
    quantity:     s.quantity,
    location:     s.location,
    min_quantity: s.minQuantity,
    notes:        s.notes,
  };
}

function toPart(r: Record<string, unknown>): PartToOrder {
  return {
    id:               r.id as string,
    name:             r.name as string,
    quantity:         r.quantity as number,
    orderId:          r.order_id as string | null,
    orderClientName:  r.order_client_name as string | null,
    supplier:         r.supplier as string,
    status:           r.status as PartToOrder["status"],
    notes:            r.notes as string,
    createdAt:        r.created_at as string,
  };
}

function fromPart(p: PartToOrder) {
  return {
    id:                p.id,
    name:              p.name,
    quantity:          p.quantity,
    order_id:          p.orderId,
    order_client_name: p.orderClientName,
    supplier:          p.supplier,
    status:            p.status,
    notes:             p.notes,
    created_at:        p.createdAt,
  };
}

// ─── Órdenes de Trabajo ───────────────────────────────────────

export const ordersDb = {
  async getAll(): Promise<WorkOrder[]> {
    const { data } = await dbCall({
      action: "select", table: "reparaciones",
      order: { col: "entry_date", asc: false },
    });
    return ((data as Record<string, unknown>[]) ?? []).map(toOrder);
  },

  async getById(id: string): Promise<WorkOrder | undefined> {
    try {
      const { data } = await dbCall({
        action: "selectSingle", table: "reparaciones",
        filters: [{ col: "id", op: "eq", val: id }],
      });
      return data ? toOrder(data as Record<string, unknown>) : undefined;
    } catch { return undefined; }
  },

  async create(order: WorkOrder): Promise<void> {
    await dbCall({ action: "insert", table: "reparaciones", data: fromOrder(order) });
  },

  async update(id: string, updates: Partial<WorkOrder>): Promise<void> {
    const mapped: Record<string, unknown> = {};
    if (updates.clientName         !== undefined) mapped.client_name         = updates.clientName;
    if (updates.clientPhone        !== undefined) mapped.client_phone        = updates.clientPhone;
    if (updates.motorType          !== undefined) mapped.motor_type          = updates.motorType;
    if (updates.brand              !== undefined) mapped.brand               = updates.brand;
    if (updates.model              !== undefined) mapped.model               = updates.model;
    if (updates.reportedIssues     !== undefined) mapped.reported_issues     = updates.reportedIssues;
    if (updates.budget             !== undefined) mapped.budget              = updates.budget;
    if (updates.estimatedDays      !== undefined) mapped.estimated_days      = updates.estimatedDays;
    if (updates.status             !== undefined) mapped.status              = updates.status;
    if (updates.clientNotification !== undefined) mapped.client_notification = updates.clientNotification;
    if (updates.budgetAccepted     !== undefined) mapped.budget_accepted     = updates.budgetAccepted;
    if (updates.completionDate     !== undefined) mapped.completion_date     = updates.completionDate;
    if (updates.deliveryDate       !== undefined) mapped.delivery_date       = updates.deliveryDate;
    if (updates.linkedParts        !== undefined) mapped.linked_parts        = updates.linkedParts;
    if (updates.internalNotes      !== undefined) mapped.internal_notes      = updates.internalNotes;
    if (updates.photoUrls          !== undefined) mapped.photo_urls          = updates.photoUrls;
    if (updates.extraMachines      !== undefined) mapped.extra_machines      = updates.extraMachines;
    if (updates.machineTypeOther   !== undefined) mapped.machine_type_other  = updates.machineTypeOther;
    if (updates.deposit            !== undefined) mapped.deposit             = updates.deposit;
    if (updates.totalPaid          !== undefined) mapped.total_paid          = updates.totalPaid;
    await dbCall({ action: "update", table: "reparaciones", data: mapped, id });
  },

  async delete(id: string): Promise<void> {
    await dbCall({ action: "delete", table: "reparaciones", id });
  },
};

// ─── Stock ────────────────────────────────────────────────────

export const stockDb = {
  async getAll(): Promise<StockItem[]> {
    const { data } = await dbCall({
      action: "select", table: "stock",
      order: { col: "created_at", asc: false },
    });
    return ((data as Record<string, unknown>[]) ?? []).map(toStock);
  },

  async create(item: StockItem): Promise<void> {
    await dbCall({ action: "insert", table: "stock", data: fromStock(item) });
  },

  async update(id: string, updates: Partial<StockItem>): Promise<void> {
    const mapped: Record<string, unknown> = {};
    if (updates.name        !== undefined) mapped.name         = updates.name;
    if (updates.quantity    !== undefined) mapped.quantity     = updates.quantity;
    if (updates.location    !== undefined) mapped.location     = updates.location;
    if (updates.minQuantity !== undefined) mapped.min_quantity = updates.minQuantity;
    if (updates.notes       !== undefined) mapped.notes        = updates.notes;
    await dbCall({ action: "update", table: "stock", data: mapped, id });
  },

  async delete(id: string): Promise<void> {
    await dbCall({ action: "delete", table: "stock", id });
  },
};

// ─── Repuestos a Pedir ────────────────────────────────────────

export const partsToOrderDb = {
  async getAll(): Promise<PartToOrder[]> {
    const { data } = await dbCall({
      action: "select", table: "repuestos_a_pedir",
      order: { col: "created_at", asc: false },
    });
    return ((data as Record<string, unknown>[]) ?? []).map(toPart);
  },

  async create(part: PartToOrder): Promise<void> {
    await dbCall({ action: "insert", table: "repuestos_a_pedir", data: fromPart(part) });
  },

  async update(id: string, updates: Partial<PartToOrder>): Promise<void> {
    const mapped: Record<string, unknown> = {};
    if (updates.name             !== undefined) mapped.name               = updates.name;
    if (updates.quantity         !== undefined) mapped.quantity           = updates.quantity;
    if (updates.orderId          !== undefined) mapped.order_id           = updates.orderId;
    if (updates.orderClientName  !== undefined) mapped.order_client_name  = updates.orderClientName;
    if (updates.supplier         !== undefined) mapped.supplier           = updates.supplier;
    if (updates.status           !== undefined) mapped.status             = updates.status;
    if (updates.notes            !== undefined) mapped.notes              = updates.notes;
    await dbCall({ action: "update", table: "repuestos_a_pedir", data: mapped, id });
  },

  async delete(id: string): Promise<void> {
    await dbCall({ action: "delete", table: "repuestos_a_pedir", id });
  },
};

// ─── Pagos ────────────────────────────────────────────────────

export const pagosDb = {
  async getByOrder(orderId: string): Promise<Pago[]> {
    const { data } = await dbCall({
      action: "select", table: "pagos",
      filters: [{ col: "order_id", op: "eq", val: orderId }],
      order: { col: "paid_at", asc: false },
    });
    return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
      id:      r.id as string,
      orderId: r.order_id as string,
      amount:  r.amount as number,
      method:  r.method as Pago["method"],
      notes:   r.notes as string,
      paidAt:  r.paid_at as string,
    }));
  },
  async create(p: Pago): Promise<void> {
    await dbCall({
      action: "insert", table: "pagos",
      data: { id: p.id, order_id: p.orderId, amount: p.amount, method: p.method, notes: p.notes, paid_at: p.paidAt },
    });
  },
  async delete(id: string): Promise<void> {
    await dbCall({ action: "delete", table: "pagos", id });
  },
};

// ─── Plantillas WhatsApp ──────────────────────────────────────

export const plantillasDb = {
  async getAll(): Promise<PlantillaWhatsApp[]> {
    const { data } = await dbCall({
      action: "select", table: "plantillas_whatsapp",
      order: { col: "created_at", asc: false },
    });
    return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
      id:        r.id as string,
      name:      r.name as string,
      message:   r.message as string,
      createdAt: r.created_at as string,
    }));
  },
  async create(t: PlantillaWhatsApp): Promise<void> {
    await dbCall({
      action: "insert", table: "plantillas_whatsapp",
      data: { id: t.id, name: t.name, message: t.message, created_at: t.createdAt },
    });
  },
  async update(id: string, updates: Partial<PlantillaWhatsApp>): Promise<void> {
    const mapped: Record<string, unknown> = {};
    if (updates.name    !== undefined) mapped.name    = updates.name;
    if (updates.message !== undefined) mapped.message = updates.message;
    await dbCall({ action: "update", table: "plantillas_whatsapp", data: mapped, id });
  },
  async delete(id: string): Promise<void> {
    await dbCall({ action: "delete", table: "plantillas_whatsapp", id });
  },
};

// ─── Agenda de Clientes ───────────────────────────────────────

export const agendaDb = {
  async getAll(): Promise<AgendaCliente[]> {
    const { data } = await dbCall({
      action: "select", table: "agenda_clientes",
      order: { col: "nombre", asc: true },
    });
    return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
      id:        r.id as string,
      nombre:    r.nombre as string,
      telefono:  r.telefono as string,
      createdAt: r.created_at as string,
    }));
  },

  async upsertByPhone(nombre: string, telefono: string): Promise<void> {
    const phone = telefono.trim();
    if (!phone) return;
    const { data } = await dbCall({
      action: "select", table: "agenda_clientes",
      filters: [
        { col: "telefono", op: "eq", val: phone },
        { col: "telefono", op: "maybeSingle", val: null },
      ],
    });
    if (data) {
      await dbCall({
        action: "update", table: "agenda_clientes",
        data: { nombre: nombre.trim() },
        id: (data as Record<string, unknown>).id as string,
      });
    } else {
      await dbCall({
        action: "insert", table: "agenda_clientes",
        data: { nombre: nombre.trim(), telefono: phone },
      });
    }
  },

  async syncFromOrders(): Promise<number> {
    const { data: orders } = await dbCall({
      action: "select", table: "reparaciones",
      select: "client_name, client_phone",
      filters: [{ col: "client_phone", op: "not.is", val: null }],
    });
    if (!orders) return 0;
    const seen = new Set<string>();
    let count = 0;
    for (const o of (orders as Record<string, unknown>[])) {
      const phone = (o.client_phone as string)?.trim();
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      const { data: existing } = await dbCall({
        action: "select", table: "agenda_clientes",
        filters: [
          { col: "telefono", op: "eq", val: phone },
          { col: "telefono", op: "maybeSingle", val: null },
        ],
      });
      if (!existing) {
        await dbCall({
          action: "insert", table: "agenda_clientes",
          data: { nombre: (o.client_name as string)?.trim() || "Sin nombre", telefono: phone },
        });
        count++;
      }
    }
    return count;
  },

  async delete(id: string): Promise<void> {
    try {
      await dbCall({
        action: "deleteWhere", table: "historial_reparaciones",
        filters: [{ col: "cliente_id", op: "eq", val: id }],
      });
    } catch { /* ignorar si no existe */ }
    await dbCall({ action: "delete", table: "agenda_clientes", id });
  },
};

// ─── Historial permanente de reparaciones ─────────────────────

export const historialDb = {
  async getByCliente(clienteId: string): Promise<HistorialReparacion[]> {
    const { data } = await dbCall({
      action: "select", table: "historial_reparaciones",
      filters: [{ col: "cliente_id", op: "eq", val: clienteId }],
      order: { col: "fecha_ingreso", asc: false },
    });
    return ((data as Record<string, unknown>[]) ?? []).map(r => ({
      id:           r.id as string,
      clienteId:    r.cliente_id as string,
      ordenId:      r.orden_id as string | null,
      fechaIngreso: r.fecha_ingreso as string,
      motorType:    r.motor_type as string,
      brand:        r.brand as string,
      model:        r.model as string,
      falla:        r.falla as string,
      trabajo:      r.trabajo as string,
      presupuesto:  r.presupuesto as number | null,
      estadoFinal:  r.estado_final as string,
      photoUrls:    (r.photo_urls as string[]) ?? [],
      createdAt:    r.created_at as string,
    }));
  },

  async upsert(clienteId: string, order: WorkOrder): Promise<void> {
    const record = {
      id:            order.id + "_hist",
      cliente_id:    clienteId,
      orden_id:      order.id,
      fecha_ingreso: order.entryDate,
      motor_type:    order.motorType,
      brand:         order.brand,
      model:         order.model,
      falla:         order.reportedIssues,
      trabajo:       order.internalNotes ?? "",
      presupuesto:   order.budget,
      estado_final:  order.status,
      photo_urls:    order.photoUrls ?? [],
      updated_at:    new Date().toISOString(),
    };
    await dbCall({ action: "upsert", table: "historial_reparaciones", data: record, onConflict: "id" });
  },
};

// ─── Logística Flex ───────────────────────────────────────────

function toFlex(r: Record<string, unknown>): FlexEnvio {
  return {
    id:                 r.id as string,
    fecha:              r.fecha as string,
    localidad:          r.localidad as string,
    zona:               r.zona as FlexEnvio["zona"],
    precioML:           r.precio_ml as number,
    pagoFlete:          r.pago_flete as number,
    ganancia:           r.ganancia as number,
    descripcion:        r.descripcion as string,
    nroSeguimiento:     (r.nro_seguimiento as string) ?? "",
    usuarioML:          (r.usuario_ml as string) ?? "",
    nombreDestinatario: (r.nombre_destinatario as string) ?? "",
    direccion:          (r.direccion as string) ?? "",
    codigoPostal:       (r.codigo_postal as string) ?? "",
    productoSku:        (r.producto_sku as string) ?? "",
    packId:             (r.pack_id as string) ?? "",
    createdAt:          r.created_at as string,
  };
}

export const flexDb = {
  async getAll(): Promise<FlexEnvio[]> {
    const { data } = await dbCall({
      action: "select", table: "flex_envios",
      order: { col: "fecha", asc: false },
    });
    return ((data as Record<string, unknown>[]) ?? []).map(toFlex);
  },

  async create(e: FlexEnvio): Promise<{ duplicado: boolean }> {
    const row = {
      id:                  e.id,
      fecha:               e.fecha,
      localidad:           e.localidad,
      zona:                e.zona,
      precio_ml:           e.precioML,
      pago_flete:          e.pagoFlete,
      ganancia:            e.ganancia,
      descripcion:         e.descripcion,
      nro_seguimiento:     e.nroSeguimiento || null,
      usuario_ml:          e.usuarioML,
      nombre_destinatario: e.nombreDestinatario,
      direccion:           e.direccion,
      codigo_postal:       e.codigoPostal,
      producto_sku:        e.productoSku,
      pack_id:             e.packId || null,
      created_at:          e.createdAt,
    };

    if (e.nroSeguimiento) {
      await dbCall({
        action: "upsert", table: "flex_envios", data: row,
        onConflict: "nro_seguimiento", ignoreDuplicates: false,
      });
    } else {
      await dbCall({ action: "insert", table: "flex_envios", data: row });
    }
    return { duplicado: false };
  },

  async delete(id: string): Promise<void> {
    await dbCall({ action: "delete", table: "flex_envios", id });
  },

  async updateTarifa(zona: string, nuevoPrecio: number): Promise<void> {
    await dbCall({
      action: "update", table: "flex_tarifas",
      data: { precio: nuevoPrecio },
      id: zona, idCol: "zona",
    });
  },
};

// ─── Ventas de Repuestos ──────────────────────────────────────

function toVenta(r: Record<string, unknown>, items: VentaItem[]): VentaRepuesto {
  return {
    id:         r.id as string,
    vendedor:   r.vendedor as string,
    metodoPago: r.metodo_pago as VentaRepuesto["metodoPago"],
    total:      r.total as number,
    status:     r.status as VentaRepuesto["status"],
    notas:      (r.notas as string) ?? "",
    createdAt:  r.created_at as string,
    items,
  };
}

function toVentaItem(r: Record<string, unknown>): VentaItem {
  return {
    id:         r.id as string,
    ventaId:    r.venta_id as string,
    producto:   r.producto as string,
    sku:        (r.sku as string) ?? "",
    cantidad:   r.cantidad as number,
    precioUnit: r.precio_unit as number,
    subtotal:   r.subtotal as number,
  };
}

export const ventasDb = {
  async getAll(desde?: string, hasta?: string): Promise<VentaRepuesto[]> {
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    const res = await fetch(`/api/ventas?${params}`);
    if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Error al obtener ventas"); }
    const data = await res.json();
    return (data ?? []).map((r: Record<string, unknown>) => {
      const items = ((r.ventas_items as Record<string, unknown>[]) ?? []).map(toVentaItem);
      return toVenta(r, items);
    });
  },

  async getToday(): Promise<VentaRepuesto[]> {
    // Usar fecha local del cliente (Argentina) para evitar desfase UTC
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const res = await fetch(`/api/ventas?action=today&fecha=${localDate}`);
    if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Error al obtener ventas"); }
    const data = await res.json();
    return (data ?? []).map((r: Record<string, unknown>) => {
      const items = ((r.ventas_items as Record<string, unknown>[]) ?? []).map(toVentaItem);
      return toVenta(r, items);
    });
  },

  async create(v: VentaRepuesto): Promise<void> {
    const res = await fetch("/api/ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Error al crear venta"); }
  },

  async update(v: VentaRepuesto): Promise<void> {
    const res = await fetch("/api/ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", venta: v }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Error al actualizar venta"); }
  },

  async cancelar(id: string): Promise<void> {
    const res = await fetch("/api/ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancelar", id }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Error al cancelar venta"); }
  },

  async getStats(desde: string, hasta: string): Promise<VentasStats> {
    const res = await fetch(`/api/ventas?action=stats&desde=${desde}&hasta=${hasta}`);
    if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Error al obtener stats"); }
    const data = await res.json();
    const row = (data as Record<string, unknown>[])?.[0] ?? {};
    return {
      totalFacturado: Number(row.total_facturado ?? 0),
      cantVentas:     Number(row.cant_ventas ?? 0),
      metodoTop:      (row.metodo_top as string) ?? null,
      productoTop:    (row.producto_top as string) ?? null,
    };
  },

  async getVentasPorDia(desde: string, hasta: string): Promise<VentasPorDia[]> {
    const res = await fetch(`/api/ventas?action=por_dia&desde=${desde}&hasta=${hasta}`);
    if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Error al obtener ventas por dia"); }
    const data = await res.json();
    return ((data as Record<string, unknown>[]) ?? []).map(r => ({
      dia:   r.dia as string,
      total: Number(r.total),
      cant:  Number(r.cant),
    }));
  },

  async getTopProductos(desde: string, hasta: string): Promise<TopProducto[]> {
    const res = await fetch(`/api/ventas?action=top_productos&desde=${desde}&hasta=${hasta}`);
    if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Error al obtener top productos"); }
    const data = await res.json();
    return ((data as Record<string, unknown>[]) ?? []).map(r => ({
      producto: r.producto as string,
      cantidad: Number(r.cantidad),
      total:    Number(r.total),
    }));
  },
};
