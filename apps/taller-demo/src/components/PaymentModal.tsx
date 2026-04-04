"use client";

import { useState, useEffect } from "react";
import { WorkOrder, Pago, PAYMENT_METHOD_LABELS } from "@/lib/types";
import { pagosDb } from "@/lib/db";
import { generateId, formatDate, formatCurrency } from "@/lib/utils";
import { X, DollarSign, Plus, Trash2, CheckCircle } from "lucide-react";

interface Props { order: WorkOrder; onClose: () => void; }

export default function PaymentModal({ order, onClose }: Props) {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Pago["method"]>("efectivo");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setPagos(await pagosDb.getByOrder(order.id)); } catch {}
  };

  useEffect(() => { load(); }, [order.id]);

  const total = pagos.reduce((s, p) => s + p.amount, 0);
  const remaining = (order.budget ?? 0) - total;

  const handleAdd = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      await pagosDb.create({
        id: generateId(), orderId: order.id,
        amount: Number(amount), method, notes,
        paidAt: new Date().toISOString(),
      });
      setAmount(""); setNotes("");
      await load();
    } catch (e) { alert("Error al guardar pago: " + e); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este pago?")) return;
    await pagosDb.delete(id); await load();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-gray-700 shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 rounded-xl p-2"><DollarSign className="w-5 h-5 text-white" /></div>
            <div>
              <h2 className="text-white font-bold text-base">Registro de Pagos</h2>
              <p className="text-gray-400 text-xs">{order.clientName} · {order.brand} {order.model}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm p-2.5 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="card py-3">
              <p className="text-xs text-gray-500">Presupuesto</p>
              <p className="text-white font-bold">{formatCurrency(order.budget ?? 0)}</p>
            </div>
            <div className="card py-3">
              <p className="text-xs text-gray-500">Pagado</p>
              <p className="text-green-400 font-bold">{formatCurrency(total)}</p>
            </div>
            <div className={`card py-3 ${remaining > 0 ? "border-red-700" : "border-green-700"}`}>
              <p className="text-xs text-gray-500">Saldo</p>
              <p className={`font-bold ${remaining > 0 ? "text-red-400" : "text-green-400"}`}>{formatCurrency(remaining)}</p>
            </div>
          </div>

          {remaining <= 0 && (
            <div className="flex items-center gap-2 text-green-400 text-sm font-bold bg-green-900/30 rounded-xl px-4 py-2">
              <CheckCircle className="w-4 h-4" /> Pago completo
            </div>
          )}

          {/* Add payment */}
          <div className="card space-y-3">
            <p className="text-white font-bold text-sm">Registrar nuevo pago</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Monto ($)</label>
                <input type="number" className="input input-sm" placeholder="0" min="0"
                  value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">Método</label>
                <select className="input input-sm" value={method} onChange={(e) => setMethod(e.target.value as Pago["method"])}>
                  {(Object.keys(PAYMENT_METHOD_LABELS) as Pago["method"][]).map((m) => (
                    <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                  ))}
                </select>
              </div>
            </div>
            <input type="text" className="input input-sm" placeholder="Notas opcionales..."
              value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button onClick={handleAdd} disabled={saving} className="btn-primary w-full btn-sm">
              <Plus className="w-4 h-4" /> Agregar Pago
            </button>
          </div>

          {/* History */}
          {pagos.length > 0 && (
            <div className="space-y-2">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Historial</p>
              {pagos.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 bg-gray-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-green-400 font-bold">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-gray-400">{PAYMENT_METHOD_LABELS[p.method]} · {formatDate(p.paidAt)}</p>
                    {p.notes && <p className="text-xs text-gray-500">{p.notes}</p>}
                  </div>
                  <button onClick={() => handleDelete(p.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
