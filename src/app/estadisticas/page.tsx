"use client";

import { useOrders } from "@/hooks/useOrders";
import { useInventory } from "@/hooks/useInventory";
import StatsCharts from "@/components/StatsCharts";
import Navbar from "@/components/Navbar";
import { BarChart2 } from "lucide-react";

export default function EstadisticasPage() {
  const { orders, loading, overdueCount } = useOrders();
  const { lowStockCount } = useInventory();

  return (
    <>
      <Navbar overdueCount={overdueCount} lowStockCount={lowStockCount} />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500 rounded-xl p-2.5">
            <BarChart2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Estadísticas</h1>
            <p className="text-gray-400 text-sm">Análisis de órdenes y rendimiento del taller</p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-20">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-400">Cargando estadísticas...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="card text-center py-16">
            <BarChart2 className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 font-semibold">No hay datos todavía</p>
            <p className="text-gray-600 text-sm mt-1">Las estadísticas aparecerán cuando tengas órdenes cargadas</p>
          </div>
        ) : (
          <StatsCharts orders={orders} />
        )}
      </main>
    </>
  );
}
