"use client";

import { WorkOrder, REPAIR_STATUS_LABELS, CLIENT_NOTIFICATION_LABELS } from "@/lib/types";
import { formatDate, formatCurrency, buildWhatsAppMessage } from "@/lib/utils";
import { Printer, X } from "lucide-react";

interface Props { order: WorkOrder; onClose: () => void; }

export default function PrintOrder({ order, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-start justify-center p-4 overflow-y-auto">
      {/* Controls - hidden on print */}
      <div className="no-print flex gap-3 fixed top-4 right-4 z-10">
        <button onClick={() => window.print()} className="btn-primary btn-sm rounded-xl">
          <Printer className="w-4 h-4" /> Imprimir
        </button>
        <button onClick={onClose} className="btn-secondary btn-sm rounded-xl">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Print area */}
      <div className="bg-white text-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl mt-14 print:mt-0
                      print:shadow-none print:rounded-none p-8 font-sans">
        {/* Header */}
        <div className="flex items-start justify-between border-b-4 border-orange-500 pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-black text-orange-500">MAQJEEZ</h1>
            <p className="text-gray-500 text-sm">Taller de Moto-Implementos y Motovehículos</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Orden de Trabajo</p>
            <p className="font-mono text-sm font-bold text-gray-700">{order.id.toUpperCase()}</p>
            <p className="text-xs text-gray-500">Ingreso: {formatDate(order.entryDate)}</p>
          </div>
        </div>

        {/* Client + Equipment */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2">Cliente</h3>
            <p className="font-bold text-lg">{order.clientName}</p>
            <p className="text-gray-600">{order.clientPhone}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2">Equipo</h3>
            <p className="font-bold text-lg">{order.brand} {order.model}</p>
            <p className="text-gray-600">Motor {order.motorType === "2T" ? "2 Tiempos" : "4 Tiempos"}</p>
          </div>
        </div>

        {/* Diagnosis */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2">Fallas Reportadas</h3>
          <div className="bg-gray-50 rounded-xl p-4 min-h-[60px]">
            <p className="text-gray-700 whitespace-pre-wrap">{order.reportedIssues || "—"}</p>
          </div>
        </div>

        {/* Economics + Status */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2">Presupuesto</h3>
            <p className="text-2xl font-black text-gray-900">{order.budget !== null ? formatCurrency(order.budget) : "Sin definir"}</p>
            <p className="text-sm text-gray-500">Tiempo est.: {order.estimatedDays ?? "—"} días</p>
            <p className="text-sm mt-1">
              Aceptado:{" "}
              <span className={`font-bold ${order.budgetAccepted ? "text-green-600" : "text-red-500"}`}>
                {order.budgetAccepted ? "Sí" : "No"}
              </span>
            </p>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2">Estado</h3>
            <p className="font-bold text-base">{REPAIR_STATUS_LABELS[order.status]}</p>
            <p className="text-sm text-gray-500 mt-1">Aviso: {CLIENT_NOTIFICATION_LABELS[order.clientNotification]}</p>
            {order.completionDate && <p className="text-xs text-gray-400 mt-1">Listo: {formatDate(order.completionDate)}</p>}
          </div>
        </div>

        {order.internalNotes && (
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2">Notas</h3>
            <p className="text-gray-600 text-sm whitespace-pre-wrap">{order.internalNotes}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-8 mt-8 pt-6 border-t border-gray-200">
          <div className="text-center">
            <div className="border-b border-gray-400 mb-2 h-10" />
            <p className="text-xs text-gray-500">Firma del Cliente</p>
          </div>
          <div className="text-center">
            <div className="border-b border-gray-400 mb-2 h-10" />
            <p className="text-xs text-gray-500">Firma del Taller</p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Taller MAQJEEZ · {formatDate(new Date().toISOString())}
        </p>
      </div>
    </div>
  );
}
