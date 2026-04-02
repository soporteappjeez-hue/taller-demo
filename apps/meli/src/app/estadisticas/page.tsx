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
  Award,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useCachedStats, type StatsData } from "@/hooks/useCachedStats";

type PeriodType = "day" | "week" | "month" | "year" | "custom";

interface PeriodOption {
  value: PeriodType;
  label: string;
  icon: React.ReactNode;
}

const PERIODS: PeriodOption[] = [
  { value: "day", label: "Día", icon: <Calendar className="w-4 h-4" /> },
  { value: "week", label: "Semana", icon: <TrendingUp className="w-4 h-4" /> },
  { value: "month", label: "Mes", icon: <BarChart3 className="w-4 h-4" /> },
  { value: "year", label: "Año", icon: <Award className="w-4 h-4" /> },
  { value: "custom", label: "Personalizado", icon: <Calendar className="w-4 h-4" /> },
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

function getPeriodDates(period: PeriodType, customStart?: string, customEnd?: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (period) {
    case "day":
      return {
        from: today,
        to: today,
        label: "Hoy",
      };
    case "week": {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return {
        from: weekStart,
        to: weekEnd,
        label: "Esta semana",
      };
    }
    case "month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        from: monthStart,
        to: monthEnd,
        label: "Este mes",
      };
    }
    case "year": {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const yearEnd = new Date(today.getFullYear(), 11, 31);
      return {
        from: yearStart,
        to: yearEnd,
        label: "Este año",
      };
    }
    case "custom":
      if (customStart && customEnd) {
        return {
          from: new Date(customStart),
          to: new Date(customEnd),
          label: `${new Date(customStart).toLocaleDateString("es-AR")} - ${new Date(customEnd).toLocaleDateString("es-AR")}`,
        };
      }
      return {
        from: today,
        to: today,
        label: "Personalizado",
      };
  }
}

