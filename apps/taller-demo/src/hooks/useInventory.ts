"use client";

import { useState, useEffect, useCallback } from "react";
import { StockItem, PartToOrder } from "@/lib/types";
import { stockDb, partsToOrderDb } from "@/lib/db";

export function useInventory() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [partsToOrder, setPartsToOrder] = useState<PartToOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([stockDb.getAll(), partsToOrderDb.getAll()]);
      setStock(s);
      setPartsToOrder(p);
    } catch (e) {
      console.error("Error cargando inventario:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createStock = useCallback(async (item: StockItem) => { await stockDb.create(item); await refresh(); }, [refresh]);
  const updateStock = useCallback(async (id: string, updates: Partial<StockItem>) => { await stockDb.update(id, updates); await refresh(); }, [refresh]);
  const deleteStock = useCallback(async (id: string) => { await stockDb.delete(id); await refresh(); }, [refresh]);

  const createPart = useCallback(async (part: PartToOrder) => { await partsToOrderDb.create(part); await refresh(); }, [refresh]);
  const updatePart = useCallback(async (id: string, updates: Partial<PartToOrder>) => { await partsToOrderDb.update(id, updates); await refresh(); }, [refresh]);
  const deletePart = useCallback(async (id: string) => { await partsToOrderDb.delete(id); await refresh(); }, [refresh]);

  const lowStockCount = stock.filter((s) => s.quantity <= s.minQuantity).length;
  const pendingPartsCount = partsToOrder.filter((p) => p.status === "pendiente" || p.status === "pedido").length;

  return {
    stock,
    partsToOrder,
    createStock,
    updateStock,
    deleteStock,
    createPart,
    updatePart,
    deletePart,
    lowStockCount,
    pendingPartsCount,
    loading,
    refresh,
  };
}
