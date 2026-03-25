// ============================================================
// TIPOS CENTRALES — Taller MAQJEEZ
// Diseñado para MVP con localStorage y migración fácil a Supabase/PostgreSQL
// ============================================================

export type MotorType = "2T" | "4T";

export type RepairStatus =
  | "ingresado"
  | "diagnosticando"
  | "esperando_repuesto"
  | "en_reparacion"
  | "listo_para_retiro"
  | "entregado";

export type ClientNotification =
  | "pendiente_de_aviso"
  | "avisado"
  | "sin_respuesta";

export interface WorkOrder {
  id: string;
  // Datos del cliente
  clientName: string;
  clientPhone: string;
  // Datos del equipo
  motorType: MotorType;
  brand: string;
  model: string;
  // Diagnóstico
  reportedIssues: string;
  // Gestión económica
  budget: number | null;
  estimatedDays: number | null;
  // Seguimiento
  status: RepairStatus;
  clientNotification: ClientNotification;
  budgetAccepted: boolean;
  // Fechas
  entryDate: string; // ISO string — automática al crear
  completionDate: string | null; // ISO string — cuando pasa a "listo_para_retiro"
  deliveryDate: string | null; // ISO string — cuando se entrega
  // Inventario vinculado
  linkedParts: string[]; // IDs de PartToOrder
  // Notas internas
  internalNotes: string;
  // Fotos
  photoUrls: string[];
  // Pagos
  totalPaid?: number;
}

export interface Pago {
  id: string;
  orderId: string;
  amount: number;
  method: "efectivo" | "transferencia" | "tarjeta" | "otro";
  notes: string;
  paidAt: string;
}

export interface PlantillaWhatsApp {
  id: string;
  name: string;
  message: string;
  createdAt: string;
}

export const PAYMENT_METHOD_LABELS: Record<Pago["method"], string> = {
  efectivo:      "Efectivo",
  transferencia: "Transferencia",
  tarjeta:       "Tarjeta",
  otro:          "Otro",
};

export interface StockItem {
  id: string;
  name: string;
  quantity: number;
  location: string; // ej: "Estante A-3", "Cajón 2"
  minQuantity: number; // alerta de stock bajo
  notes: string;
}

export interface PartToOrder {
  id: string;
  name: string;
  quantity: number;
  orderId: string | null; // vinculado a una orden de trabajo
  orderClientName: string | null; // para referencia rápida
  supplier: string;
  status: "pendiente" | "pedido" | "recibido";
  notes: string;
  createdAt: string;
}

// ============================================================
// Etiquetas legibles para la UI
// ============================================================

export const MOTOR_TYPE_LABELS: Record<MotorType, string> = {
  "2T": "2 Tiempos (2T)",
  "4T": "4 Tiempos (4T)",
};

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  ingresado: "Ingresado",
  diagnosticando: "Diagnosticando",
  esperando_repuesto: "Esperando Repuesto",
  en_reparacion: "En Reparación",
  listo_para_retiro: "Listo para Retiro",
  entregado: "Entregado",
};

export const REPAIR_STATUS_COLORS: Record<RepairStatus, string> = {
  ingresado: "bg-gray-100 text-gray-700 border-gray-300",
  diagnosticando: "bg-blue-100 text-blue-700 border-blue-300",
  esperando_repuesto: "bg-yellow-100 text-yellow-700 border-yellow-300",
  en_reparacion: "bg-orange-100 text-orange-700 border-orange-300",
  listo_para_retiro: "bg-green-100 text-green-700 border-green-300",
  entregado: "bg-purple-100 text-purple-700 border-purple-300",
};

export const CLIENT_NOTIFICATION_LABELS: Record<ClientNotification, string> = {
  pendiente_de_aviso: "Pendiente de Aviso",
  avisado: "Avisado",
  sin_respuesta: "Sin Respuesta",
};

export interface AgendaCliente {
  id: string;
  nombre: string;
  telefono: string;
  createdAt: string;
}

export interface HistorialReparacion {
  id: string;
  clienteId: string;
  ordenId: string | null;
  fechaIngreso: string;
  motorType: string;
  brand: string;
  model: string;
  falla: string;
  trabajo: string;
  presupuesto: number | null;
  estadoFinal: string;
  photoUrls: string[];
  createdAt: string;
}

export const PART_ORDER_STATUS_LABELS: Record<
  PartToOrder["status"],
  string
> = {
  pendiente: "Pendiente",
  pedido: "Pedido",
  recibido: "Recibido",
};
