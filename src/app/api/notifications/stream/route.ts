import { NextRequest } from "next/server";
import { getNotificationManager } from "@/lib/notificationManager";

/**
 * GET /api/notifications/stream
 * Abre una conexión SSE (Server-Sent Events) para recibir notificaciones en tiempo real
 * 
 * El cliente conecta y recibe eventos cuando MeLi notifica
 */
export async function GET(request: NextRequest) {
  // Generar ID único para este cliente
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[SSE] Iniciando stream para cliente: ${clientId}`);

  // Crear un ReadableStream que permanecerá abierto
  const customReadable = new ReadableStream({
    start(controller) {
      const notificationManager = getNotificationManager();

      // Registrar cliente
      notificationManager.addClient(controller, clientId);

      // Enviar comentario inicial para verificar conexión
      try {
        controller.enqueue(": SSE stream iniciado\n\n");
      } catch (error) {
        console.error(`[SSE] Error enviando mensaje inicial a ${clientId}:`, error);
      }

      // Manejar cierre de conexión
      const abortHandler = () => {
        console.log(`[SSE] Conexión cerrada por cliente: ${clientId}`);
        notificationManager.removeClient(clientId);
        try {
          controller.close();
        } catch {
          // Ya está cerrado
        }
      };

      request.signal.addEventListener("abort", abortHandler);

      // Mantener viva la conexión con heartbeat cada 30s
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(": heartbeat\n\n");
        } catch (error) {
          console.error(`[SSE] Error enviando heartbeat a ${clientId}:`, error);
          clearInterval(heartbeatInterval);
          notificationManager.removeClient(clientId);
          try {
            controller.close();
          } catch {
            // Ya está cerrado
          }
        }
      }, 30000); // Cada 30 segundos

      // Cleanup cuando se cierre el stream
      return () => {
        clearInterval(heartbeatInterval);
        request.signal.removeEventListener("abort", abortHandler);
        notificationManager.removeClient(clientId);
      };
    },
  });

  // Retornar response con headers SSE
  return new Response(customReadable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Evitar buffering en proxies
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

/**
 * OPTIONS /api/notifications/stream
 * Manejo de CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
