import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  WorkOrder,
  REPAIR_STATUS_LABELS,
  CLIENT_NOTIFICATION_LABELS,
} from "./types";
import { formatDate, formatCurrency, isOverdue90Days, daysWaitingForPickup } from "./utils";

// ─── Color palette ───────────────────────────────────────────
const ORANGE = [234, 88, 12] as [number, number, number];
const DARK   = [17, 24, 39]  as [number, number, number];
const GRAY   = [75, 85, 99]  as [number, number, number];
const LIGHT  = [243, 244, 246] as [number, number, number];
const RED    = [220, 38, 38] as [number, number, number];
const GREEN  = [22, 163, 74] as [number, number, number];
const YELLOW = [202, 138, 4] as [number, number, number];
const WHITE  = [255, 255, 255] as [number, number, number];

function statusColor(status: WorkOrder["status"]): [number, number, number] {
  switch (status) {
    case "ingresado":          return GRAY;
    case "diagnosticando":     return [37, 99, 235];
    case "esperando_repuesto": return YELLOW;
    case "en_reparacion":      return ORANGE;
    case "listo_para_retiro":  return GREEN;
    case "entregado":          return [109, 40, 217];
    default:                   return GRAY;
  }
}

// ─── Header & footer helpers ─────────────────────────────────
function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  const pw = doc.internal.pageSize.getWidth();

  // Orange bar
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, pw, 22, "F");

  // Logo text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text("MAQJEEZ", 14, 14);

  // Subtitle in bar
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Taller de Moto-Implementos y Motovehículos", 60, 14);

  // Report title
  doc.setFillColor(...DARK);
  doc.rect(0, 22, pw, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...WHITE);
  doc.text(title, 14, 32);

  // Right side: date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(subtitle, pw - 14, 32, { align: "right" });
}

function drawFooter(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const pages = (doc as jsPDF & { internal: { getNumberOfPages: () => number } })
    .internal.getNumberOfPages();

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...DARK);
    doc.rect(0, ph - 10, pw, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text("MAQJEEZ — Sistema de Gestión de Taller", 14, ph - 3.5);
    doc.text(`Página ${i} de ${pages}`, pw - 14, ph - 3.5, { align: "right" });
  }
}

// ─── REPORT 1: Full orders list ───────────────────────────────
export function exportOrdersReportPDF(orders: WorkOrder[], filterLabel = "Todas las órdenes") {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const today = formatDate(new Date().toISOString());

  drawHeader(doc, `Reporte de Órdenes — ${filterLabel}`, `Generado: ${today}  |  Total: ${orders.length}`);

  const rows = orders.map((o) => {
    const overdue = isOverdue90Days(o);
    const days = daysWaitingForPickup(o);
    return [
      formatDate(o.entryDate),
      o.clientName,
      o.clientPhone,
      `${o.motorType} · ${o.brand} ${o.model}`,
      REPAIR_STATUS_LABELS[o.status] + (overdue && days ? `\n⚠ ${days}d en espera` : ""),
      CLIENT_NOTIFICATION_LABELS[o.clientNotification],
      o.budgetAccepted ? "Sí" : "No",
      o.budget !== null ? formatCurrency(o.budget) : "—",
      o.reportedIssues.length > 60 ? o.reportedIssues.slice(0, 57) + "..." : o.reportedIssues,
    ];
  });

  autoTable(doc, {
    startY: 40,
    head: [["Ingreso", "Cliente", "Teléfono", "Equipo", "Estado", "Aviso", "Presup.OK", "Monto", "Fallas"]],
    body: rows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: DARK,
      lineColor: [209, 213, 219],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 32 },
      2: { cellWidth: 28 },
      3: { cellWidth: 38 },
      4: { cellWidth: 34 },
      5: { cellWidth: 28 },
      6: { cellWidth: 18 },
      7: { cellWidth: 22 },
      8: { cellWidth: "auto" },
    },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 4) {
        const order = orders[data.row.index];
        if (isOverdue90Days(order)) {
          data.cell.styles.textColor = RED;
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = statusColor(order.status);
        }
      }
    },
  });

  drawFooter(doc);

  const fecha = new Date().toISOString().slice(0, 10);
  doc.save(`Reporte_Ordenes_MAQJEEZ_${fecha}.pdf`);
}

