import { differenceInDays, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
import { WorkOrder } from "./types";

export function formatDate(isoString: string): string {
  return format(parseISO(isoString), "dd/MM/yyyy", { locale: es });
}

export function formatDatetime(isoString: string): string {
  return format(parseISO(isoString), "dd/MM/yyyy HH:mm", { locale: es });
}

export function daysSince(isoString: string): number {
  return differenceInDays(new Date(), parseISO(isoString));
}

export function isOverdue90Days(order: WorkOrder): boolean {
  if (order.status !== "listo_para_retiro") return false;
  if (!order.completionDate) return false;
  return daysSince(order.completionDate) >= 90;
}

export function daysWaitingForPickup(order: WorkOrder): number | null {
  if (order.status !== "listo_para_retiro") return null;
  if (!order.completionDate) return null;
  return daysSince(order.completionDate);
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

export function buildWhatsAppMessage(order: WorkOrder): string {
  return `Hola ${order.clientName}, te informamos que tu ${order.brand} ${order.model} (${order.motorType}) ya está lista para ser retirada. ¡Gracias por confiar en nosotros!`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
