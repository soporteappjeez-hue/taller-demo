import * as XLSX from "xlsx";
import { WorkOrder, REPAIR_STATUS_LABELS, CLIENT_NOTIFICATION_LABELS, MOTOR_TYPE_LABELS } from "./types";
import { formatDate, formatCurrency } from "./utils";

export function exportOrdersToExcel(orders: WorkOrder[]): void {
  const rows = orders.map((o) => ({
    "ID": o.id,
    "Fecha Ingreso": formatDate(o.entryDate),
    "Cliente": o.clientName,
    "Teléfono": o.clientPhone,
    "Tipo Motor": MOTOR_TYPE_LABELS[o.motorType],
    "Marca": o.brand,
    "Modelo": o.model,
    "Fallas Reportadas": o.reportedIssues,
    "Estado": REPAIR_STATUS_LABELS[o.status],
    "Aviso al Cliente": CLIENT_NOTIFICATION_LABELS[o.clientNotification],
    "Presupuesto Aceptado": o.budgetAccepted ? "Sí" : "No",
    "Presupuesto ($)": o.budget !== null ? o.budget : "",
    "Días Estimados": o.estimatedDays !== null ? o.estimatedDays : "",
    "Fecha Lista para Retiro": o.completionDate ? formatDate(o.completionDate) : "",
    "Fecha Entrega": o.deliveryDate ? formatDate(o.deliveryDate) : "",
    "Notas Internas": o.internalNotes,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Ancho de columnas
  ws["!cols"] = [
    { wch: 14 }, // ID
    { wch: 14 }, // Fecha Ingreso
    { wch: 22 }, // Cliente
    { wch: 18 }, // Teléfono
    { wch: 16 }, // Tipo Motor
    { wch: 14 }, // Marca
    { wch: 16 }, // Modelo
    { wch: 40 }, // Fallas
    { wch: 22 }, // Estado
    { wch: 22 }, // Aviso
    { wch: 22 }, // Presup. Aceptado
    { wch: 16 }, // Presupuesto
    { wch: 16 }, // Días Estimados
    { wch: 22 }, // Fecha Lista
    { wch: 16 }, // Fecha Entrega
    { wch: 40 }, // Notas
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Órdenes");

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Ordenes_AppJeez_${fecha}.xlsx`);
}
