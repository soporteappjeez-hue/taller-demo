// Pendientes de entrega — localStorage con expiración a medianoche del mismo día

export interface PendienteEntrega {
  shipment_id: number;
  buyer_nickname: string | null;
  title: string;
  quantity: number;
  type: string; // flex | correo | turbo
  account: string;
  meli_user_id: string;
  seller_sku: string | null;
  thumbnail: string | null;
  order_date: string | null; // ISO timestamp de la compra
  added_at: string; // ISO timestamp
  expires_at: string; // medianoche del día siguiente (00:00)
}

const KEY = "appjeez_pendientes_entrega";

/** Calcula la medianoche del día siguiente (00:00:00.000 local) */
function nextMidnight(): Date {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d;
}

/** Lee los pendientes vigentes (filtra los expirados) */
export function getPendientes(): PendienteEntrega[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const all: PendienteEntrega[] = JSON.parse(raw);
    const now = Date.now();
    const vigentes = all.filter(p => new Date(p.expires_at).getTime() > now);
    // Persistir solo los vigentes (limpieza automática)
    if (vigentes.length !== all.length) {
      localStorage.setItem(KEY, JSON.stringify(vigentes));
    }
    return vigentes;
  } catch {
    return [];
  }
}

/** Agrega envíos al listado de pendientes (sin duplicar) */
export function addPendientes(
  items: Omit<PendienteEntrega, "added_at" | "expires_at">[]
): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getPendientes();
    const existingIds = new Set(existing.map(e => e.shipment_id));
    const expiresAt = nextMidnight().toISOString();
    const addedAt = new Date().toISOString();
    const nuevos: PendienteEntrega[] = items
      .filter(i => !existingIds.has(i.shipment_id))
      .map(i => ({ ...i, added_at: addedAt, expires_at: expiresAt }));
    localStorage.setItem(KEY, JSON.stringify([...existing, ...nuevos]));
  } catch {}
}

/** Elimina un envío de pendientes (al marcarlo como entregado) */
export function removePendiente(shipment_id: number): void {
  if (typeof window === "undefined") return;
  try {
    const vigentes = getPendientes().filter(p => p.shipment_id !== shipment_id);
    localStorage.setItem(KEY, JSON.stringify(vigentes));
  } catch {}
}

/** Elimina todos los pendientes */
export function clearPendientes(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