// ─── REPORT 2: Single order detail sheet ─────────────────────
export function exportOrderDetailPDF(o: WorkOrder) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const today = formatDate(new Date().toISOString());
  const overdue = isOverdue90Days(o);
  const waitDays = daysWaitingForPickup(o);

  drawHeader(doc, "Orden de Trabajo", `Generado: ${today}`);

  // ── Order ID badge ──
  doc.setFillColor(...ORANGE);
  doc.roundedRect(14, 40, pw - 28, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text(`N° Orden: ${o.id.toUpperCase()}   |   Ingreso: ${formatDate(o.entryDate)}`, pw / 2, 46.5, { align: "center" });

  // ── Overdue alert ──
  let y = 56;
  if (overdue && waitDays !== null) {
    doc.setFillColor(...RED);
    doc.roundedRect(14, y, pw - 28, 9, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text(`⚠  ALERTA: ${waitDays} días esperando retiro (más de 90 días)`, pw / 2, y + 6, { align: "center" });
    y += 14;
  }

  // ── Section helper ──
  const section = (title: string, startY: number) => {
    doc.setFillColor(...DARK);
    doc.rect(14, startY, pw - 28, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...ORANGE);
    doc.text(title.toUpperCase(), 17, startY + 5);
    return startY + 7;
  };

  const row = (label: string, value: string, x: number, rowY: number, w = 85) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(label, x, rowY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text(value || "—", x + 30, rowY);
    return rowY + 6;
  };

  // ── Client ──
  y = section("Datos del Cliente", y);
  y += 5;
  row("Cliente:", o.clientName, 14, y);
  row("Teléfono:", o.clientPhone, pw / 2, y);
  y += 8;

  // ── Equipment ──
  y = section("Datos del Equipo", y);
  y += 5;
  row("Tipo Motor:", MOTOR_TYPE_LABELS[o.motorType] ?? o.motorType, 14, y);
  row("Marca:", o.brand, pw / 2, y);
  y += 6;
  row("Modelo:", o.model, 14, y);
  y += 8;

  // ── Diagnosis ──
  y = section("Diagnóstico", y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Fallas reportadas:", 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  const issueLines = doc.splitTextToSize(o.reportedIssues || "—", pw - 28);
  doc.text(issueLines, 14, y);
  y += issueLines.length * 5 + 4;

  if (o.internalNotes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text("Notas internas:", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    const noteLines = doc.splitTextToSize(o.internalNotes, pw - 28);
    doc.text(noteLines, 14, y);
    y += noteLines.length * 5 + 4;
  }

  // ── Economics & tracking ──
  y = section("Gestión Económica y Seguimiento", y);
  y += 5;
  row("Presupuesto:", o.budget !== null ? formatCurrency(o.budget) : "Sin definir", 14, y);
  row("Días estimados:", o.estimatedDays !== null ? `${o.estimatedDays} días` : "Sin definir", pw / 2, y);
  y += 6;

  const sc = statusColor(o.status);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Estado:", 14, y);
  doc.setTextColor(...sc);
  doc.text(REPAIR_STATUS_LABELS[o.status], 44, y);

  doc.setTextColor(...GRAY);
  doc.text("Aviso cliente:", pw / 2, y);
  doc.setTextColor(...DARK);
  doc.text(CLIENT_NOTIFICATION_LABELS[o.clientNotification], pw / 2 + 30, y);
  y += 6;

  row("Presup. aceptado:", o.budgetAccepted ? "Sí" : "No", 14, y);
  if (o.completionDate) row("Listo para retiro:", formatDate(o.completionDate), pw / 2, y);
  y += 6;
  if (o.deliveryDate) { row("Fecha entrega:", formatDate(o.deliveryDate), 14, y); y += 6; }

  // ── WhatsApp message box ──
  y += 2;
  y = section("Mensaje WhatsApp Sugerido", y);
  y += 5;
  const msg = `Hola ${o.clientName}, te informamos que tu ${o.brand} ${o.model} (${o.motorType}) ya está lista para ser retirada en el taller MAQJEEZ. ¡Gracias por confiar en nosotros!`;
  doc.setFillColor(240, 253, 244);
  const msgLines = doc.splitTextToSize(msg, pw - 32);
  doc.roundedRect(14, y - 2, pw - 28, msgLines.length * 5 + 6, 2, 2, "F");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(21, 128, 61);
  doc.text(msgLines, 17, y + 3);

  drawFooter(doc);
  doc.save(`Orden_${o.clientName.replace(/\s+/g, "_")}_${o.id}.pdf`);
}
