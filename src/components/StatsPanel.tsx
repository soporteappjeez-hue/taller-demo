"use client";
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { RefreshCw } from "lucide-react";
import { ZONE_CFG } from "@/lib/zone-calc";

type Period = "day" | "week" | "month";

interface StatsData {
  period: Period;
  period_date: string;
  zones: Record<
    string,
    {
      total: number;
      printed: number;
      by_shipping_type: Record<string, number>;
    }
  >;
  top_zones: Array<{ zone: string; count: number; percentage: number }>;
}

export function StatsPanel({ accountId }: { accountId: string }) {
  const [period, setPeriod] = useState<Period>("day");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/etiquetas/stats?account_id=${accountId}&period=${period}&date=${today}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("[StatsPanel] Error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [accountId, period]);

  if (!stats) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: "#1A1A1A" }}>
        <RefreshCw className="w-5 h-5 mx-auto animate-spin" style={{ color: "#FFE600" }} />
      </div>
    );
  }

  // Preparar datos para gráfico
  const chartData = Object.entries(stats.zones).map(([zone, data]) => ({
    zone: ZONE_CFG[zone]?.label || zone,
    total: data.total,
    printed: data.printed,
    pending: data.total - data.printed,
  }));

  return (
    <div className="space-y-4">
      {/* Selector de período */}
      <div className="flex gap-2">
        {(["day", "week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
            style={
              period === p
                ? { background: "#FFE600", color: "#121212" }
                : { background: "#1A1A1A", color: "#6B7280", border: "1px solid rgba(255,255,255,0.06)" }
            }
          >
            {p === "day" ? "Hoy" : p === "week" ? "Esta semana" : "Este mes"}
          </button>
        ))}
      </div>

      {/* Gráfico de barras */}
      {chartData.length > 0 && (
        <div className="rounded-2xl p-4 overflow-x-auto" style={{ background: "#1A1A1A" }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="zone" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip
                contentStyle={{
                  background: "#121212",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
              <Legend />
              <Bar dataKey="printed" fill="#39FF14" name="Impresas" />
              <Bar dataKey="pending" fill="#FF9800" name="Pendientes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla de zonas */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#1A1A1A" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                <th className="text-left px-3 py-2" style={{ color: "#9CA3AF" }}>
                  Zona
                </th>
                <th className="text-center px-3 py-2" style={{ color: "#9CA3AF" }}>
                  Total
                </th>
                <th className="text-center px-3 py-2" style={{ color: "#9CA3AF" }}>
                  Impreso
                </th>
                <th className="text-center px-3 py-2" style={{ color: "#9CA3AF" }}>
                  % Completado
                </th>
                <th className="text-center px-3 py-2" style={{ color: "#9CA3AF" }}>
                  Flex
                </th>
                <th className="text-center px-3 py-2" style={{ color: "#9CA3AF" }}>
                  Correo
                </th>
                <th className="text-center px-3 py-2" style={{ color: "#9CA3AF" }}>
                  Turbo
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.zones).map(([zone, data]) => {
                const percentage = data.total > 0 ? Math.round((data.printed / data.total) * 100) : 0;
                return (
                  <tr key={zone} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td className="px-3 py-2 font-bold" style={{ color: ZONE_CFG[zone]?.color }}>
                      {ZONE_CFG[zone]?.label || zone}
                    </td>
                    <td className="text-center px-3 py-2 text-white">{data.total}</td>
                    <td className="text-center px-3 py-2" style={{ color: "#39FF14" }}>
                      {data.printed}
                    </td>
                    <td className="text-center px-3 py-2">{percentage}%</td>
                    <td className="text-center px-3 py-2 text-white">
                      {data.by_shipping_type?.flex || 0}
                    </td>
                    <td className="text-center px-3 py-2 text-white">
                      {data.by_shipping_type?.correo || 0}
                    </td>
                    <td className="text-center px-3 py-2 text-white">
                      {data.by_shipping_type?.turbo || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top zonas */}
      {stats.top_zones.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "#1A1A1A" }}>
          <h3 className="text-xs font-black mb-2" style={{ color: "#FFE600" }}>
            Zonas más activas
          </h3>
          <div className="space-y-1">
            {stats.top_zones.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span style={{ color: ZONE_CFG[item.zone]?.color }}>
                  {ZONE_CFG[item.zone]?.label}: {item.count} ({item.percentage}%)
                </span>
                <div
                  className="h-1 rounded"
                  style={{
                    width: `${item.percentage * 2}px`,
                    background: ZONE_CFG[item.zone]?.color,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
