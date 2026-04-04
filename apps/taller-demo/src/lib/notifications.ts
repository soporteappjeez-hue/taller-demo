import { WorkOrder } from "./types";
import { buildWhatsAppUrl, isOverdue90Days, daysWaitingForPickup } from "./utils";

// ─── Notification types ───────────────────────────────────────

export type NotificationType =
  | "budget_ready"        // Presupuesto listo para comunicar
  | "repair_complete"     // Equipo listo para retirar
  | "no_response"         // Sin respuesta del cliente
  | "overdue_pickup"      // Más de 90 días esperando retiro
  | "waiting_parts"       // Esperando repuesto — avisar al cliente
  | "custom";             // Mensaje personalizado

export interface NotificationTemplate {
  type: NotificationType;
  label: string;
  icon: string;
  color: string;
  buildMessage: (order: WorkOrder) => string;
}

export interface SentNotification {
  id: string;
  orderId: string;
  clientName: string;
  clientPhone: string;
  type: NotificationType;
  message: string;
  sentAt: string; // ISO
}

// ─── Message templates ────────────────────────────────────────

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    type: "budget_ready",
    label: "Presupuesto listo",
    icon: "dollar",
    color: "blue",
    buildMessage: (o) =>
      `Hola ${o.clientName} 👋, le informamos que el presupuesto para su ${o.brand} ${o.model} está listo.\n\n` +
      `💰 Monto: $${o.budget ?? "a confirmar"}\n` +
      `⏱ Tiempo estimado: ${o.estimatedDays ? `${o.estimatedDays} días` : "a confirmar"}\n\n` +
      `Por favor, confirme si acepta el presupuesto para iniciar la reparación.\n\nGracias — AppJeez`,
  },
  {
    type: "repair_complete",
    label: "Equipo listo para retiro",
    icon: "check",
    color: "green",
    buildMessage: (o) =>
      `Hola ${o.clientName} 👋, ¡buenas noticias! Su ${o.brand} ${o.model} (${o.motorType}) ya está lista para ser retirada.\n\n` +
      `📍 Puede pasar por el local en el horario de atención.\n\n` +
      `Gracias por confiar en AppJeez 🔧`,
  },
  {
    type: "no_response",
    label: "Sin respuesta — seguimiento",
    icon: "phone",
    color: "yellow",
    buildMessage: (o) =>
      `Hola ${o.clientName}, le escribimos nuevamente desde AppJeez.\n\n` +
      `Intentamos contactarle por su ${o.brand} ${o.model} y no tuvimos respuesta.\n\n` +
      `Por favor, comuníquese a la brevedad. Gracias.`,
  },
  {
    type: "overdue_pickup",
    label: "Más de 90 días — retiro urgente",
    icon: "alert",
    color: "red",
    buildMessage: (o) => {
      const days = daysWaitingForPickup(o) ?? 90;
      return (
        `Hola ${o.clientName}, le informamos que su ${o.brand} ${o.model} lleva ${days} días en nuestro local esperando ser retirado.\n\n` +
        `⚠️ Le pedimos que se comunique o pase a retirar el equipo a la brevedad para evitar inconvenientes.\n\n` +
        `AppJeez — Tel/WA: [su número]`
      );
    },
  },
  {
    type: "waiting_parts",
    label: "Esperando repuesto",
    icon: "package",
    color: "orange",
    buildMessage: (o) =>
      `Hola ${o.clientName} 👋, le informamos que su ${o.brand} ${o.model} está en proceso de reparación.\n\n` +
      `🔧 Actualmente estamos esperando la llegada de un repuesto para continuar.\n` +
      `Le avisaremos en cuanto tengamos novedades.\n\nGracias — AppJeez`,
  },
];

// ─── Auto-detect pending notifications ───────────────────────

export interface PendingNotification {
  order: WorkOrder;
  template: NotificationTemplate;
  whatsappUrl: string;
  alreadySent: boolean;
  sentAt?: string;
}

export function detectPendingNotifications(
  orders: WorkOrder[],
  sentLog: SentNotification[]
): PendingNotification[] {
  const pending: PendingNotification[] = [];

  for (const order of orders) {
    if (order.status === "entregado") continue;

    const addIfNeeded = (type: NotificationType) => {
      const template = NOTIFICATION_TEMPLATES.find((t) => t.type === type)!;
      const message = template.buildMessage(order);
      const lastSent = sentLog
        .filter((s) => s.orderId === order.id && s.type === type)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];

      pending.push({
        order,
        template,
        whatsappUrl: buildWhatsAppUrl(order.clientPhone, message),
        alreadySent: !!lastSent,
        sentAt: lastSent?.sentAt,
      });
    };

    // Budget ready but not yet notified & not accepted
    if (
      order.budget !== null &&
      !order.budgetAccepted &&
      (order.clientNotification === "pendiente_de_aviso" ||
        order.clientNotification === "sin_respuesta")
    ) {
      addIfNeeded("budget_ready");
    }

    // Repair complete — needs pickup notification
    if (
      order.status === "listo_para_retiro" &&
      order.clientNotification !== "avisado"
    ) {
      addIfNeeded("repair_complete");
    }

    // Overdue 90 days
    if (isOverdue90Days(order)) {
      addIfNeeded("overdue_pickup");
    }

    // No response follow-up
    if (order.clientNotification === "sin_respuesta") {
      addIfNeeded("no_response");
    }

    // Waiting for parts
    if (order.status === "esperando_repuesto") {
      addIfNeeded("waiting_parts");
    }
  }

  // Deduplicate: one entry per order+type, prefer unsent first
  const seen = new Set<string>();
  return pending.filter((p) => {
    const key = `${p.order.id}-${p.template.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Sent log storage ─────────────────────────────────────────

const SENT_LOG_KEY = "appjeez_sent_notifications";

export function getSentLog(): SentNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SENT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToSentLog(entry: SentNotification): void {
  const log = getSentLog();
  localStorage.setItem(SENT_LOG_KEY, JSON.stringify([entry, ...log]));
}

export function clearSentLog(): void {
  localStorage.removeItem(SENT_LOG_KEY);
}
