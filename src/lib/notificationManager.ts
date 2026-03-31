/**
 * Gestor centralizado de conexiones SSE
 * Singleton que mantiene un registro de todos los clientes SSE conectados
 * y permite broadcast de eventos a todos ellos
 */

interface MeliNotification {
  user_id: string;
  topic: string;
  resource: string;
  data: any;
  timestamp: string;
}

// Almacenar referencias a los controladores de respuesta para escribir eventos
let sseClients: Set<{
  controller: ReadableStreamDefaultController<string>;
  id: string;
}> = new Set();

export class NotificationManager {
  private static instance: NotificationManager;

  private constructor() {}

  static getInstance(): NotificationManager {
    if (!this.instance) {
      this.instance = new NotificationManager();
    }
    return this.instance;
  }

  /**
   * Registrar un nuevo cliente SSE
   */
  addClient(controller: ReadableStreamDefaultController<string>, id: string): void {
    sseClients.add({ controller, id });
    console.log(`[SSE] Cliente ${id} conectado. Total: ${sseClients.size}`);
  }

  /**
   * Desregistrar un cliente SSE
   */
  removeClient(id: string): void {
    sseClients.forEach((client) => {
      if (client.id === id) {
        sseClients.delete(client);
      }
    });
    console.log(`[SSE] Cliente ${id} desconectado. Total: ${sseClients.size}`);
  }

  /**
   * Enviar notificación a todos los clientes conectados
   */
  broadcast(notification: MeliNotification): void {
    const event = `event: notificacion_meli\ndata: ${JSON.stringify(notification)}\n\n`;

    let failedClients = 0;

    sseClients.forEach((client) => {
      try {
        client.controller.enqueue(event);
      } catch (error) {
        console.error(`[SSE] Error escribiendo a cliente ${client.id}:`, error);
        failedClients++;
      }
    });

    if (failedClients > 0) {
      console.warn(
        `[SSE] ${failedClients} cliente(s) fallaron al recibir broadcast`
      );
      // Limpiar clientes fallidos
      this.cleanupFailedClients();
    }

    console.log(
      `[SSE] Broadcast enviado a ${sseClients.size - failedClients} cliente(s)`
    );
  }

  /**
   * Limpiar referencias de clientes que fallaron
   */
  private cleanupFailedClients(): void {
    // Aquí podrías implementar lógica para remover clientes que fallaron
    // Por ahora, dejamos que se reintenten
  }

  /**
   * Obtener cantidad de clientes conectados
   */
  getClientCount(): number {
    return sseClients.size;
  }
}

export function getNotificationManager(): NotificationManager {
  return NotificationManager.getInstance();
}
