// ============================================================
// CAPA DE DATOS — Supabase (producción) con fallback a localStorage
// ============================================================

import { supabase } from "./supabase";
import { WorkOrder, StockItem, PartToOrder, Pago, PlantillaWhatsApp } from "./types";

// ─── Helpers de mapeo (snake_case DB ↔ camelCase app) ────────

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
    const { data, error } = await supabase
      .from("reparaciones")
      .select("*")
      .order("entry_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => toOrder(r as Record<string, unknown>));
  },

  async getById(id: string): Promise<WorkOrder | undefined> {
    const { data, error } = await supabase
      .from("reparaciones")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return undefined;
    return toOrder(data as Record<string, unknown>);
  },

  async create(order: WorkOrder): Promise<void> {
    const payload = fromOrder(order);
    console.log("[DB] Insertando en reparaciones:", payload);
    const { error } = await supabase
      .from("reparaciones")
      .insert(payload);
    if (error) {
      console.error("[DB] Error Supabase:", error.message, error.details, error.hint);
      throw error;
    }
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
    const { error } = await supabase.from("reparaciones").update(mapped).eq("id", id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("reparaciones").delete().eq("id", id);
    if (error) throw error;
  },
};

// ─── Stock ────────────────────────────────────────────────────

export const stockDb = {
  async getAll(): Promise<StockItem[]> {
    const { data, error } = await supabase
      .from("stock")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => toStock(r as Record<string, unknown>));
  },

  async create(item: StockItem): Promise<void> {
    const { error } = await supabase.from("stock").insert(fromStock(item));
    if (error) throw error;
  },

  async update(id: string, updates: Partial<StockItem>): Promise<void> {
    const mapped: Record<string, unknown> = {};
    if (updates.name        !== undefined) mapped.name         = updates.name;
    if (updates.quantity    !== undefined) mapped.quantity     = updates.quantity;
    if (updates.location    !== undefined) mapped.location     = updates.location;
    if (updates.minQuantity !== undefined) mapped.min_quantity = updates.minQuantity;
    if (updates.notes       !== undefined) mapped.notes        = updates.notes;
    const { error } = await supabase.from("stock").update(mapped).eq("id", id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("stock").delete().eq("id", id);
    if (error) throw error;
  },
};

// ─── Repuestos a Pedir ────────────────────────────────────────

export const partsToOrderDb = {
  async getAll(): Promise<PartToOrder[]> {
    const { data, error } = await supabase
      .from("repuestos_a_pedir")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => toPart(r as Record<string, unknown>));
  },

  async create(part: PartToOrder): Promise<void> {
    const { error } = await supabase.from("repuestos_a_pedir").insert(fromPart(part));
    if (error) throw error;
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
    const { error } = await supabase.from("repuestos_a_pedir").update(mapped).eq("id", id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("repuestos_a_pedir").delete().eq("id", id);
    if (error) throw error;
  },
};

// ─── Pagos ────────────────────────────────────────────────────

export const pagosDb = {
  async getByOrder(orderId: string): Promise<Pago[]> {
    const { data, error } = await supabase
      .from("pagos")
      .select("*")
      .eq("order_id", orderId)
      .order("paid_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id:      r.id as string,
      orderId: r.order_id as string,
      amount:  r.amount as number,
      method:  r.method as Pago["method"],
      notes:   r.notes as string,
      paidAt:  r.paid_at as string,
    }));
  },
  async create(p: Pago): Promise<void> {
    const { error } = await supabase.from("pagos").insert({
      id: p.id, order_id: p.orderId, amount: p.amount,
      method: p.method, notes: p.notes, paid_at: p.paidAt,
    });
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("pagos").delete().eq("id", id);
    if (error) throw error;
  },
};

// ─── Plantillas WhatsApp ──────────────────────────────────────

export const plantillasDb = {
  async getAll(): Promise<PlantillaWhatsApp[]> {
    const { data, error } = await supabase
      .from("plantillas_whatsapp")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id:        r.id as string,
      name:      r.name as string,
      message:   r.message as string,
      createdAt: r.created_at as string,
    }));
  },
  async create(t: PlantillaWhatsApp): Promise<void> {
    const { error } = await supabase.from("plantillas_whatsapp").insert({
      id: t.id, name: t.name, message: t.message, created_at: t.createdAt,
    });
    if (error) throw error;
  },
  async update(id: string, updates: Partial<PlantillaWhatsApp>): Promise<void> {
    const mapped: Record<string, unknown> = {};
    if (updates.name    !== undefined) mapped.name    = updates.name;
    if (updates.message !== undefined) mapped.message = updates.message;
    const { error } = await supabase.from("plantillas_whatsapp").update(mapped).eq("id", id);
    if (error) throw error;
  },
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from("plantillas_whatsapp").delete().eq("id", id);
    if (error) throw error;
  },
};
