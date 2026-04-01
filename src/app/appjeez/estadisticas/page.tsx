"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp, RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
  DollarSign, Tag, Package, BarChart2, MessageCircle,
  Copy, Store, Zap, ArrowLeft,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────
interface SalesByDay  { date: string; orders: number; amount: number }
interface TopProduct  { title: string; sku: string; qty: number; revenue: number }
interface ShipBreak   { correo: number; flex: number; turbo: number; full: number; other: number }
interface Reputation  {
  account: string; meli_user_id: string; level_id: string;
  power_seller_status: string | null;
  claims_rate: number; cancellations_rate: number; delayed_rate: number;
  transactions_total: number; transactions_completed: number;
  ratings_positive: number; ratings_negative: number;
}
interface PerAccount  { account: string; meli_user_id: string; total_orders: number; total_amount: number; sales_by_day?: SalesByDay[] }
interface StatsData {
  period: string; account_id: string; accounts_count: number;
  sales_by_day: SalesByDay[];
  sales_by_logistic: Record<string, { qty: number; amount: number }>;
  top_products: TopProduct[];
  shipping_breakdown: ShipBreak;
  reputation: Reputation[];
  totals: { total_orders: number; total_amount: number; avg_ticket: number; cancellation_count: number };
  per_account: PerAccount[];
}
interface AccountOption { nickname: string; meli_user_id: string }

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt  = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
const pct  = (n: number) => `${(n * 100).toFixed(1)}%`;

function repColor(level_id: string): string {
  if (level_id.includes("green")  || level_id === "5_green")  return "#39FF14";
  if (level_id.includes("yellow") || level_id === "4_light_green") return "#FFE600";
  if (level_id.includes("orange") || level_id === "3_orange") return "#FF9800";
  if (level_id.includes("red")    || level_id === "2_red" || level_id === "1_red") return "#ef4444";
  return "#6B7280";
}
function repLabel(level_id: string): string {
  if (level_id.includes("green"))  return "Verde";
  if (level_id.includes("light_green")) return "Verde Claro";
  if (level_id.includes("yellow")) return "Amarillo";
  if (level_id.includes("orange")) return "Naranja";
  if (level_id.includes("red"))    return "Rojo";
  return "Sin datos";
}
function isAlert(level_id: string) {
  return level_id.includes("yellow") || level_id.includes("orange") ||
         level_id.includes("red") || level_id.startsWith("1_") || level_id.startsWith("2_") || level_id.startsWith("3_");
}

const SHIP_COLORS: Record<string, string> = {
  correo: "#FF9800", flex: "#00E5FF", turbo: "#A855F7", full: "#FFE600", other: "#4B5563"
};
const SHIP_LABELS: Record<string, string> = {
  correo: "Correo", flex: "Flex", turbo: "Turbo", full: "Full", other: "Otros"
};

// Colores fijos para cada cuenta (máx 10)
const ACCOUNT_COLORS = [
  "#3b82f6", // Azul
  "#ef4444", // Rojo
  "#10b981", // Verde
  "#f59e0b", // Naranja
  "#8b5cf6", // Púrpura
  "#ec4899", // Rosa
  "#06b6d4", // Cyan
  "#eab308", // Amarillo limón
  "#6366f1", // Índigo
  "#14b8a6", // Teal
];

