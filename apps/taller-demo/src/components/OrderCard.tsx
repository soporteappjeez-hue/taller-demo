"use client";

import {
  WorkOrder,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_COLORS,
  CLIENT_NOTIFICATION_LABELS,
  MOTOR_TYPE_LABELS,
} from "@/lib/types";
import {
  formatDate,
  formatCurrency,
  isOverdue90Days,
  daysWaitingForPickup,
  buildWhatsAppUrl,
  buildWhatsAppMessage,
} from "@/lib/utils";
import {
  Phone,
  Calendar,
  Clock,
  DollarSign,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Printer,
  User,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import { useState } from "react";
import { exportOrderDetailPDF } from "@/lib/exportPDF";
import PaymentModal from "@/components/PaymentModal";
import PrintOrder from "@/components/PrintOrder";
import ClientHistory from "@/components/ClientHistory";
import PhotoManager from "@/components/PhotoManager";
import BudgetImage from "@/components/BudgetImage";

interface OrderCardProps {
  order: WorkOrder;
  onEdit: (order: WorkOrder) => void;
  onDelete: (id: string) => void;
}

const NOTIFICATION_COLORS: Record<string, string> = {
  pendiente_de_aviso: "text-yellow-400",
  avisado: "text-green-400",
  sin_respuesta: "text-red-400",
};

export default function OrderCard({ order, onEdit, onDelete }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(order);

  const overdue = isOverdue90Days(currentOrder);
  const waitingDays = daysWaitingForPickup(currentOrder);
  const waUrl = buildWhatsAppUrl(currentOrder.clientPhone, buildWhatsAppMessage(currentOrder));

  const handleDelete = () => {
    if (confirm(`¿Eliminar la orden de ${currentOrder.clientName}?`)) {
      onDelete(currentOrder.id);
    }
  };

  return (
    <>
      <div
        className={`rounded-2xl border transition-all duration-200 overflow-hidden
          ${overdue
            ? "bg-red-950/60 border-red-600 shadow-red-900/30 shadow-lg"
            : "bg-gray-900 border-gray-700"
          }`}
      >
        {/* Alerta 90 días */}
        {overdue && waitingDays !== null && (
          <div className="bg-red-600 px-4 py-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-white flex-shrink-0" />
            <span className="text-white text-sm font-bold">
              ALERTA: {waitingDays} días esperando retiro
            </span>
          </div>
        )}

        <div className="p-4 space-y-3">

          {/* ── Fila 1: Badges ── */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="text-xs font-black px-2 py-0.5 rounded-lg border bg-orange-500/20 text-orange-300 border-orange-500/40"
            >
              {MOTOR_TYPE_LABELS[currentOrder.motorType as keyof typeof MOTOR_TYPE_LABELS]
                ?? currentOrder.motorType}
              {currentOrder.motorType === "otros" && (currentOrder as WorkOrder & { machineTypeOther?: string }).machineTypeOther
                ? `: ${(currentOrder as WorkOrder & { machineTypeOther?: string }).machineTypeOther}`
                : ""}
            </span>
            {currentOrder.extraMachines && currentOrder.extraMachines.length > 0 && (
              <span className="text-xs font-black px-2 py-0.5 rounded-lg border bg-green-500/20 text-green-400 border-green-500/40">
                +{currentOrder.extraMachines.length} maq.
              </span>
            )}
            <span className={`badge ${REPAIR_STATUS_COLORS[currentOrder.status]}`}>
              {REPAIR_STATUS_LABELS[currentOrder.status]}
            </span>
            {currentOrder.budgetAccepted && (
              <span className="badge bg-green-900/50 text-green-400 border-green-600">
                <CheckCircle className="w-3 h-3" /> Presup. OK
              </span>
            )}
            {(currentOrder.photoUrls?.length ?? 0) > 0 && (
              <span className="badge bg-purple-900/50 text-purple-400 border-purple-600">
                <Camera className="w-3 h-3" /> {currentOrder.photoUrls.length}
              </span>
            )}
          </div>

          {/* ── Fila 2: Nombre + acciones principales ── */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-white font-bold text-lg leading-tight truncate">
                {currentOrder.clientName}
              </h3>
              <p className="text-gray-400 text-sm truncate">
                {currentOrder.brand} {currentOrder.model}
              </p>
            </div>

            {/* Acciones primarias — siempre visibles */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-whatsapp btn-sm px-3 rounded-xl"
                title="WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">WA</span>
              </a>
              <button
                onClick={() => onEdit(currentOrder)}
                className="btn btn-secondary btn-sm px-3 rounded-xl"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Fila 3: Info rápida ── */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1 text-gray-400">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-gray-200">{formatDate(currentOrder.entryDate)}</span>
            </span>
            {currentOrder.budget !== null && (
              <span className="flex items-center gap-1 text-gray-400">
                <DollarSign className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-200 font-semibold">{formatCurrency(currentOrder.budget)}</span>
              </span>
            )}
            {currentOrder.estimatedDays !== null && (
              <span className="flex items-center gap-1 text-gray-400">
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                {currentOrder.estimatedDays}d est.
              </span>
            )}
            <span className={`flex items-center gap-1 ${NOTIFICATION_COLORS[currentOrder.clientNotification] ?? "text-gray-400"}`}>
              <Phone className="w-3.5 h-3.5" />
              {CLIENT_NOTIFICATION_LABELS[currentOrder.clientNotification]}
            </span>
          </div>

          {/* ── Fila 4: Acciones secundarias ── */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-700/60">
            <button
              onClick={() => setShowBudget(true)}
              className="btn btn-sm flex-1 rounded-xl bg-orange-500/20 text-orange-300 hover:bg-orange-500/40 border border-orange-500/40 font-bold"
              title="Generar Presupuesto PNG"
            >
              <ImageIcon className="w-4 h-4" />
              <span className="text-xs">Presupuesto</span>
            </button>
            <button
              onClick={() => setShowPayment(true)}
              className="btn btn-sm flex-1 min-w-[44px] max-w-[80px] rounded-xl bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-700/50"
              title="Pagos"
            >
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Pagos</span>
            </button>
            <button
              onClick={() => setShowPrint(true)}
              className="btn btn-sm flex-1 min-w-[44px] max-w-[80px] rounded-xl bg-gray-800 text-blue-400 hover:bg-blue-900/30 border border-gray-700"
              title="Imprimir"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Imprimir</span>
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="btn btn-sm flex-1 min-w-[44px] max-w-[80px] rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"
              title="Historial"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Historial</span>
            </button>
            <button
              onClick={() => setShowPhotos(true)}
              className="btn btn-sm flex-1 min-w-[44px] max-w-[80px] rounded-xl bg-gray-800 text-purple-400 hover:bg-purple-900/30 border border-gray-700"
              title="Fotos"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Fotos</span>
            </button>
            <button
              onClick={() => exportOrderDetailPDF(currentOrder)}
              className="btn btn-sm flex-1 min-w-[44px] max-w-[80px] rounded-xl bg-gray-800 text-red-400 hover:bg-red-900/30 border border-gray-700"
              title="PDF"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">PDF</span>
            </button>
            <button
              onClick={handleDelete}
              className="btn btn-sm flex-1 min-w-[44px] max-w-[80px] rounded-xl bg-gray-800 text-gray-500 hover:text-red-400 hover:bg-red-900/30 border border-gray-700"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* ── Expandir detalle ── */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? "Ver menos" : "Ver detalle"}
          </button>

          {expanded && (
            <div className="pt-2 border-t border-gray-700/60 space-y-2">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fallas reportadas</span>
                <p className="text-gray-300 text-sm mt-0.5 whitespace-pre-wrap">{currentOrder.reportedIssues}</p>
              </div>
              {currentOrder.internalNotes && (
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notas internas</span>
                  <p className="text-gray-300 text-sm mt-0.5 whitespace-pre-wrap">{currentOrder.internalNotes}</p>
                </div>
              )}
              {currentOrder.completionDate && (
                <p className="text-xs text-gray-500">
                  Listo: <span className="text-gray-300">{formatDate(currentOrder.completionDate)}</span>
                </p>
              )}
              {currentOrder.deliveryDate && (
                <p className="text-xs text-gray-500">
                  Entregado: <span className="text-gray-300">{formatDate(currentOrder.deliveryDate)}</span>
                </p>
              )}
              {(currentOrder.photoUrls?.length ?? 0) > 0 && (
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fotos</span>
                  <div className="flex gap-2 mt-1 overflow-x-auto pb-1">
                    {currentOrder.photoUrls.map((url, i) => (
                      <img key={i} src={url} alt={`Foto ${i + 1}`}
                        className="h-16 w-16 object-cover rounded-lg border border-gray-700 flex-shrink-0" />
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-600">ID: {currentOrder.id}</p>
            </div>
          )}
        </div>
      </div>

      {showPayment && <PaymentModal order={currentOrder} onClose={() => setShowPayment(false)} />}
      {showPrint && <PrintOrder order={currentOrder} onClose={() => setShowPrint(false)} />}
      {showBudget && <BudgetImage order={currentOrder} onClose={() => setShowBudget(false)} />}
      {showHistory && (
        <ClientHistory
          phone={currentOrder.clientPhone}
          clientName={currentOrder.clientName}
          onClose={() => setShowHistory(false)}
          onSelect={(o) => onEdit(o)}
        />
      )}
      {showPhotos && (
        <PhotoManager
          order={currentOrder}
          onClose={() => setShowPhotos(false)}
          onUpdated={(urls) => setCurrentOrder((prev) => ({ ...prev, photoUrls: urls }))}
        />
      )}
    </>
  );
}
