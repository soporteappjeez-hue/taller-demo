"use client";

import { useState, useEffect } from "react";
import { WorkOrder, REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS } from "@/lib/types";
import { ordersDb } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { X, User, Clock } from "lucide-react";

interface Props { phone: string; clientName: string; onClose: () => void; onSelect: (o: WorkOrder) => void; }

export default function ClientHistory({ phone, clientName, onClose, onSelect }: Props) {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersDb.getAll().then((all) => {
      setOrders(all.filter((o) => o.clientPhone === phone));
      setLoading(false);
    });
  }, [phone]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-gray-700 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 rounded-xl p-2"><User className="w-5 h-5 text-white" /></div>
            <div>
              <h2 className="text-white font-bold">Historial del Cliente</h2>
              <p className="text-gray-400 text-xs">{clientName} · {phone}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm p-2.5 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-gray-400 text-center py-10">No hay más órdenes para este cliente</p>
          ) : (
            <>
              <p className="text-gray-500 text-xs">{orders.length} orden{orders.length !== 1 ? "es" : ""} en total</p>
              {orders.map((o) => (
                <button key={o.id} onClick={() => { onSelect(o); onClose(); }}
                  className="w-full card text-left hover:border-orange-500/50 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`badge ${REPAIR_STATUS_COLORS[o.status]}`}>{REPAIR_STATUS_LABELS[o.status]}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />{formatDate(o.entryDate)}
                    </span>
                  </div>
                  <p className="text-white font-semibold">{o.brand} {o.model} <span className="text-gray-500 text-sm">({o.motorType})</span></p>
                  <p className="text-gray-400 text-sm mt-0.5 line-clamp-1">{o.reportedIssues}</p>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