// ── Transform data for multi-account chart ────────────────────────────────
function buildMultiAccountChartData(
  salesByDay: SalesByDay[] = [],
  perAccount: PerAccount[] = [],
  visibleAccounts: Record<string, boolean> = {}
) {
  if (!salesByDay.length || !perAccount.length) return [];

  // Inicializar mapa de datos por fecha y cuenta
  const dateMap = new Map<string, Record<string, number>>();
  
  // Agrupar sales_by_day por fecha (para Total)
  const totalByDate = new Map<string, number>();
  salesByDay.forEach(s => {
    totalByDate.set(s.date, (totalByDate.get(s.date) ?? 0) + s.amount);
  });

  // Para cada cuenta, procesar su sales_by_day
  perAccount.forEach(acc => {
    if (!acc.sales_by_day?.length) return;
    acc.sales_by_day.forEach(s => {
      if (!dateMap.has(s.date)) dateMap.set(s.date, {});
      dateMap.get(s.date)![acc.meli_user_id] = (dateMap.get(s.date)![acc.meli_user_id] ?? 0) + s.amount;
    });
  });

  // Construir array de datos
  return Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, accounts]) => ({
      date,
      total: totalByDate.get(date) ?? 0,
      ...accounts,
    }));
}
function SalesTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{value: number; name: string; color?: string}>; label?: string }) {
  if (!active || !payload?.length) return null;
  
  // Separar Total de las cuentas individuales
  const total = payload.find(p => p.name === "Total");
  const accountsOnly = payload.filter(p => p.name !== "Total");
  
  return (
    <div className="rounded-lg px-4 py-3 text-xs" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.2)" }}>
      <p className="font-bold mb-2 text-white">{label}</p>
      {total && (
        <p className="mb-2 font-semibold" style={{ color: total.color || "#999" }}>
          📊 Total: ${total.value.toLocaleString()}
        </p>
      )}
      <div className="space-y-1">
        {accountsOnly.map((p, i) => (
          <p key={i} style={{ color: p.color || "#999" }}>
            📌 {p.name}: ${p.value.toLocaleString()}
          </p>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function EstadisticasPage() {
  const [data,           setData]           = useState<StatsData | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [visibleAccounts, setVisibleAccounts] = useState<Record<string, boolean>>({});
  const [error,          setError]          = useState<string | null>(null);
  const [period,         setPeriod]         = useState("7d");
  const [accountId,      setAccountId]      = useState("all");
  const [accounts,       setAccounts]       = useState<AccountOption[]>([]);
  const [showRepDetail,  setShowRepDetail]  = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // Detectar zona horaria del cliente y enviar al backend
      const tzOffset = -new Date().getTimezoneOffset() / 60;
      const res = await fetch(`/api/meli-stats?period=${period}&account_id=${accountId}&tz_offset=${tzOffset}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al cargar estadísticas");
      const json: StatsData = await res.json();
      setData(json);
      if (json.per_account?.length > 0 && accounts.length === 0) {
        setAccounts(json.per_account.map(a => ({ nickname: a.account, meli_user_id: a.meli_user_id })));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period, accountId, accounts.length]);

  useEffect(() => { load(); }, [load]);

  const navItems = [
    { label: "Dashboard",     icon: <BarChart2 className="w-4 h-4" />,   href: "/appjeez"                },
    { label: "Estadísticas",  icon: <TrendingUp className="w-4 h-4" />,  href: "/appjeez/estadisticas"   },
    { label: "Mensajería",    icon: <MessageCircle className="w-4 h-4" />,href: "/appjeez/mensajes"      },
    { label: "Etiquetas",     icon: <Tag className="w-4 h-4" />,          href: "/appjeez/etiquetas"     },
    { label: "Publicaciones", icon: <Package className="w-4 h-4" />,      href: "/appjeez/publicaciones" },
    { label: "Sincronizar",   icon: <Copy className="w-4 h-4" />,         href: "/appjeez/sincronizar"   },
    { label: "Precios",       icon: <DollarSign className="w-4 h-4" />,   href: "/appjeez/precios"       },
    { label: "Promociones",   icon: <Zap className="w-4 h-4" />,          href: "/appjeez/promociones"   },
    { label: "Cuentas MeLi",  icon: <Store className="w-4 h-4" />,        href: "/configuracion/meli"    },
  ];

  const pieData = data ? Object.entries(data.shipping_breakdown)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => ({ name: SHIP_LABELS[k] ?? k, value: v as number, color: SHIP_COLORS[k] ?? "#6B7280" }))
    : [];

  const alertAccounts = data?.reputation.filter(r => isAlert(r.level_id)) ?? [];

  return (
    <div className="min-h-screen flex" style={{ background: "#121212" }}>

      {/* Sidebar desktop */}
      <aside className="hidden sm:flex flex-col w-56 flex-shrink-0 border-r"
        style={{ background: "#181818", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="font-black text-xl" style={{ color: "#FFE600" }}>AppJeez</p>
          <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>Panel Mercado Libre</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(n => (
            <Link key={n.href} href={n.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={n.href === "/appjeez/estadisticas"
                ? { background: "#FFE60018", color: "#FFE600" }
                : { color: "#6B7280" }}>
              {n.icon} {n.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
          style={{ background: "#181818", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <Link href="/appjeez" className="sm:hidden p-1.5 rounded-lg" style={{ color: "#6B7280" }}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <p className="font-black text-base text-white">Estadísticas</p>
              <p className="text-[11px]" style={{ color: "#6B7280" }}>
                {data ? `${data.accounts_count} cuenta${data.accounts_count !== 1 ? "s" : ""}` : "Cargando..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Fecha actual */}
            <div className="hidden sm:block text-right" style={{ fontSize: "11px", color: "#9CA3AF" }}>
              <p>{new Date().toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })}</p>
              <p style={{ color: "#6B7280" }}>{new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <button onClick={load} disabled={loading}
              className="p-2 rounded-xl transition-all" style={{ background: "#1F1F1F" }}>
              <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4 max-w-4xl mx-auto pb-24">

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Period */}
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              {[{ v: "today", l: "Hoy" }, { v: "7d", l: "7 días" }, { v: "30d", l: "30 días" }].map(p => (
                <button key={p.v} onClick={() => setPeriod(p.v)}
                  className="px-3 py-1.5 text-xs font-bold transition-all"
                  style={period === p.v
                    ? { background: "#FFE600", color: "#121212" }
                    : { background: "#1F1F1F", color: "#6B7280" }}>
                  {p.l}
                </button>
              ))}
            </div>

            {/* Account selector */}
            <select value={accountId} onChange={e => setAccountId(e.target.value)}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.1)" }}>
              <option value="all">Todas las cuentas</option>
              {accounts.map(a => (
                <option key={a.meli_user_id} value={a.meli_user_id}>{a.nickname}</option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: "#ef444418", border: "1px solid #ef444440" }}>
              <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "#ef4444" }} />
              <p className="text-sm text-white">{error}</p>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "#1F1F1F" }} />
              ))}
            </div>
          )}

          {data && !loading && (
            <>
              {/* Reputation alerts */}
              {alertAccounts.length > 0 && (
                <div className="rounded-2xl p-4 space-y-2"
                  style={{ background: "#FF980018", border: "1px solid #FF980040" }}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#FF9800" }} />
                    <p className="text-sm font-bold text-white">Alerta de Reputación</p>
                  </div>
                  {alertAccounts.map(r => (
                    <p key={r.meli_user_id} className="text-xs" style={{ color: "#FF9800" }}>
                      ⚠ <strong>{r.account}</strong> está en nivel <strong>{repLabel(r.level_id)}</strong>
                      {" — "}Reclamos: {pct(r.claims_rate)} | Cancelaciones: {pct(r.cancellations_rate)}
                    </p>
                  ))}
                </div>
              )}

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Ventas",       value: String(data.totals.total_orders),  icon: <TrendingUp className="w-4 h-4" />, color: "#FFE600" },
                  { label: "Ingresos",     value: fmt(data.totals.total_amount),     icon: <DollarSign className="w-4 h-4" />,   color: "#39FF14" },
                  { label: "Ticket Prom.", value: fmt(data.totals.avg_ticket),        icon: <TrendingUp className="w-4 h-4" />,   color: "#00E5FF" },
                  { label: "Cuentas",      value: String(data.accounts_count),        icon: <Store className="w-4 h-4" />,         color: "#A855F7" },
                ].map(k => (
                  <div key={k.label} className="rounded-2xl p-4"
                    style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ color: k.color }}>{k.icon}</span>
                      <span className="text-[11px] font-bold" style={{ color: "#6B7280" }}>{k.label.toUpperCase()}</span>
                    </div>
                    <p className="text-xl font-black text-white">{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Per-account breakdown */}
              {data.per_account.length > 1 && (
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <p className="text-xs font-bold text-white">VENTAS POR CUENTA</p>
                  </div>
                  <div className="divide-y divide-white/5">
                    {data.per_account.map(a => (
                      <div key={a.meli_user_id} className="px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-white font-semibold">{a.account}</span>
                        <div className="text-right">
                          <p className="text-sm font-black" style={{ color: "#FFE600" }}>{fmt(a.total_amount)}</p>
                          <p className="text-[11px]" style={{ color: "#6B7280" }}>{a.total_orders} ventas</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Line chart — ventas por día (multicuenta) */}
              <div className="rounded-2xl p-4"
                style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-xs font-bold text-white mb-4">VENTAS POR DÍA (Multicuenta)</p>
                
                {/* Datos del gráfico */}
                {(() => {
                  // Inicializar visibleAccounts si no está configurado
                  if (Object.keys(visibleAccounts).length === 0 && data.per_account.length > 0) {
                    const newVis: Record<string, boolean> = { total: true };
                    data.per_account.forEach(acc => { newVis[acc.meli_user_id] = true; });
                    setVisibleAccounts(newVis);
                  }

                  const chartData = buildMultiAccountChartData(data.sales_by_day, data.per_account, visibleAccounts);

                  return (
                    <>
                      {/* Gráfico */}
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 10 }}
                            tickFormatter={d => d.slice(5)} />
                          <YAxis tick={{ fill: "#6B7280", fontSize: 10 }} />
                          <Tooltip content={<SalesTooltip />} />

                          {/* Línea Total */}
                          {visibleAccounts["total"] !== false && (
                            <Line type="monotone" dataKey="total" stroke="#999" strokeWidth={2} strokeDasharray="5 5"
                              dot={false} name="Total" />
                          )}

                          {/* Líneas por cuenta */}
                          {data.per_account.map((acc, idx) => 
                            visibleAccounts[acc.meli_user_id] !== false ? (
                              <Line key={acc.meli_user_id}
                                type="monotone" dataKey={acc.meli_user_id} stroke={ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length]}
                                strokeWidth={2} dot={false} name={acc.account} />
                            ) : null
                          )}
                        </LineChart>
                      </ResponsiveContainer>

                      {/* Leyenda con checkboxes */}
                      <div className="mt-4 p-3 rounded-lg" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <p className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Mostrar/Ocultar Cuentas</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {/* Checkbox Total */}
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs p-2 rounded hover:bg-opacity-50"
                            style={{ background: "rgba(153,153,153,0.05)", border: "1px solid rgba(153,153,153,0.2)" }}>
                            <input
                              type="checkbox"
                              checked={visibleAccounts["total"] !== false}
                              onChange={e => setVisibleAccounts({...visibleAccounts, total: e.target.checked})}
                              className="w-3 h-3 cursor-pointer"
                            />
                            <span style={{ color: "#999", fontWeight: 600 }}>─ ─ Total</span>
                          </label>

                          {/* Checkboxes por cuenta */}
                          {data.per_account.map((acc, idx) => (
                            <label key={acc.meli_user_id}
                              className="flex items-center gap-1.5 cursor-pointer text-xs p-2 rounded hover:bg-opacity-50"
                              style={{ background: `${ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length]}15`, border: `1px solid ${ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length]}44` }}>
                              <input
                                type="checkbox"
                                checked={visibleAccounts[acc.meli_user_id] !== false}
                                onChange={e => setVisibleAccounts({...visibleAccounts, [acc.meli_user_id]: e.target.checked})}
                                className="w-3 h-3 cursor-pointer"
                              />
                              <span style={{ color: ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length], fontWeight: 600 }}>
                                @{acc.account}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Pie + Bar row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Bar chart — ventas por tipo de logística */}
                {data.sales_by_logistic && (
                  <div className="rounded-2xl p-4"
                    style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-xs font-bold text-white mb-3">VENTAS POR TIPO DE LOGÍSTICA</p>
                    {(() => {
                      const logData = (["correo","flex","turbo","full"] as const)
                        .map(k => ({
                          name: SHIP_LABELS[k],
                          qty: data.sales_by_logistic[k]?.qty ?? 0,
                          amount: data.sales_by_logistic[k]?.amount ?? 0,
                          color: SHIP_COLORS[k],
                        }))
                        .filter(d => d.qty > 0)
                        .sort((a, b) => b.amount - a.amount);
                      return logData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart layout="vertical" data={logData}
                            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                            <XAxis type="number" tick={{ fill: "#6B7280", fontSize: 10 }} />
                            <YAxis type="category" dataKey="name" width={56}
                              tick={{ fill: "#9CA3AF", fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                              labelStyle={{ color: "#fff", fontSize: 11 }}
                              formatter={(value, name) => [
                                name === "qty" ? `${value} ventas` : fmt(value as number),
                                name === "qty" ? "Cantidad" : "Ingresos",
                              ]}
                            />
                            <Bar dataKey="qty" radius={[0, 4, 4, 0]}
                              label={{ position: "right", fill: "#9CA3AF", fontSize: 10 }}>
                              {logData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-xs text-center py-8" style={{ color: "#6B7280" }}>Sin datos de logística</p>
                      );
                    })()}
                    {/* Revenue by logistic mini summary */}
                    <div className="grid grid-cols-2 gap-1 mt-2">
                      {(["correo","flex","turbo","full"] as const)
                        .filter(k => (data.sales_by_logistic[k]?.qty ?? 0) > 0)
                        .map(k => (
                          <div key={k} className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: SHIP_COLORS[k] }} />
                            <span className="text-[10px]" style={{ color: "#9CA3AF" }}>
                              {SHIP_LABELS[k]}: <strong className="text-white">{data.sales_by_logistic[k].qty}</strong>
                              {" · "}<span style={{ color: SHIP_COLORS[k] }}>{fmt(data.sales_by_logistic[k].amount)}</span>
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Pie chart — shipping breakdown */}
                <div className="rounded-2xl p-4"
                  style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs font-bold text-white mb-3">ENVÍOS POR TIPO</p>
                  {pieData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" outerRadius={70}
                            dataKey="value" nameKey="name" label={false}>
                            {pieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                            labelStyle={{ color: "#fff" }}
                            itemStyle={{ color: "#9CA3AF" }}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            formatter={v => <span style={{ color: "#9CA3AF", fontSize: 11 }}>{v}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-2 gap-1 mt-2">
                        {pieData.map(d => (
                          <div key={d.name} className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                            <span className="text-[11px]" style={{ color: "#9CA3AF" }}>{d.name}: <strong className="text-white">{d.value}</strong></span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-center py-8" style={{ color: "#6B7280" }}>Sin datos de envíos</p>
                  )}
                </div>

                {/* Bar chart — top 10 productos */}
                <div className="rounded-2xl p-4"
                  style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs font-bold text-white mb-3">TOP 10 PRODUCTOS</p>
                  {data.top_products.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        layout="vertical"
                        data={data.top_products.slice(0, 10).map(p => ({
                          name: p.title.length > 22 ? p.title.slice(0, 22) + "…" : p.title,
                          qty: p.qty,
                          revenue: p.revenue,
                        }))}
                        margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                        <XAxis type="number" tick={{ fill: "#6B7280", fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" width={90}
                          tick={{ fill: "#9CA3AF", fontSize: 9 }} />
                        <Tooltip
                          contentStyle={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                          labelStyle={{ color: "#fff", fontSize: 11 }}
                          itemStyle={{ color: "#FFE600", fontSize: 11 }}
                          formatter={(v, name) => name === "qty" ? [`${v} uds.`, "Vendidos"] : [fmt(v as number), "Ingresos"]}
                        />
                        <Bar dataKey="qty" fill="#FFE600" radius={[0, 4, 4, 0]} name="qty" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-xs text-center py-8" style={{ color: "#6B7280" }}>Sin datos de productos</p>
                  )}
                </div>
              </div>

              {/* Reputation cards */}
              {data.reputation.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold" style={{ color: "#6B7280" }}>SALUD DE CUENTAS</p>
                  {data.reputation.map(r => {
                    const color = repColor(r.level_id);
                    const alert = isAlert(r.level_id);
                    const open  = showRepDetail === r.meli_user_id;
                    return (
                      <div key={r.meli_user_id}
                        className="rounded-2xl overflow-hidden"
                        style={{
                          background: "#1A1A1A",
                          border: `1px solid ${alert ? color + "60" : "rgba(255,255,255,0.06)"}`,
                          boxShadow: alert ? `0 0 12px ${color}20` : undefined,
                        }}>
                        <button
                          onClick={() => setShowRepDetail(open ? null : r.meli_user_id)}
                          className="w-full px-4 py-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ background: color }} />
                            <div className="text-left">
                              <p className="text-sm font-bold text-white">{r.account}</p>
                              <p className="text-[11px] font-bold" style={{ color }}>
                                {repLabel(r.level_id)}
                                {alert && " ⚠"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right text-[11px]" style={{ color: "#6B7280" }}>
                              <p>{r.transactions_total.toLocaleString()} ventas</p>
                              <p>{pct(r.ratings_positive)} positivas</p>
                            </div>
                            {open
                              ? <ChevronUp className="w-4 h-4" style={{ color: "#6B7280" }} />
                              : <ChevronDown className="w-4 h-4" style={{ color: "#6B7280" }} />}
                          </div>
                        </button>

                        {open && (
                          <div className="px-4 pb-4 grid grid-cols-3 gap-3 border-t"
                            style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                            {[
                              { label: "Reclamos", value: pct(r.claims_rate), bad: r.claims_rate > 0.04 },
                              { label: "Cancelaciones", value: pct(r.cancellations_rate), bad: r.cancellations_rate > 0.02 },
                              { label: "Demora despacho", value: pct(r.delayed_rate), bad: r.delayed_rate > 0.05 },
                            ].map(m => (
                              <div key={m.label} className="pt-3 text-center">
                                <p className="text-[10px] font-bold mb-1" style={{ color: "#6B7280" }}>{m.label.toUpperCase()}</p>
                                <p className="text-lg font-black" style={{ color: m.bad ? "#ef4444" : "#39FF14" }}>{m.value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Mobile bottom nav */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t"
          style={{ background: "#181818", borderColor: "rgba(255,255,255,0.08)" }}>
          {[
            { label: "Dashboard",    href: "/appjeez",              icon: <BarChart2 className="w-5 h-5" /> },
            { label: "Stats",        href: "/appjeez/estadisticas", icon: <TrendingUp className="w-5 h-5" /> },
            { label: "Mensajes",     href: "/appjeez/mensajes",     icon: <MessageCircle className="w-5 h-5" /> },
            { label: "Etiquetas",    href: "/appjeez/etiquetas",    icon: <Tag className="w-5 h-5" /> },
            { label: "Más",          href: "#",                     icon: <ChevronUp className="w-5 h-5" />, onClick: () => setMobileMenuOpen(o => !o) },
          ].map(n => (
            <Link key={n.href} href={n.href}
              onClick={n.onClick}
              className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-semibold transition-colors"
              style={n.href === "/appjeez/estadisticas"
                ? { color: "#FFE600" }
                : { color: "#6B7280" }}>
              {n.icon}
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
