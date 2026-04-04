"use client";

import { useState, useEffect, useCallback } from "react";
import { WorkOrder, RepairStatus, MotorType } from "@/lib/types";
import { ordersDb } from "@/lib/db";
import { isOverdue90Days } from "@/lib/utils";

export interface OrderFilters {
  motorType: MotorType | "all";
  status: RepairStatus | "all";
  search: string;
  overdueOnly: boolean;
}

export function useOrders() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<OrderFilters>({
    motorType: "all",
    status: "all",
    search: "",
    overdueOnly: false,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ordersDb.getAll();
      setOrders(data);
    } catch (e) {
      console.error("Error cargando órdenes:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (order: WorkOrder) => {
      await ordersDb.create(order);
      await refresh();
    },
    [refresh]
  );

  const update = useCallback(
    async (id: string, updates: Partial<WorkOrder>) => {
      await ordersDb.update(id, updates);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await ordersDb.delete(id);
      await refresh();
    },
    [refresh]
  );

  const filtered = orders.filter((o) => {
    if (filters.motorType !== "all" && o.motorType !== filters.motorType) return false;
    // Ocultar entregados por defecto; solo mostrar si el filtro lo selecciona explícitamente
    if (filters.status === "all" && o.status === "entregado") return false;
    if (filters.status !== "all" && o.status !== filters.status) return false;
    if (filters.overdueOnly && !isOverdue90Days(o)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      return (
        o.clientName.toLowerCase().includes(q) ||
        o.brand.toLowerCase().includes(q) ||
        o.model.toLowerCase().includes(q) ||
        o.clientPhone.includes(q)
      );
    }
    return true;
  });

  const overdueCount = orders.filter(isOverdue90Days).length;

  return {
    orders,
    filtered,
    filters,
    setFilters,
    create,
    update,
    remove,
    overdueCount,
    loading,
    refresh,
  };
}