// Componente de calendario simple
function DatePickerModal({
  isOpen,
  onClose,
  onSelect,
  initialStart,
  initialEnd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (start: string, end: string) => void;
  initialStart?: string;
  initialEnd?: string;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [startDate, setStartDate] = useState<string>(initialStart || "");
  const [endDate, setEndDate] = useState<string>(initialEnd || "");
  const [selecting, setSelecting] = useState<"start" | "end">("start");

  if (!isOpen) return null;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handleDateClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    
    if (selecting === "start") {
      setStartDate(dateStr);
      setSelecting("end");
    } else {
      if (new Date(dateStr) >= new Date(startDate)) {
        setEndDate(dateStr);
      } else {
        setStartDate(dateStr);
        setEndDate("");
      }
    }
  };

  const handleApply = () => {
    if (startDate && endDate) {
      onSelect(startDate, endDate);
      onClose();
    }
  };

  const isInRange = (day: number) => {
    if (!startDate || !endDate) return false;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return new Date(dateStr) >= new Date(startDate) && new Date(dateStr) <= new Date(endDate);
  };

  const isStart = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return dateStr === startDate;
  };

  const isEnd = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return dateStr === endDate;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
      <div className="rounded-2xl p-4 w-full max-w-sm" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Seleccionar fechas</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Indicador de selección */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSelecting("start")}
            className={`flex-1 p-2 rounded-lg text-sm ${selecting === "start" ? "bg-blue-600 text-white" : "text-gray-400"}`}
            style={{ background: selecting === "start" ? "#2563eb" : "#121212" }}
          >
            Desde: {startDate ? new Date(startDate).toLocaleDateString("es-AR") : "Seleccionar"}
          </button>
          <button
            onClick={() => setSelecting("end")}
            className={`flex-1 p-2 rounded-lg text-sm ${selecting === "end" ? "bg-blue-600 text-white" : "text-gray-400"}`}
            style={{ background: selecting === "end" ? "#2563eb" : "#121212" }}
          >
            Hasta: {endDate ? new Date(endDate).toLocaleDateString("es-AR") : "Seleccionar"}
          </button>
        </div>

        {/* Navegación de mes */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentMonth(new Date(year, month - 1))}
            className="p-1 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <ChevronLeft className="w-4 h-4 text-gray-400" />
          </button>
          <span className="font-semibold text-white">{monthNames[month]} {year}</span>
          <button
            onClick={() => setCurrentMonth(new Date(year, month + 1))}
            className="p-1 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
            <div key={d} className="text-center text-xs text-gray-500 py-1">{d}</div>
          ))}
        </div>

        {/* Grilla de días */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => (
            <div key={idx} className="aspect-square">
              {day && (
                <button
                  onClick={() => handleDateClick(day)}
                  className={`w-full h-full rounded-lg text-sm font-medium transition-colors ${
                    isStart(day)
                      ? "bg-blue-600 text-white"
                      : isEnd(day)
                      ? "bg-blue-600 text-white"
                      : isInRange(day)
                      ? "bg-blue-900/50 text-blue-200"
                      : "text-white hover:bg-gray-700"
                  }`}
                  style={{
                    background: isStart(day) || isEnd(day) ? "#2563eb" : isInRange(day) ? "rgba(37,99,235,0.3)" : "transparent",
                  }}
                >
                  {day}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Botón aplicar */}
        <button
          onClick={handleApply}
          disabled={!startDate || !endDate}
          className="w-full mt-4 py-3 rounded-xl font-bold text-sm text-black disabled:opacity-40"
          style={{ background: "#39FF14" }}
        >
          Aplicar rango
        </button>
      </div>
    </div>
  );
}

export default function EstadisticasPage() {
  const [period, setPeriod] = useState<PeriodType>("week");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { getOrFetch } = useCachedStats();

  const periodDates = useMemo(() => getPeriodDates(period, customStart, customEnd), [period, customStart, customEnd]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const tzOffset = -new Date().getTimezoneOffset() / 60;
      
      // Convertir fechas a formato YYYY-MM-DD para API
      const dateFrom = periodDates.from.toISOString().split("T")[0];
      const dateTo = periodDates.to.toISOString().split("T")[0];
      
      // Usar el hook con parámetros de fecha personalizados
      const stats = await getOrFetch("custom", "all", tzOffset, dateFrom, dateTo);
      setData(stats);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [period, customStart, customEnd]);

  const handlePeriodSelect = (p: PeriodType) => {
    setPeriod(p);
    setShowPeriodDropdown(false);
    if (p === "custom") {
      setShowDatePicker(true);
    }
  };

  const handleCustomDateSelect = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
  };

  const currentPeriod = PERIODS.find((p) => p.value === period);

  // Calcular totales para mostrar
  const totals = data?.totals;

  // Procesar datos de ventas según el período seleccionado
  const chartData = useMemo(() => {
    if (!data?.sales_by_day) return [];
    
    const sales = data.sales_by_day;
    
    switch (period) {
      case "year": {
        // Agrupar por mes
        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const byMonth = new Map<number, { label: string; amount: number; orders: number }>();
        
        sales.forEach((day) => {
          const date = new Date(day.date);
          const month = date.getMonth();
          const existing = byMonth.get(month) || { label: months[month], amount: 0, orders: 0 };
          existing.amount += day.amount;
          existing.orders += day.orders;
          byMonth.set(month, existing);
        });
        
        return Array.from(byMonth.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([_, data]) => data);
      }
      
      case "month": {
        // Agrupar por día del mes (1-31)
        const byDay = new Map<number, { label: string; amount: number; orders: number }>();
        
        sales.forEach((day) => {
          const date = new Date(day.date);
          const dayNum = date.getDate();
          const existing = byDay.get(dayNum) || { label: `${dayNum}`, amount: 0, orders: 0 };
          existing.amount += day.amount;
          existing.orders += day.orders;
          byDay.set(dayNum, existing);
        });
        
        // Llenar días vacíos
        const daysInMonth = new Date(periodDates.to.getFullYear(), periodDates.to.getMonth() + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
          if (!byDay.has(i)) {
            byDay.set(i, { label: `${i}`, amount: 0, orders: 0 });
          }
        }
        
        return Array.from(byDay.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([_, data]) => data);
      }
      
      case "week":
      case "day":
      case "custom":
      default: {
        // Mostrar por día
        return sales.map((day) => ({
          label: new Date(day.date).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
          }),
          amount: day.amount,
          orders: day.orders,
        }));
      }
    }
  }, [data?.sales_by_day, period, periodDates]);

  // Título del gráfico según período
  const chartTitle = useMemo(() => {
    switch (period) {
      case "year": return "Ventas por mes";
      case "month": return "Ventas por día";
      default: return "Ventas por día";
    }
  }, [period]);

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
      {/* Date Picker Modal */}
      <DatePickerModal
        isOpen={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleCustomDateSelect}
        initialStart={customStart}
        initialEnd={customEnd}
      />

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
              Estadísticas Unificadas
            </h1>
            <p className="text-[10px]" style={{ color: "#6B7280" }}>
              Todas las cuentas · {periodDates.label}
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
              {currentPeriod?.icon}
              <span className="hidden sm:inline">{currentPeriod?.label}</span>
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
                    onClick={() => handlePeriodSelect(p.value)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                      period === p.value
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-gray-300 hover:bg-gray-800"
                    }`}
                  >
                    {p.icon}
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
        {/* Info del período seleccionado */}
        <div
          className="rounded-xl p-3 flex items-center justify-between"
          style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: "#6B7280" }} />
            <span className="text-sm text-gray-300">
              {periodDates.from.toLocaleDateString("es-AR")} - {periodDates.to.toLocaleDateString("es-AR")}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" style={{ color: "#6B7280" }} />
            <span className="text-sm text-gray-300">Todas las cuentas</span>
          </div>
        </div>

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

            {/* Gráfico de ventas */}
            {chartData.length > 0 && (
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "#1F1F1F",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" style={{ color: "#39FF14" }} />
                  {chartTitle}
                </h3>
                <div className="space-y-2">
                  {chartData.map((item, idx) => {
                    const maxAmount = Math.max(...chartData.map((d) => d.amount));
                    const percentage = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-xs w-12 text-right" style={{ color: "#6B7280" }}>
                          {item.label}
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
                          {formatCurrency(item.amount)}
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
