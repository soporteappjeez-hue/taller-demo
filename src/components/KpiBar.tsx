"use client";

import { Store, ShoppingCart, DollarSign, AlertTriangle } from "lucide-react";

interface Props {
  accountsCount: number;
  salesToday: number;
  totalAmount: number;
  urgentAlerts: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

export default function KpiBar({ accountsCount, salesToday, totalAmount, urgentAlerts }: Props) {
  return (
    <div
      className="rounded-lg mb-4 p-3 flex items-center justify-between gap-2"
      style={{ background: "linear-gradient(90deg, #1F1F1F, #181818)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* KPI 1: Cuentas */}
      <div className="flex-1 flex items-center gap-2 px-3">
        <Store className="w-4 h-4" style={{ color: "#FFE600" }} />
        <div>
          <p className="text-[10px] text-gray-500">Cuentas</p>
          <p className="text-sm font-bold text-white">{accountsCount}</p>
        </div>
      </div>

      {/* Separator */}
      <div style={{ width: "1px", height: "40px", background: "rgba(255,255,255,0.08)" }} />

      {/* KPI 2: Ventas */}
      <div className="flex-1 flex items-center gap-2 px-3">
        <ShoppingCart className="w-4 h-4" style={{ color: "#39FF14" }} />
        <div>
          <p className="text-[10px] text-gray-500">Ventas Hoy</p>
          <p className="text-sm font-bold text-white">{salesToday}</p>
        </div>
      </div>

      {/* Separator */}
      <div style={{ width: "1px", height: "40px", background: "rgba(255,255,255,0.08)" }} />

      {/* KPI 3: Facturado */}
      <div className="flex-1 flex items-center gap-2 px-3">
        <DollarSign className="w-4 h-4" style={{ color: "#00E5FF" }} />
        <div>
          <p className="text-[10px] text-gray-500">Facturado</p>
          <p className="text-sm font-bold text-white">{fmt(totalAmount)}</p>
        </div>
      </div>

      {/* Separator */}
      <div style={{ width: "1px", height: "40px", background: "rgba(255,255,255,0.08)" }} />

      {/* KPI 4: Alertas Urgentes - NUEVO */}
      <div className="flex-1 flex items-center gap-2 px-3">
        <div
          className={urgentAlerts > 0 ? "animate-pulse" : ""}
          style={{ color: urgentAlerts > 0 ? "#EF4444" : "#6B7280" }}
        >
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] text-gray-500">Urgentes</p>
          <p
            className="text-sm font-bold"
            style={{ color: urgentAlerts > 0 ? "#EF4444" : "#6B7280" }}
          >
            {urgentAlerts}
          </p>
        </div>
      </div>
    </div>
  );
}
