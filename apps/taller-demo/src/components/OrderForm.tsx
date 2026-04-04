"use client";

import { useState } from "react";
import {
  WorkOrder,
  MotorType,
  RepairStatus,
  ClientNotification,
  ExtraMachine,
  MOTOR_TYPE_LABELS,
  REPAIR_STATUS_LABELS,
  CLIENT_NOTIFICATION_LABELS,
} from "@/lib/types";
import { generateId } from "@/lib/utils";
import { X, Save, User, Phone, Wrench, DollarSign, ClipboardList, Clock, Camera, PlusCircle, Trash2 } from "lucide-react";
import PhotoUpload from "@/components/PhotoUpload";

interface OrderFormProps {
  initial?: WorkOrder;
  onSave: (order: WorkOrder) => void;
  onClose: () => void;
}

const defaultOrder = (): Omit<WorkOrder, "id" | "entryDate"> => ({
  clientName: "",
  clientPhone: "",
  motorType: "desmalezadora",
  brand: "",
  model: "",
  reportedIssues: "",
  budget: null,
  estimatedDays: null,
  status: "ingresado",
  clientNotification: "pendiente_de_aviso",
  budgetAccepted: false,
  completionDate: null,
  deliveryDate: null,
  linkedParts: [],
  internalNotes: "",
  photoUrls: [],
});

