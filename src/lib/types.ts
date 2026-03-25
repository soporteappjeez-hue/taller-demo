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

// ============================================================
// LOGÍSTICA FLEX — Mercado Libre
// ============================================================

export type FlexZona = "cercana" | "media" | "lejana";

export interface FlexTarifa {
  zona: FlexZona;
  label: string;
  precio: number;
}

export const FLEX_TARIFAS: FlexTarifa[] = [
  { zona: "cercana", label: "Zona Cercana", precio: 4490 },
  { zona: "media",   label: "Zona Media",   precio: 6490 },
  { zona: "lejana",  label: "Zona Lejana",  precio: 8490 },
];

export const FLEX_LOCALIDADES: { nombre: string; zona: FlexZona }[] = [
  // Cercanas
  { nombre: "Ezeiza",                zona: "cercana" },
  // Media distancia
  { nombre: "Esteban Echeverría",    zona: "media" },
  { nombre: "La Matanza Sur",        zona: "media" },
  // Lejanas
  { nombre: "Alte. Brown",           zona: "lejana" },
  { nombre: "Avellaneda",            zona: "lejana" },
  { nombre: "Berazategui",           zona: "lejana" },
  { nombre: "Berisso",               zona: "lejana" },
  { nombre: "CABA",                  zona: "lejana" },
  { nombre: "Campana",               zona: "lejana" },
  { nombre: "Cañuelas",              zona: "lejana" },
  { nombre: "Del Viso",              zona: "lejana" },
  { nombre: "Derqui",                zona: "lejana" },
  { nombre: "Ensenada",              zona: "lejana" },
  { nombre: "Escobar",               zona: "lejana" },
  { nombre: "Florencio Varela",      zona: "lejana" },
  { nombre: "Garín",                 zona: "lejana" },
  { nombre: "Gral. Rodríguez",       zona: "lejana" },
  { nombre: "Guernica",              zona: "lejana" },
  { nombre: "Hurlingham",            zona: "lejana" },
  { nombre: "Ing. Maschwitz",        zona: "lejana" },
  { nombre: "Ituzaingó",             zona: "lejana" },
  { nombre: "José C. Paz",           zona: "lejana" },
  { nombre: "La Matanza Norte",      zona: "lejana" },
  { nombre: "La Plata Centro",       zona: "lejana" },
  { nombre: "La Plata Norte",        zona: "lejana" },
  { nombre: "La Plata Oeste",        zona: "lejana" },
  { nombre: "Lanús",                 zona: "lejana" },
  { nombre: "Lomas de Zamora",       zona: "lejana" },
  { nombre: "Luján",                 zona: "lejana" },
  { nombre: "Malvinas Argentinas",   zona: "lejana" },
  { nombre: "Marcos Paz",            zona: "lejana" },
  { nombre: "Merlo",                 zona: "lejana" },
  { nombre: "Moreno",                zona: "lejana" },
  { nombre: "Morón",                 zona: "lejana" },
  { nombre: "Nordelta",              zona: "lejana" },
  { nombre: "Pilar",                 zona: "lejana" },
  { nombre: "Quilmes",               zona: "lejana" },
  { nombre: "San Fernando",          zona: "lejana" },
  { nombre: "San Isidro",            zona: "lejana" },
  { nombre: "San Martín",            zona: "lejana" },
  { nombre: "San Miguel",            zona: "lejana" },
  { nombre: "San Vicente",           zona: "lejana" },
  { nombre: "Tigre",                 zona: "lejana" },
  { nombre: "Tres de Febrero",       zona: "lejana" },
  { nombre: "Vicente López",         zona: "lejana" },
  { nombre: "Villa Rosa",            zona: "lejana" },
  { nombre: "Zárate",                zona: "lejana" },
];

export interface FlexEnvio {
  id: string;
  fecha: string;
  localidad: string;
  zona: FlexZona;
  precioML: number;
  pagoFlete: number;
  ganancia: number;
  descripcion: string;
  nroSeguimiento: string;
  // Nuevos campos de etiqueta ML
  usuarioML: string;
  nombreDestinatario: string;
  direccion: string;
  codigoPostal: string;
  productoSku: string;
  packId: string;
  createdAt: string;
}

export type FidelFase = "bronce" | "plata" | "oro";

export interface ClienteFlex {
  id: string;
  usuarioML: string;
  nombre: string;
  totalCompras: number;
  comprasEsteMes: number;
  fase: FidelFase;
  ultimoProducto: string;
  ultimaLocalidad: string;
  fechaUltimaCompra: string;
  createdAt: string;
}

export interface FidelAlerta {
  usuarioML: string;
  nombre: string;
  totalCompras: number;
  comprasEsteMes: number;
  fase: FidelFase;
  esNuevoNivel: boolean;       // acaba de subir de fase en esta compra
  regalSugerido: string;
  ultimoProducto: string;
}
