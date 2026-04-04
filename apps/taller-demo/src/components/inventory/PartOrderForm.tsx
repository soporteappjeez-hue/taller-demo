"use client";

import { useState } from "react";
import { PartToOrder } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { X, Save, ShoppingCart } from "lucide-react";

interface PartOrderFormProps {
  initial?: PartToOrder;
  onSave: (part: PartToOrder) => void;
  onClose: () => void;
}

const empty = (): Omit<PartToOrder, "id" | "createdAt"> => ({
  name: "",
  quantity: 1,
  orderId: null,
  orderClientName: null,
  supplier: "",
  status: "pendiente",
  notes: "",
});

export default function PartOrderForm({ initial, onSave, onClose }: PartOrderFormProps) {
  const [form, setForm] = useState<Omit<PartToOrder, "id" | "createdAt">>(
    initial ? { ...initial } : empty()
  );
  const [errors, setErrors] = useState<Partial<Record<keyof PartToOrder, string>>>({});

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const errs: Partial<Record<keyof PartToOrder, string>> = {};
    if (!form.name.trim()) errs.name = "Nombre requerido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      ...(initial ?? { id: generateId(), createdAt: new Date().toISOString() }),
      ...form,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 rounded-xl p-2">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">
              {initial ? "Editar Pedido" : "Agregar a Pedir"}
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm p-2.5 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
          <div>
            <label className="label">Nombre del Repuesto *</label>
            <input
              type="text"
              className={`input ${errors.name ? "border-red-500" : ""}`}
              placeholder="Ej: Pistón 47mm para Stihl MS 250"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cantidad</label>
              <input
                type="number"
                className="input"
                min={1}
                value={form.quantity}
                onChange={(e) => set("quantity", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Estado</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => set("status", e.target.value as PartToOrder["status"])}
              >
                <option value="pendiente">Pendiente</option>
                <option value="pedido">Pedido</option>
                <option value="recibido">Recibido</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Proveedor / Fuente</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Distribuidor Stihl, MercadoLibre..."
              value={form.supplier}
              onChange={(e) => set("supplier", e.target.value)}
            />
          </div>

          <div>
            <label className="label">Cliente / Orden relacionada</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Juan Pérez — Honda CG 150"
              value={form.orderClientName ?? ""}
              onChange={(e) =>
                set("orderClientName", e.target.value || null)
              }
            />
          </div>

          <div>
            <label className="label">Notas</label>
            <input
              type="text"
              className="input"
              placeholder="Información adicional..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button type="submit" className="btn-primary flex-1">
              <Save className="w-5 h-5" />
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
