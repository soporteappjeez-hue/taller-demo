"use client";

import { useState, useMemo, useCallback } from "react";
import { useOrders } from "@/hooks/useOrders";
import { useInventory } from "@/hooks/useInventory";
import StatsCharts from "@/components/StatsCharts";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { BarChart2, TrendingUp, Calendar } from "lucide-react";
import { WorkOrder } from "@/lib/types";

type RangoStats = "hoy" | "semana" | "mes" | "anio" | "personalizado";

function todayStr() { return new Date().toISOString().slice(0, 10); }
function weekRange(): [string, string] {
  const d = new Date();
  const day = d.getDay() || 7;
  const mon = new Date(d); mon.setDate(d.getDate() - day + 1);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}
function monthRange(): [string, string] {
  const d = new Date();
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const to = last.toISOString().slice(0, 10);
  return [from, to];
}
function yearRange(): [string, string] {
  const d = new Date();
  const from = `${d.getFullYear()}-01-01`;
  const to = `${d.getFullYear()}-12-31`;
  return [from, to];
}

function getFechaEntrada(order: WorkOrder): string {
  // Usar entry_date que es la fecha de ingreso
  return order.entryDate?.slice(0, 10) ?? "";
}

export default function EstadisticasPage() {
  const { orders, loading, overdueCount } = useOrders();
  const { lowStockCount } = useInventory();

  // Filtros de rango
  const [rango, setRango] = useState<RangoStats>("mes");
  const [fechaDesde, setFechaDesde] = useState(todayStr());
  const [fechaHasta, setFechaHasta] = useState(todayStr());

  // Calcular rango de fechas
  const getRangoFechas = useCallback((): [string, string] => {
    if (rango === "hoy") return [todayStr(), todayStr()];
    if (rango === "semana") return weekRange();
    if (rango === "mes") return monthRange();
    if (rango === "anio") return yearRange();
    return [fechaDesde, fechaHasta];
  }, [rango, fechaDesde, fechaHasta]);

  // Filtrar órdenes por fecha
  const filteredOrders = useMemo(() => {
    const [desde, hasta] = getRangoFechas();
    return orders.filter(o => {
      const fecha = getFechaEntrada(o);
      return fecha >= desde && fecha <= hasta;
    });
  }, [orders, getRangoFechas]);

  const getRangoLabel = () => {
    if (rango === "hoy") return "Hoy";
    if (rango === "semana") return "Esta semana";
    if (rango === "mes") return "Este mes";
    if (rango === "anio") return "Este año";
    return `${fechaDesde} → ${fechaHasta}`;
  };

  return (
    <>
      <Navbar overdueCount={overdueCount} lowStockCount={lowStockCount} />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-20 sm:pb-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 rounded-xl p-2.5">
            <BarChart2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estadísticas</h1>
            <p className="text-gray-400 text-sm">Análisis de órdenes y rendimiento del negocio</p>
          </div>
        </div>

        {/* Selector de rango */}
        <div className="card border border-white/10">
          <div className="flex gap-2 flex-wrap">
            {([
              { id: "hoy",           label: "Hoy" },
              { id: "semana",        label: "Semana" },
              { id: "mes",           label: "Mes" },
              { id: "anio",          label: "Año" },
              { id: "personalizado", label: "Personalizado" },
            ] as { id: RangoStats; label: string }[]).map(r => (
              <button
                key={r.id}
                onClick={() => setRango(r.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all
                  ${rango === r.id
                    ? "border-orange-500 text-orange-500 bg-orange-500/10"
                    : "border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300"}`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {rango === "personalizado" && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="label text-xs">Desde</label>
                <input 
                  type="date" 
                  className="input input-sm" 
                  value={fechaDesde} 
                  onChange={e => setFechaDesde(e.target.value)} 
                />
              </div>
              <div>
                <label className="label text-xs">Hasta</label>
                <input 
                  type="date" 
                  className="input input-sm" 
                  value={fechaHasta} 
                  onChange={e => setFechaHasta(e.target.value)} 
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Período: {getRangoLabel()} · {filteredOrders.length} órdenes</span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-20">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-400">Cargando estadísticas...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="card text-center py-16">
            <BarChart2 className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 font-semibold">No hay datos en este período</p>
            <p className="text-gray-600 text-sm mt-1">Seleccioná otro rango de fechas para ver estadísticas</p>
          </div>
        ) : (
          <StatsCharts orders={filteredOrders} />
        )}
      </main>
      <BottomNav />
    </>
  );
}
