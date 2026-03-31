"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface MeliNotification {
  user_id: string;
  topic: string;
  resource: string;
  data: any;
  timestamp: string;
}

interface UseNotificationStreamReturn {
  connected: boolean;
  error: Error | null;
}

/**
 * Hook React para conectarse al stream SSE de notificaciones en tiempo real
 * Se reconecta automáticamente cada 5s si la conexión cae
 */
export function useNotificationStream(
  onNotification: (data: MeliNotification) => void,
  enabled: boolean = true
): UseNotificationStreamReturn {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCleaningUp = useRef(false);

  const connect = useCallback(() => {
    if (!enabled || isCleaningUp.current) return;

    try {
      // Obtener URL base
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || `${window.location.origin}`;

      // Crear conexión SSE
      const eventSource = new EventSource(`${apiUrl}/api/notifications/stream`);

      eventSource.addEventListener("notificacion_meli", (event: Event) => {
        try {
          const customEvent = event as MessageEvent;
          const notification = JSON.parse(customEvent.data) as MeliNotification;
          onNotification(notification);
          console.log("[SSE] Notificación recibida:", notification);
        } catch (parseError) {
          console.error("[SSE] Error parseando notificación:", parseError);
        }
      });

      eventSource.addEventListener("open", () => {
        console.log("[SSE] Conexión establecida");
        setConnected(true);
        setError(null);
      });

      eventSource.addEventListener("error", () => {
        console.warn("[SSE] Error en conexión");
        if (eventSource.readyState === EventSource.CLOSED) {
          setConnected(false);
          eventSource.close();
          eventSourceRef.current = null;

          // Intentar reconectar en 5s
          if (!isCleaningUp.current) {
            reconnectTimeoutRef.current = setTimeout(connect, 5000);
          }
        }
      });

      eventSourceRef.current = eventSource;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("[SSE] Error conectando:", error);
      setError(error);
      setConnected(false);

      // Reintentar en 5s
      if (!isCleaningUp.current) {
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      }
    }
  }, [enabled, onNotification]);

  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      setConnected(false);
      return;
    }

    connect();

    // Cleanup al desmontar
    return () => {
      isCleaningUp.current = true;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      setConnected(false);
      isCleaningUp.current = false;
    };
  }, [enabled, connect]);

  return {
    connected,
    error,
  };
}
