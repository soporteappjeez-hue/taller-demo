"use client";

import { OrderFilters } from "@/hooks/useOrders";
import { RepairStatus, MotorType, REPAIR_STATUS_LABELS } from "@/lib/types";
import { Search, AlertTriangle, X } from "lucide-react";

interface FiltersBarProps {
  filters: OrderFilters;
  onChange: (f: OrderFilters) => void;
  totalCount: number;
  filteredCount: number;
}

const MOTOR_OPTIONS: { value: MotorType | "all"; label: string; emoji: string }[] = [
  { value: "all",               label: "Todos",            emoji: "⚙️" },
  { value: "desmalezadora",     label: "Desmalezadora",    emoji: "🌿" },
  { value: "motosierra",        label: "Motosierra",       emoji: "🪚" },
  { value: "grupo_electrogeno", label: "Grupo Elec.",      emoji: "⚡" },
  { value: "otros",             label: "Otros",            emoji: "🔧" },
];

const STATUS_OPTIONS: { value: RepairStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "ingresado", label: REPAIR_STATUS_LABELS.ingresado },
  { value: "diagnosticando", label: REPAIR_STATUS_LABELS.diagnosticando },
  { value: "esperando_repuesto", label: REPAIR_STATUS_LABELS.esperando_repuesto },
  { value: "en_reparacion", label: REPAIR_STATUS_LABELS.en_reparacion },
  { value: "listo_para_retiro", label: REPAIR_STATUS_LABELS.listo_para_retiro },
  { value: "entregado", label: REPAIR_STATUS_LABELS.entregado },
];

export default function FiltersBar({ filters, onChange, totalCount, filteredCount }: FiltersBarProps) {
  const hasActiveFilters =
    filters.motorType !== "all" ||
    filters.status !== "all" ||
    filters.search !== "" ||
    filters.overdueOnly;

  const reset = () =>
    onChange({ motorType: "all", status: "all", search: "", overdueOnly: false });

  return (
    <div className="space-y-3">
      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por cliente, marca, modelo..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="input pl-11"
        />
        {filters.search && (
          <button
            onClick={() => onChange({ ...filters, search: "" })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Fila 1: Tipo de máquina — scroll horizontal */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {MOTOR_OPTIONS.map(({ value, label, emoji }) => (
          <button
            key={value}
            onClick={() => onChange({ ...filters, motorType: value as MotorType | "all" })}
            className={`flex-shrink-0 px-3 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5
              ${filters.motorType === value
                ? "bg-orange-500 text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 border border-gray-700"
              }`}
          >
            <span>{emoji}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Fila 2: Estado + Vencidos + Reset */}
      <div className="flex gap-2 items-center">
        {/* Estado */}
        <select
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value as RepairStatus | "all" })}
          className="input input-sm flex-1 min-w-0"
        >
          {STATUS_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Vencidos */}
        <button
          onClick={() => onChange({ ...filters, overdueOnly: !filters.overdueOnly })}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold
            border transition-colors
            ${filters.overdueOnly
              ? "bg-red-600/20 text-red-400 border-red-600"
              : "bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200 hover:bg-gray-700"
            }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          +90d
        </button>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={reset}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs
              text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700
              border border-gray-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* Contador */}
      <p className="text-xs text-gray-500">
        Mostrando <span className="text-gray-300 font-semibold">{filteredCount}</span> de{" "}
        <span className="text-gray-300 font-semibold">{totalCount}</span> órdenes
      </p>
    </div>
  );
}