export default function OrderForm({ initial, onSave, onClose }: OrderFormProps) {
  const isEdit = !!initial;
  const [form, setForm] = useState<Omit<WorkOrder, "id" | "entryDate">>(
    initial
      ? {
          clientName: initial.clientName,
          clientPhone: initial.clientPhone,
          motorType: initial.motorType,
          brand: initial.brand,
          model: initial.model,
          reportedIssues: initial.reportedIssues,
          budget: initial.budget,
          estimatedDays: initial.estimatedDays,
          status: initial.status,
          clientNotification: initial.clientNotification,
          budgetAccepted: initial.budgetAccepted,
          completionDate: initial.completionDate,
          deliveryDate: initial.deliveryDate,
          linkedParts: initial.linkedParts,
          internalNotes: initial.internalNotes,
          photoUrls: initial.photoUrls ?? [],
        }
      : defaultOrder()
  );
  const [errors, setErrors] = useState<Partial<Record<keyof WorkOrder, string>>>({});

  // ── Máquinas adicionales ──────────────────────────────────────
  const [extraMachines, setExtraMachines] = useState<ExtraMachine[]>(
    initial?.extraMachines ?? []
  );

  const addMachine = () =>
    setExtraMachines(prev => [...prev, {
      id: generateId(), motorType: "desmalezadora",
      brand: "", model: "", reportedIssues: "",
    }]);

  const removeMachine = (id: string) =>
    setExtraMachines(prev => prev.filter(m => m.id !== id));

  const setMachine = (id: string, key: keyof ExtraMachine, val: string) =>
    setExtraMachines(prev => prev.map(m => m.id === id ? { ...m, [key]: val } : m));
  // ─────────────────────────────────────────────────────────────

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): boolean => {
    const errs: Partial<Record<keyof WorkOrder, string>> = {};
    if (!form.clientName.trim()) errs.clientName = "Nombre requerido";
    if (!form.clientPhone.trim()) errs.clientPhone = "Teléfono requerido";
    if (!form.brand.trim()) errs.brand = "Marca requerida";
    if (!form.model.trim()) errs.model = "Modelo requerido";
    if (!form.reportedIssues.trim()) errs.reportedIssues = "Describí las fallas";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (!validate()) return;

    // Auto-set completionDate when status changes to listo_para_retiro
    let completionDate = form.completionDate;
    if (
      form.status === "listo_para_retiro" &&
      (!initial || initial.status !== "listo_para_retiro") &&
      !completionDate
    ) {
      completionDate = new Date().toISOString();
    }

    let deliveryDate = form.deliveryDate;
    if (
      form.status === "entregado" &&
      (!initial || initial.status !== "entregado") &&
      !deliveryDate
    ) {
      deliveryDate = new Date().toISOString();
    }

    onSave({
      ...(initial ?? { id: generateId(), entryDate: new Date().toISOString() }),
      ...form,
      completionDate,
      deliveryDate,
      extraMachines,
    });
  };

  const fieldError = (key: keyof WorkOrder) =>
    errors[key] ? (
      <p className="text-red-400 text-xs mt-1">{errors[key]}</p>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl border border-gray-700
                      max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 rounded-xl p-2">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">
              {isEdit ? "Editar Orden" : "Nueva Orden de Trabajo"}
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm rounded-xl p-2.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scroll body */}
        <form onSubmit={(e) => handleSubmit(e)} className="overflow-y-auto flex-1 px-5 py-5 space-y-5">

          {/* Sección Cliente */}
          <section>
            <h3 className="flex items-center gap-2 text-orange-400 font-bold text-sm uppercase tracking-wider mb-3">
              <User className="w-4 h-4" />
              Datos del Cliente
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Nombre *</label>
                <input
                  type="text"
                  className={`input ${errors.clientName ? "border-red-500" : ""}`}
                  placeholder="Ej: Juan Pérez"
                  value={form.clientName}
                  onChange={(e) => set("clientName", e.target.value)}
                />
                {fieldError("clientName")}
              </div>
              <div>
                <label className="label">
                  <Phone className="inline w-3.5 h-3.5 mr-1" />
                  Teléfono / WhatsApp *
                </label>
                <input
                  type="tel"
                  className={`input ${errors.clientPhone ? "border-red-500" : ""}`}
                  placeholder="Ej: 5491123456789"
                  value={form.clientPhone}
                  onChange={(e) => set("clientPhone", e.target.value)}
                />
                {fieldError("clientPhone")}
                <p className="text-xs text-gray-500 mt-1">Incluir código de país para WhatsApp</p>
              </div>
            </div>
          </section>

          {/* Sección Equipo */}
          <section>
            <h3 className="flex items-center gap-2 text-orange-400 font-bold text-sm uppercase tracking-wider mb-3">
              <Wrench className="w-4 h-4" />
              Datos del Equipo
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="label">Tipo de M&aacute;quina *</label>
                <div className="flex flex-wrap gap-2">
                  {(["desmalezadora", "motosierra", "grupo_electrogeno", "otros"] as MotorType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set("motorType", t)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors
                        ${form.motorType === t
                          ? "bg-orange-500 border-orange-500 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                        }`}
                    >
                      {MOTOR_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
                {form.motorType === "otros" && (
                  <input
                    type="text"
                    placeholder="Especific&aacute; el tipo de equipo..."
                    value={(form as WorkOrder & { machineTypeOther?: string }).machineTypeOther ?? ""}
                    onChange={e => set("machineTypeOther" as keyof typeof form, e.target.value as never)}
                    className="input mt-2"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="label">Marca *</label>
                <input
                  type="text"
                  className={`input ${errors.brand ? "border-red-500" : ""}`}
                  placeholder="Ej: Honda, Stihl..."
                  value={form.brand}
                  onChange={(e) => set("brand", e.target.value)}
                />
                {fieldError("brand")}
              </div>
              <div>
                <label className="label">Modelo *</label>
                <input
                  type="text"
                  className={`input ${errors.model ? "border-red-500" : ""}`}
                  placeholder="Ej: CG 150, MS 250"
                  value={form.model}
                  onChange={(e) => set("model", e.target.value)}
                />
                {fieldError("model")}
              </div>
            </div>
          </section>

          {/* Diagnóstico */}
          <section>
            <h3 className="flex items-center gap-2 text-orange-400 font-bold text-sm uppercase tracking-wider mb-3">
              <ClipboardList className="w-4 h-4" />
              Diagnóstico
            </h3>
            <div>
              <label className="label">Fallas Reportadas *</label>
              <textarea
                className={`input resize-none min-h-[90px] ${errors.reportedIssues ? "border-red-500" : ""}`}
                placeholder="Describí qué falla reporta el cliente..."
                value={form.reportedIssues}
                onChange={(e) => set("reportedIssues", e.target.value)}
              />
              {fieldError("reportedIssues")}
            </div>
            <div className="mt-3">
              <label className="label">Notas Internas</label>
              <textarea
                className="input resize-none min-h-[70px]"
                placeholder="Notas para el taller (no se envían al cliente)..."
                value={form.internalNotes}
                onChange={(e) => set("internalNotes", e.target.value)}
              />
            </div>
          </section>


          {/* Maquinas Adicionales */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-orange-400 font-bold text-sm uppercase tracking-wider">
                <PlusCircle className="w-4 h-4" /> Maquinas Adicionales
                {extraMachines.length > 0 && (
                  <span className="ml-1 bg-orange-500 text-white text-xs font-black rounded-full px-2 py-0.5">{extraMachines.length}</span>
                )}
              </h3>
              <button type="button" onClick={addMachine}
                className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl"
                style={{ background: "#1e3a1e", color: "#4ade80", border: "1px solid #166534" }}>
                <PlusCircle className="w-3.5 h-3.5" /> + Agregar maquina
              </button>
            </div>
            {extraMachines.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-3 rounded-xl border border-dashed border-gray-700">
                Cliente con mas de una maquina? Presi el boton verde
              </p>
            )}
            {extraMachines.map((m, idx) => (
              <div key={m.id} className="rounded-xl p-4 mb-3 space-y-3" style={{ background: "#111827", border: "1px solid #374151" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-orange-400">Maquina #{idx + 2}</span>
                  <button type="button" onClick={() => removeMachine(m.id)} className="p-1 rounded-lg text-red-400 hover:bg-red-900/30">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="label">Tipo</label>
                  <div className="flex flex-wrap gap-2">
                    {(["desmalezadora","motosierra","grupo_electrogeno","otros"] as MotorType[]).map(t => (
                      <button key={t} type="button" onClick={() => setMachine(m.id, "motorType", t)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${m.motorType===t?"bg-orange-500 border-orange-500 text-white":"bg-gray-800 border-gray-700 text-gray-400 hover:text-white"}`}>
                        {MOTOR_TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                  {m.motorType==="otros" && (<input type="text" placeholder="Especifica el tipo..." value={m.machineTypeOther??""} onChange={e=>setMachine(m.id,"machineTypeOther",e.target.value)} className="input mt-2"/>)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Marca</label><input type="text" placeholder="Ej: Stihl" value={m.brand} onChange={e=>setMachine(m.id,"brand",e.target.value)} className="input"/></div>
                  <div><label className="label">Modelo</label><input type="text" placeholder="Ej: MS 250" value={m.model} onChange={e=>setMachine(m.id,"model",e.target.value)} className="input"/></div>
                </div>
                <div><label className="label">Falla</label><textarea rows={2} placeholder="Falla reportada..." value={m.reportedIssues} onChange={e=>setMachine(m.id,"reportedIssues",e.target.value)} className="input resize-none"/></div>
              </div>
            ))}
          </section>

          {/* Gestión económica */}
          <section>
            <h3 className="flex items-center gap-2 text-orange-400 font-bold text-sm uppercase tracking-wider mb-3">
              <DollarSign className="w-4 h-4" />
              Gestión Económica
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Presupuesto ($)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0"
                  min={0}
                  value={form.budget ?? ""}
                  onChange={(e) =>
                    set("budget", e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
              <div>
                <label className="label">
                  <Clock className="inline w-3.5 h-3.5 mr-1" />
                  Tiempo Estimado (días)
                </label>
                <input
                  type="number"
                  className="input"
                  placeholder="0"
                  min={0}
                  value={form.estimatedDays ?? ""}
                  onChange={(e) =>
                    set("estimatedDays", e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
            </div>

            {/* Seña / Pago parcial */}
            <div className="rounded-xl p-3 mt-2" style={{ background: "rgba(255,230,0,0.06)", border: "1px solid rgba(255,230,0,0.2)" }}>
              <label className="label flex items-center gap-1.5 text-yellow-400 font-black">
                💰 Seña / Pago Parcial ($)
              </label>
              <input
                type="number"
                className="input"
                placeholder="0 — dejar vacío si no hubo seña"
                min={0}
                value={form.deposit ?? ""}
                onChange={(e) =>
                  set("deposit", e.target.value ? Number(e.target.value) : undefined)
                }
              />
              {form.deposit != null && form.budget != null && form.deposit > 0 && (
                <p className="text-xs mt-1.5 font-semibold" style={{ color: "#FFE600" }}>
                  Saldo restante: ${(form.budget - form.deposit).toLocaleString("es-AR")}
                </p>
              )}
            </div>
          </section>

          {/* Seguimiento */}
          <section>
            <h3 className="flex items-center gap-2 text-orange-400 font-bold text-sm uppercase tracking-wider mb-3">
              <ClipboardList className="w-4 h-4" />
              Seguimiento
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Estado de Reparación</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as RepairStatus)}
                >
                  {(Object.keys(REPAIR_STATUS_LABELS) as RepairStatus[]).map((s) => (
                    <option key={s} value={s}>{REPAIR_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Aviso al Cliente</label>
                <select
                  className="input"
                  value={form.clientNotification}
                  onChange={(e) =>
                    set("clientNotification", e.target.value as ClientNotification)
                  }
                >
                  {(Object.keys(CLIENT_NOTIFICATION_LABELS) as ClientNotification[]).map((n) => (
                    <option key={n} value={n}>{CLIENT_NOTIFICATION_LABELS[n]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Presupuesto aceptado */}
            <label className="flex items-center gap-3 mt-4 cursor-pointer group">
              <div
                onClick={() => set("budgetAccepted", !form.budgetAccepted)}
                className={`w-14 h-8 rounded-full border-2 transition-colors flex-shrink-0 relative
                  ${form.budgetAccepted
                    ? "bg-green-500 border-green-500"
                    : "bg-gray-700 border-gray-600"
                  }`}
              >
                <div
                  className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform
                    ${form.budgetAccepted ? "translate-x-[26px]" : "translate-x-0.5"}`}
                />
              </div>
              <span className="text-base font-semibold text-gray-200 select-none">
                Presupuesto Aceptado
              </span>
              {form.budgetAccepted && (
                <span className="text-green-400 text-sm font-bold">Sí</span>
              )}
            </label>
          </section>

          {/* Fotos del equipo */}
          <section>
            <h3 className="flex items-center gap-2 text-orange-400 font-bold text-sm uppercase tracking-wider mb-3">
              <Camera className="w-4 h-4" />
              Fotos del Equipo
            </h3>
            <PhotoUpload
              urls={form.photoUrls}
              onChange={(urls) => set("photoUrls", urls)}
              maxPhotos={5}
            />
          </section>
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-700 flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn-primary flex-1"
          >
            <Save className="w-5 h-5" />
            {isEdit ? "Guardar Cambios" : "Crear Orden"}
          </button>
        </div>
      </div>
    </div>
  );
}
