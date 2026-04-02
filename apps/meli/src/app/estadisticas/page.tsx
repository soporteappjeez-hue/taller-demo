"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  Package,
  DollarSign,
  ShoppingCart,
  Truck,
  Star,
  RefreshCw,
  ChevronDown,
  BarChart3,
  PieChart,
  Award,
} from "lucide-react";
import { useCachedStats, type StatsData } from "@/hooks/useCachedStats";

const PERIODS = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number) {
  return new Intl.NumberFormat("es-AR").format(num);
}

export default function EstadisticasPage() {
  const [period, setPeriod] = useState("7d");
  const [accountId, setAccountId] = useState("all");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  const { getOrFetch } = useCachedStats();

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const tzOffset = -new Date().getTimezoneOffset() / 60; // UTC-3 = -3
      const stats = await getOrFetch(period, accountId, tzOffset);
      setData(stats);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [period, accountId]);

  const periodLabel = PERIODS.find((p) => p.value === period)?.label || period;

  // Calcular totales para mostrar
  const totals = data?.totals;

  // Datos para gráfico de envíos
  const shippingData = useMemo(() => {
    if (!data?.shipping_breakdown) return [];
    const labels: Record<string, string> = {
      correo: "Correo",
      flex: "Flex",
      turbo: "Turbo",
      full: "Full",
      other: "Otro",
    };
    return Object.entries(data.shipping_breakdown)
      .filter(([_, count]) => count > 0)
      .map(([key, count]) => ({
        label: labels[key] || key,
        count,
        percentage: totals?.total_orders
          ? Math.round((count / totals.total_orders) * 100)
          : 0,
      }));
  }, [data?.shipping_breakdown, totals?.total_orders]);

  return (
    <main className="min-h-screen pb-24" style={{ background: "#121212" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b"
        style={{
          background: "rgba(18,18,18,0.97)",
          backdropFilter: "blur(16px)",
          borderColor: "rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="font-black text-white text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: "#39FF14" }} />
              Estadísticas
            </h1>
            <p className="text-[10px]" style={{ color: "#6B7280" }}>
              Análisis de ventas MercadoLibre
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Selector de período */}
          <div className="relative">
            <button
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
              style={{
                background: "#1F1F1F",
                color: "#39FF14",
                border: "1px solid #39FF1433",
              }}
            >
              <Calendar className="w-4 h-4" />
              {periodLabel}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showPeriodDropdown && (
              <div
                className="absolute top-full right-0 mt-2 rounded-xl shadow-2xl z-50 min-w-max overflow-hidden"
                style={{
                  background: "#1F1F1F",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      setPeriod(p.value);
                      setShowPeriodDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      period === p.value
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-gray-300 hover:bg-gray-800"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{
              background: "#1F1F1F",
              color: "#00E5FF",
              border: "1px solid #00E5FF33",
            }}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-4 space-y-4">
        {/* Error */}
        {error && (
          <div
            className="rounded-2xl p-4 text-center"
            style={{ background: "#ef444418", border: "1px solid #ef444440" }}
          >
            <p className="text-sm text-white font-semibold">{error}</p>
            <button
              onClick={loadStats}
              className="mt-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-20">
            <div
              className="w-10 h-10 border-4 rounded-full animate-spin mb-4"
              style={{
                borderColor: "#39FF14",
                borderTopColor: "transparent",
              }}
            />
            <p style={{ color: "#6B7280" }}>Cargando estadísticas...</p>
          </div>
        )}

        {/* Sin datos */}
        {!loading && !error && (!data || data.totals.total_orders === 0) && (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: "#1F1F1F" }}
          >
            <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: "#6B7280" }} />
            <p className="text-white font-bold">No hay datos para este período</p>
            <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
              Intentá con otro rango de fechas
            </p>
          </div>
        )}

        {/* KPIs */}
        {!loading && data && data.totals.total_orders > 0 && (
          <>
            {/* Cards de totales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Ventas */}
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "#1F1F1F",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "#39FF1422" }}
                  >
                    <DollarSign className="w-4 h-4" style={{ color: "#39FF14" }} />
                  </div>
                  <span className="text-xs" style={{ color: "#6B7280" }}>
                    Ventas
                  </span>
                </div>
                <p className="text-xl font-black text-white">
                  {formatCurrency(data.totals.total_amount)}
                </p>
              </div>

              {/* Órdenes */}
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "#1F1F1F",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "#00E5FF22" }}
                  >
                    <ShoppingCart className="w-4 h-4" style={{ color: "#00E5FF" }} />
                  </div>
                  <span className="text-xs" style={{ color: "#6B7280" }}>
                    Órdenes
                  </span>
                </div>
                <p className="text-xl font-black text-white">
                  {formatNumber(data.totals.total_orders)}
                </p>
              </div>

              {/* Ticket promedio */}
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "#1F1F1F",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "#FFE60022" }}
                  >
                    <TrendingUp className="w-4 h-4" style={{ color: "#FFE600" }} />
                  </div>
                  <span className="text-xs" style={{ color: "#6B7280" }}>
                    Ticket promedio
                  </span>
                </div>
                <p className="text-xl font-black text-white">
                  {formatCurrency(data.totals.avg_ticket)}
                </p>
              </div>

              {/* Cuentas */}
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "#1F1F1F",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: "#FF572222" }}
                  >
                    <Star className="w-4 h-4" style={{ color: "#FF5722" }} />
                  </div>
                  <span className="text-xs" style={{ color: "#6B7280" }}>
                    Cuentas activas
                  </span>
                </div>
                <p className="text-xl font-black text-white">
                  {data.accounts_count}
                </p>
              </div>
            </div>

            {/* Gráfico de ventas por día */}
            {data.sales_by_day.length > 0 && (
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "#1F1F1F",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" style={{ color: "#39FF14" }} />
                  Ventas por día
                </h3>
                <div className="space-y-2">
                  {data.sales_by_day.map((day) => {
                    const maxAmount = Math.max(
                      ...data.sales_by_day.map((d) => d.amount)
                    );
                    const percentage = maxAmount > 0 ? (day.amount / maxAmount) * 100 : 0;
                    return (
                      <div key={day.date} className="flex items-center gap-3">
                        <span className="text-xs w-16" style={{ color: "#6B7280" }}>
                          {new Date(day.date).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                        <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: "#121212" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${percentage}%`,
                              background: "linear-gradient(90deg, #39FF14, #00E5FF)",
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-white w-20 text-right">
                          {formatCurrency(day.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Breakdown de envíos */}
            {shippingData.length > 0 && (
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "#1F1F1F",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Truck className="w-4 h-4" style={{ color: "#00E5FF" }} />
                  Envíos por tipo
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {shippingData.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl p-3 text-center"
                      style={{ background: "#121212" }}
                    >
                      <p className="text-lg font-black text-white">{item.count}</p>
                      <p className="text-xs" style={{ color: "#6B7280" }}>
                        {item.label}
                      </p>
                      <p className="text-xs font-semibold" style={{ color: "#39FF14" }}>
                        {item.percentage}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top productos */}
            {data.top_products.length > 0 && (
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "#1F1F1F",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4" style={{ color: "#FFE600" }} />
                  Productos más vendidos
                </h3>
                <div className="space-y-2">
                  {data.top_products.slice(0, 5).map((product, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "#121212" }}
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: idx === 0 ? "#FFE600" : "#2a2a2a",
                          color: idx === 0 ? "#000" : "#fff",
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{product.title}</p>
                        {product.sku && (
                          <p className="text-xs" style={{ color: "#6B7280" }}>
                            SKU: {product.sku}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{product.qty} u.</p>
                        <p className="text-xs" style={{ color: "#39FF14" }}>
                          {formatCurrency(product.revenue)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reputación */}
            {data.reputation.length > 0 && (
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "#1F1F1F",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4" style={{ color: "#FF5722" }} />
                  Reputación
                </h3>
                <div className="space-y-3">
                  {data.reputation.map((rep) => (
                    <div
                      key={rep.meli_user_id}
                      className="p-3 rounded-xl"
                      style={{ background: "#121212" }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-white">@{rep.account}</span>
                        <span
                          className="text-xs px-2 py-1 rounded-full"
                          style={{
                            background: rep.level_id === "5_green" ? "#39FF1422" : "#FFE60022",
                            color: rep.level_id === "5_green" ? "#39FF14" : "#FFE600",
                          }}
                        >
                          {rep.level_id.replace("_", " ").toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-lg font-bold text-white">
                            {rep.transactions_completed}
                          </p>
                          <p className="text-xs" style={{ color: "#6B7280" }}>
                            Ventas
                          </p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-white">
                            {rep.ratings_positive}%
                          </p>
                          <p className="text-xs" style={{ color: "#6B7280" }}>
                            Positivas
                          </p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-white">
                            {(rep.claims_rate * 100).toFixed(1)}%
                          </p>
                          <p className="text-xs" style={{ color: "#6B7280" }}>
                            Reclamos
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
