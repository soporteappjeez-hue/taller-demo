"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface UseAutoRefreshReturn {
  isRefreshing: boolean;
  lastRefresh: Date | null;
  manualRefresh: () => Promise<void>;
}

/**
 * Hook para refresh MANUAL de datos (sin polling automático)
 * Con SSE/Webhooks activos, ya no necesitamos polling automático
 * Este hook solo proporciona función de refresh manual bajo demanda
 * 
 * enableAutomatic: DESACTIVADO por defecto (era 60s antes)
 */
export function useAutoRefresh(
  fetchFn: () => Promise<void>,
  enableAutomatic: boolean = false, // ⚠️ Ahora DESACTIVADO por defecto
  interval: number = 60000 // 60 segundos (no se usa si enableAutomatic=false)
): UseAutoRefreshReturn {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const manualRefresh = useCallback(async () => {
    if (isRefreshing) return; // Evitar multiples llamadas simultáneas

    setIsRefreshing(true);
    try {
      await fetchFn();
      setLastRefresh(new Date());
      console.log(`[REFRESH] Sincronización manual completada a las ${new Date().toLocaleTimeString("es-AR")}`);
    } catch (error) {
      console.error("[REFRESH] Error:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchFn, isRefreshing]);

  useEffect(() => {
    // Si automatic está desactivado, no iniciar polling
    if (!enableAutomatic) {
      console.log("[REFRESH] Polling automático DESACTIVADO (usando SSE/Webhooks)");
      return;
    }

    // Si está habilitado (caso legacy), hacer polling
    manualRefresh();

    intervalRef.current = setInterval(() => {
      manualRefresh();
    }, interval);

    console.warn("[REFRESH] ⚠️ Polling automático ACTIVADO (modo legacy)");

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enableAutomatic, interval, manualRefresh]);

  return {
    isRefreshing,
    lastRefresh,
    manualRefresh,
  };
}

