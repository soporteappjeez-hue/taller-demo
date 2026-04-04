"use client";

import { useState } from "react";
import { StockItem } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { X, Save, Package } from "lucide-react";

interface StockFormProps {
  initial?: StockItem;
  onSave: (item: StockItem) => void;
  onClose: () => void;
}

const empty = (): Omit<StockItem, "id"> => ({
  name: "",
  quantity: 1,
  location: "",
  minQuantity: 1,
  notes: "",
});

export default function StockForm({ initial, onSave, onClose }: StockFormProps) {
  const [form, setForm] = useState<Omit<StockItem, "id">>(
    initial ? { ...initial } : empty()
  );
  const [errors, setErrors] = useState<Partial<Record<keyof StockItem, string>>>({});

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const errs: Partial<Record<keyof StockItem, string>> = {};
    if (!form.name.trim()) errs.name = "Nombre requerido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({ ...(initial ?? { id: generateId() }), ...form });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 rounded-xl p-2">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">
              {initial ? "Editar Repuesto" : "Agregar al Stock"}
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
              placeholder="Ej: Bujía NGK CR6HSA"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cantidad en Stock</label>
              <input
                type="number"
                className="input"
                min={0}
                value={form.quantity}
                onChange={(e) => set("quantity", Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Mínimo (alerta)</label>
              <input
                type="number"
                className="input"
                min={0}
                value={form.minQuantity}
                onChange={(e) => set("minQuantity", Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className="label">Ubicación</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Estante A-3, Cajón 2"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>

          <div>
            <label className="label">Notas</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Para motos Honda..."
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
