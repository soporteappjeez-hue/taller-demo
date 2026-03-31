"use client";

import { useEffect, useState, useCallback } from "react";

interface Reputation {
  level_id: string | null;
  level_name: string;
  power_seller_status: string | null;
  transactions_total: number;
  transactions_completed: number;
  ratings_positive: number;
  ratings_negative: number;
  ratings_neutral: number;
  delayed_handling_time: number;
  claims: number;
  cancellations: number;
  immediate_payment: boolean;
}

interface Item {
  id: string;
  title: string;
  status: string;
  available_quantity: number;
  total_quantity: number;
  price: number;
  currency_id: string;
}

interface Stats {
  total_active_items: number;
  items_low_stock: number;
  items_out_of_stock: number;
}

interface MeliAccountData {
  reputation: Reputation | null;
  items: Item[];
  stats: Stats;
}

interface UseMeliAccountDataReturn {
  data: MeliAccountData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook para cargar datos en tiempo real de una cuenta MeLi específica
 * Carga reputación, publicaciones activas e información de stock
 */
export function useMeliAccountData(userId: string | null): UseMeliAccountDataReturn {
  const [data, setData] = useState<MeliAccountData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedUserId, setLastFetchedUserId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setData(null);
      setError(null);
      return;
    }

    // Evitar refetch innecesarios si ya se cargó este usuario
    if (lastFetchedUserId === userId && data) {
      console.log(`[useMeliAccountData] Usando datos cacheados para ${userId}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`[useMeliAccountData] Cargando datos para ${userId}...`);
      const res = await fetch(`/api/meli-account/${userId}`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const accountData: MeliAccountData = await res.json();
      setData(accountData);
      setLastFetchedUserId(userId);
      console.log(`[useMeliAccountData] Datos cargados exitosamente`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[useMeliAccountData] Error:`, errorMsg);
      setError(errorMsg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, lastFetchedUserId, data]);

  // Cargar datos cuando cambia userId
  useEffect(() => {
    fetchData();
  }, [userId, fetchData]);

  const refetch = useCallback(async () => {
    setLastFetchedUserId(null); // Forzar recarga
    await fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}
