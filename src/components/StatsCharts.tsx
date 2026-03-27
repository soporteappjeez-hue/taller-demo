"use client";

import { useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { WorkOrder, REPAIR_STATUS_LABELS, MotorType } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const COLORS = ["#f97316","#3b82f6","#22c55e","#eab308","#a855f7","#ec4899"];

interface Props { orders: WorkOrder[]; }

export default function StatsCharts({ orders }: Props) {
  const active = orders.filter((o) => o.status !== "entregado");

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      const label = REPAIR_STATUS_LABELS[o.status];
      map[label] = (map[label] ?? 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [orders]);

  const byMotor = useMemo(() => [
    { name: "Desmalezadora", value: orders.filter((o) => o.motorType === "desmalezadora").length },
    { name: "Motosierra", value: orders.filter((o) => o.motorType === "motosierra").length },
  ], [orders]);

  const byBrand = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => { map[o.brand] = (map[o.brand] ?? 0) + 1; });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [orders]);

  const totalBudget = orders.reduce((s, o) => s + (o.budget ?? 0), 0);
  const accepted    = orders.filter((o) => o.budgetAccepted).length;
  const overdue     = orders.filter((o) => {
    if (o.status !== "listo_para_retiro" || !o.completionDate) return false;
    const days = Math.floor((Date.now() - new Date(o.completionDate).getTime()) / 86400000);
    return days >= 90;
  }).length;

  const StatCard = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="card text-center py-5">
      <p className="text-3xl font-black text-orange-400">{value}</p>
      <p className="text-sm font-semibold text-gray-300 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total órdenes"       value={String(orders.length)} />
        <StatCard label="Activas"             value={String(active.length)} />
        <StatCard label="Presup. aceptados"   value={String(accepted)} sub={`de ${orders.length}`} />
        <StatCard label="Presupuestado total" value={formatCurrency(totalBudget)} />
      </div>
      {overdue > 0 && (
        <div className="card-alert text-center py-3">
          <p className="text-red-300 font-bold">{overdue} equipo{overdue > 1 ? "s" : ""} con +90 días sin retiro</p>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* By status */}
        <div className="card">
          <h3 className="text-white font-bold mb-4">Órdenes por Estado</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${value}`}>
                {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v} órdenes`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* By motor type */}
        <div className="card">
          <h3 className="text-white font-bold mb-4">2T vs 4T</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={byMotor} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${value}`}>
                <Cell fill="#3b82f6" />
                <Cell fill="#f97316" />
              </Pie>
              <Tooltip formatter={(v) => [`${v} equipos`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* By brand */}
      {byBrand.length > 0 && (
        <div className="card">
          <h3 className="text-white font-bold mb-4">Marcas más reparadas</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byBrand} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                labelStyle={{ color: "#f3f4f6" }}
                formatter={(v) => [`${v} órdenes`]}
              />
              <Bar dataKey="value" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
