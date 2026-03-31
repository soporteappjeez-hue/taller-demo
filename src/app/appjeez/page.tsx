"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  MessageCircle, MessageSquare, Truck, Tag, TrendingUp,
  Star, AlertTriangle, CheckCircle2, RefreshCw, Settings,
  ChevronDown, ChevronUp, ShoppingCart, DollarSign,
  Package, Clock, XCircle, BarChart2, ExternalLink,
  Bell, Store, Menu, X, Copy, Pencil, Check, Zap,
} from "lucide-react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import AccountSelector from "@/components/AccountSelector";
import AccountDetailsPanel from "@/components/AccountDetailsPanel";
import UnifiedPostSalePanel from "@/components/UnifiedPostSalePanel";
import KpiBar from "@/components/KpiBar";

interface Reputation {
  level_id: string | null;
  power_seller_status: string | null;
  transactions_total: number;
  transactions_completed: number;
  ratings_positive: number;
  ratings_negative: number;
  ratings_neutral: number;
  delayed_handling_time: number;
  claims: number;
  cancellations: number;
  immediate_payment: boolean;
}

interface AccountDash {
  account: string;
  meli_user_id: string;
  unanswered_questions: number;
  pending_messages: number;
  ready_to_ship: number;
  total_items: number;
  today_orders: number;
  today_sales_amount: number;
  claims_count: number;
  measurement_date: string;
  metrics_period: string;
  reputation: Reputation;
  roman_index: string;
  display_name: string;
  error?: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

const LEVEL_COLORS: Record<string, string> = {
  "1_red":       "#ef4444",
  "2_orange":    "#FF5722",
  "3_yellow":    "#FFE600",
  "4_light_green": "#7CFC00",
  "5_green":     "#39FF14",
};
const LEVEL_LABELS: Record<string, string> = {
  "1_red":       "Rojo",
  "2_orange":    "Naranja",
  "3_yellow":    "Amarillo",
  "4_light_green": "Verde claro",
  "5_green":     "Verde",
};

function RepoBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-xs text-gray-500">Sin datos</span>;
  const color = LEVEL_COLORS[level] ?? "#6B7280";
  const label = LEVEL_LABELS[level] ?? level;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: color + "22", color, border: `1px solid ${color}44` }}
    >
      <Star className="w-3 h-3" /> {label}
    </span>
  );
}

function MetricCard({
  icon, label, value, color, sublabel, urgent,
}: {
  icon: React.ReactNode; label: string; value: number | string;
  color: string; sublabel?: string; urgent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden"
      style={{
        background: urgent && Number(value) > 0 ? color + "18" : "#1F1F1F",
        border: `1px solid ${urgent && Number(value) > 0 ? color + "55" : "rgba(255,255,255,0.07)"}`,
      }}
    >
      {urgent && Number(value) > 0 && (
        <span
          className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse"
          style={{ background: color }}
        />
      )}
      <div className="flex items-center gap-2" style={{ color }}>
        {icon}
        <span className="text-xs font-semibold text-gray-400">{label}</span>
      </div>
      <p className="text-3xl font-black" style={{ color: Number(value) > 0 && urgent ? color : "#fff" }}>
        {value}
      </p>
      {sublabel && <p className="text-[10px]" style={{ color: "#6B7280" }}>{sublabel}</p>}
    </div>
  );
}

function RepuCard({ rep }: { rep: Reputation }) {
  const good = rep.level_id === "5_green" || rep.level_id === "4_light_green";
  return (
    <div className="rounded-2xl p-4" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Star className="w-4 h-4" style={{ color: "#FFE600" }} /> Reputación
        </h3>
        <RepoBadge level={rep.level_id} />
      </div>

      {/* Barra de colores MeLi */}
      <div className="flex h-2 rounded-full overflow-hidden mb-3">
        {["1_red","2_orange","3_yellow","4_light_green","5_green"].map(lvl => (
          <div
            key={lvl}
            className="flex-1 transition-all"
            style={{
              background: LEVEL_COLORS[lvl],
              opacity: rep.level_id === lvl ? 1 : 0.25,
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Envíos con demora", val: pct(rep.delayed_handling_time), max: "Máx 18%", color: rep.delayed_handling_time > 0.18 ? "#ef4444" : "#39FF14" },
          { label: "Reclamos", val: pct(rep.claims), max: "Máx 2%", color: rep.claims > 0.02 ? "#ef4444" : "#39FF14" },
          { label: "Cancelaciones", val: pct(rep.cancellations), max: "Máx 2%", color: rep.cancellations > 0.02 ? "#ef4444" : "#39FF14" },
        ].map(m => (
          <div key={m.label} className="rounded-xl p-2" style={{ background: "#121212" }}>
            <p className="text-lg font-black" style={{ color: m.color }}>{m.val}</p>
            <p className="text-[9px] leading-tight" style={{ color: "#6B7280" }}>{m.label}</p>
            <p className="text-[9px]" style={{ color: "#374151" }}>{m.max}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-3 text-xs justify-center">
        <span style={{ color: "#39FF14" }}>✓ {pct(rep.ratings_positive)} positivas</span>
        <span style={{ color: "#6B7280" }}>○ {pct(rep.ratings_neutral)} neutras</span>
        <span style={{ color: "#ef4444" }}>✕ {pct(rep.ratings_negative)} negativas</span>
      </div>
    </div>
  );
}

function ActivityCard({ orders, amount }: { orders: number; amount: number }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <BarChart2 className="w-4 h-4" style={{ color: "#00E5FF" }} /> Actividad del día
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3 text-center" style={{ background: "#121212" }}>
          <ShoppingCart className="w-5 h-5 mx-auto mb-1" style={{ color: "#00E5FF" }} />
          <p className="text-2xl font-black text-white">{orders}</p>
          <p className="text-[10px]" style={{ color: "#6B7280" }}>Ventas</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: "#121212" }}>
          <DollarSign className="w-5 h-5 mx-auto mb-1" style={{ color: "#39FF14" }} />
          <p className="text-lg font-black" style={{ color: "#39FF14" }}>{fmt(amount)}</p>
          <p className="text-[10px]" style={{ color: "#6B7280" }}>Facturación</p>
        </div>
      </div>
    </div>
  );
}

function AccountPanel({ data, defaultOpen, editingNick, editNickVal, setEditingNick, setEditNickVal, handleRenameAccount }: {
  data: AccountDash; defaultOpen?: boolean;
  editingNick: string | null; editNickVal: string;
  setEditingNick: (v: string | null) => void; setEditNickVal: (v: string) => void;
  handleRenameAccount: (meliUserId: string, newName: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const urgentTotal = (data.unanswered_questions ?? 0) + (data.ready_to_ship ?? 0) + (data.pending_messages ?? 0);

  return (
    <div
      className="rounded-2xl overflow-hidden mb-4"
      style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Account Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
        style={{ background: "linear-gradient(90deg,#1F1F1F,#1a1a1a)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl text-black"
            style={{ background: "linear-gradient(135deg,#FFE600,#FF9800)" }}
          >
            <Store className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2 flex-wrap">
              {data.roman_index && (
                <span className="text-xs font-black px-2 py-0.5 rounded-lg"
                  style={{ background: "#FFE600", color: "#121212" }}>
                  {data.roman_index}
                </span>
              )}
              <p className="font-black text-white text-base flex items-center gap-1.5">
                {editingNick === data.meli_user_id ? (
                  <>
                    <input
                      value={editNickVal}
                      onChange={e => setEditNickVal(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleRenameAccount(data.meli_user_id, editNickVal)}
                      className="font-black text-white text-base bg-transparent border-b border-yellow-400 outline-none w-32"
                      autoFocus
                    />
                    <button onClick={() => handleRenameAccount(data.meli_user_id, editNickVal)} className="p-0.5 rounded hover:bg-white/10">
                      <Check className="w-4 h-4 text-green-400" />
                    </button>
                    <button onClick={() => setEditingNick(null)} className="p-0.5 rounded hover:bg-white/10">
                      <XCircle className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </>
                ) : (
                  <>
                    @{data.account}
                    <button
                      onClick={() => { setEditingNick(data.meli_user_id); setEditNickVal(data.account); }}
                      className="p-0.5 rounded hover:bg-white/10"
                    >
                      <Pencil className="w-3 h-3 text-gray-500" />
                    </button>
                  </>
                )}
              </p>
              {data.reputation?.power_seller_status && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#FFE60022", color: "#FFE600" }}>
                  {data.reputation.power_seller_status.toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <RepoBadge level={data.reputation?.level_id ?? null} />
              <span className="text-xs" style={{ color: "#6B7280" }}>{data.total_items ?? 0} publicaciones</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {urgentTotal > 0 && (
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-black animate-pulse"
              style={{ background: "#FF5722" }}
            >
              {urgentTotal}
            </span>
          )}
          {open ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {data.error && (
            <div className="p-4 rounded-xl text-sm" style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444455" }}>
              <p className="font-bold mb-1">⚠️ Error al cargar cuenta</p>
              {data.error === "token_expired" && (
                <p>El token de acceso ha expirado. Por favor, reconecta la cuenta en <a href="/configuracion/meli" className="underline hover:text-red-300">Configuración</a>.</p>
              )}
              {data.error === "http_451_blocked" && (
                <p>MercadoLibre ha bloqueado el acceso a esta cuenta (HTTP 451). Verifica tu conexión o contacta al soporte de MeLi.</p>
              )}
              {!["token_expired", "http_451_blocked"].includes(data.error) && (
                <p>{data.error}</p>
              )}
            </div>
          )}

          {/* Indicadores urgentes */}
          <div>
            <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "#6B7280" }}>
              Indicadores — Panel de Control
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard icon={<MessageCircle className="w-4 h-4" />} label="Preguntas sin responder"
                value={data.unanswered_questions ?? 0} color="#FF5722" urgent />
              <MetricCard icon={<MessageSquare className="w-4 h-4" />} label="Mensajes pendientes"
                value={data.pending_messages ?? 0} color="#FF9800" urgent />
              <MetricCard icon={<Truck className="w-4 h-4" />} label="Envíos pendientes"
                value={data.ready_to_ship ?? 0} color="#00E5FF" urgent />
              <MetricCard icon={<Package className="w-4 h-4" />} label="Publicaciones activas"
                value={data.total_items ?? 0} color="#39FF14" />
            </div>
          </div>

          {/* Reputación + Actividad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RepuCard rep={data.reputation ?? { level_id: null, power_seller_status: null, transactions_total: 0, transactions_completed: 0, ratings_positive: 0, ratings_negative: 0, ratings_neutral: 0, delayed_handling_time: 0, claims: 0, cancellations: 0, immediate_payment: false }} />
            <ActivityCard orders={data.today_orders ?? 0} amount={data.today_sales_amount ?? 0} />
          </div>

          {/* Acciones rápidas */}
          <div>
            <p className="text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: "#6B7280" }}>
              Acciones rápidas
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Ver preguntas",    color: "#FF5722", href: `/appjeez/mensajes`, icon: <MessageCircle className="w-4 h-4" />, badge: data.unanswered_questions },
                { label: "Estadísticas",     color: "#39FF14", href: `/appjeez/estadisticas`,  icon: <TrendingUp className="w-4 h-4" /> },
                { label: "Ver etiquetas",    color: "#00E5FF", href: `/appjeez/etiquetas`,     icon: <Tag className="w-4 h-4" /> },
                { label: "Ver publicaciones",color: "#FFE600", href: `/appjeez/publicaciones`, icon: <Package className="w-4 h-4" /> },
              ].map(a => (
                <a
                  key={a.label}
                  href={a.href}
                  target={a.href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="relative flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-opacity hover:opacity-80"
                  style={{ background: a.color + "18", color: a.color, border: `1px solid ${a.color}33` }}
                >
                  {a.icon} {a.label}
                  {a.href.startsWith("http") && <ExternalLink className="w-3 h-3" />}
                  {"badge" in a && (a as { badge?: number }).badge! > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                      style={{ background: "#FF5722" }}
                    >
                      {(a as { badge?: number }).badge! > 9 ? "9+" : (a as { badge?: number }).badge}
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AppJeezInner() {
  const params    = useSearchParams();
  const connected = params.get("connected") === "true";

  const [accounts, setAccounts] = useState<AccountDash[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [totalQuestionsAlert, setTotalQuestionsAlert] = useState(0);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/meli-dashboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AccountDash[] = await res.json();
      setAccounts(data);
      setLastUpdate(new Date());
      const q = data.reduce((s, a) => s + (a.unanswered_questions ?? 0), 0);
      setTotalQuestionsAlert(q);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Inicializar selectedAccountId desde localStorage y preseleccionar primera cuenta
  useEffect(() => {
    if (accounts.length === 0) return;

    const saved = localStorage.getItem("selectedAccountId");
    if (saved && accounts.find(a => a.meli_user_id === saved)) {
      setSelectedAccountId(saved);
    } else if (accounts.length > 0) {
      // Preseleccionar primera cuenta
      setSelectedAccountId(accounts[0].meli_user_id);
    }
  }, [accounts]);

  // Guardar selectedAccountId en localStorage cuando cambia
  useEffect(() => {
    if (selectedAccountId) {
      localStorage.setItem("selectedAccountId", selectedAccountId);
    }
  }, [selectedAccountId]);

  // ⚠️ Polling automático DESACTIVADO - Usando SSE/Webhooks en su lugar
  const { isRefreshing, manualRefresh } = useAutoRefresh(
    load,
    false, // NO automático (era true cada 60s antes)
    60000
  );

  const handleNotification = useCallback((notification: any) => {
    console.log("[SSE] Notificación recibida:", notification);
    // Actualizar solo la cuenta del notification.user_id
    setAccounts(prev =>
      prev.map(acc =>
        acc.meli_user_id === notification.user_id
          ? {
              ...acc,
              unanswered_questions: (acc.unanswered_questions ?? 0) + 1,
            }
          : acc
      )
    );
    // Incrementar badge global
    setTotalQuestionsAlert(prev => prev + 1);
  }, []);

  // Conectar a SSE para notificaciones en tiempo real
  const { connected: streamConnected } = useNotificationStream(
    handleNotification,
    true // Enabled por defecto
  );

  // Obtener cuenta seleccionada
  const selectedAccount = accounts.find(a => a.meli_user_id === selectedAccountId);

  const totalUrgent = accounts.reduce(
    (s, a) => s + (a.unanswered_questions ?? 0) + (a.ready_to_ship ?? 0) + (a.pending_messages ?? 0) + (a.claims_count ?? 0), 0
  );
  const totalSales = accounts.reduce((s, a) => s + (a.today_orders ?? 0), 0);
  const totalAmount = accounts.reduce((s, a) => s + (a.today_sales_amount ?? 0), 0);

  // Construir datos para el panel de post-venta unificado
  const postSaleMetrics = accounts.map(acc => {
    const claimsPercent = acc.claims_count ?? 0;
    let riskLevel: "low" | "medium" | "high" | "critical" = "low";

    if (claimsPercent > 2) {
      riskLevel = "critical";
    } else if (claimsPercent > 1.5) {
      riskLevel = "high";
    } else if (claimsPercent > 1) {
      riskLevel = "medium";
    }

    return {
      meli_user_id: acc.meli_user_id,
      account_name: acc.account,
      roman_index: acc.roman_index || "",
      claims_count: acc.claims_count ?? 0,
      claims_percent: acc.reputation?.claims ? (acc.reputation.claims * 100) : undefined,
      mediations_count: 0, // TODO: Obtener de API
      mediations_percent: acc.reputation?.cancellations ? (acc.reputation.cancellations * 100) : undefined,
      delayed_shipments: 0, // TODO: Obtener de API
      cancellations_percent: acc.reputation?.delayed_handling_time ? (acc.reputation.delayed_handling_time * 100) : undefined,
      reputation_risk: riskLevel,
    };
  });

  const navItems = [
    { label: "Dashboard",       icon: <BarChart2 className="w-4 h-4" />,       href: "/appjeez",               active: true  },
    { label: "Estadísticas",    icon: <TrendingUp className="w-4 h-4" />,      href: "/appjeez/estadisticas",  active: false },
    { label: "Mensajería",      icon: <MessageCircle className="w-4 h-4" />,   href: "/appjeez/mensajes",      active: false },
    { label: "Etiquetas",       icon: <Tag className="w-4 h-4" />,             href: "/appjeez/etiquetas",     active: false },
    { label: "Publicaciones",   icon: <Package className="w-4 h-4" />,         href: "/appjeez/publicaciones", active: false },
    { label: "Sincronizar",     icon: <Copy className="w-4 h-4" />,            href: "/appjeez/sincronizar",   active: false },
    { label: "Precios",         icon: <DollarSign className="w-4 h-4" />,     href: "/appjeez/precios",       active: false },
    { label: "Promociones",     icon: <Zap className="w-4 h-4" />,            href: "/appjeez/promociones",   active: false },
    { label: "Post-Venta",      icon: <AlertTriangle className="w-4 h-4" />,  href: "/appjeez/post-venta",    active: false },
    { label: "Cuentas MeLi",    icon: <Store className="w-4 h-4" />,           href: "/configuracion/meli",    active: false },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "#121212" }}>
      {/* Sidebar desktop */}
      <aside
        className="hidden sm:flex flex-col w-56 flex-shrink-0 border-r"
        style={{ background: "#181818", borderColor: "rgba(255,255,255,0.06)" }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="font-black text-xl" style={{ color: "#FFE600" }}>AppJeez</p>
          <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>Panel Mercado Libre</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(n => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={n.active
                ? { background: "#FFE60018", color: "#FFE600" }
                : { color: "#6B7280" }}
            >
              <span className="relative">
                {n.icon}
                {n.label === "Mensajería" && totalQuestionsAlert > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-black"
                    style={{ background: "#FF5722" }}
                  >
                    {totalQuestionsAlert > 9 ? "9+" : totalQuestionsAlert}
                  </span>
                )}
              </span>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 pb-4">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 text-sm font-bold px-3 py-2.5 rounded-xl w-full transition-opacity hover:opacity-80"
            style={{ background: "#FFE60018", color: "#FFE600", border: "1px solid #FFE60033" }}
          >
            🏠 Inicio Maqjeez
          </Link>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-64 flex flex-col" style={{ background: "#181818" }}>
            <div className="px-5 py-5 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <p className="font-black text-xl" style={{ color: "#FFE600" }}>AppJeez</p>
              <button onClick={() => setSidebarOpen(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map(n => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold"
                  style={n.active ? { background: "#FFE60018", color: "#FFE600" } : { color: "#6B7280" }}
                >
                  {n.icon} {n.label}
                </Link>
              ))}
            </nav>
            <div className="px-4 pb-5">
              <Link
                href="/"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center justify-center gap-2 text-sm font-bold px-3 py-2.5 rounded-xl w-full"
                style={{ background: "#FFE60018", color: "#FFE600", border: "1px solid #FFE60033" }}
              >
                🏠 Inicio Maqjeez
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header
          className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b"
          style={{
            background: "rgba(24,24,24,0.97)",
            backdropFilter: "blur(16px)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-3">
            <button
              className="sm:hidden p-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.05)" }}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="font-black text-white text-base sm:text-lg">Dashboard</h1>
              <p className="text-[10px]" style={{ color: "#6B7280" }}>
                {streamConnected ? (
                  <span style={{ color: "#39FF14" }}>🟢 En vivo</span>
                ) : (
                  <span style={{ color: "#ef4444" }}>🔴 Desconectado</span>
                )}
                {" "} • {lastUpdate ? `Cargado ${lastUpdate.toLocaleTimeString("es-AR")}` : "Cargando..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {totalUrgent > 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background: "#FF572222", color: "#FF5722", border: "1px solid #FF572244" }}
              >
                <Bell className="w-3.5 h-3.5" />
                {totalUrgent} pendientes
              </div>
            )}
            <button
              onClick={load}
              disabled={loading || isRefreshing}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: "#1F1F1F", color: "#00E5FF", border: "1px solid rgba(0,229,255,0.3)" }}
            >
              <RefreshCw className={`w-4 h-4 ${loading || isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{loading || isRefreshing ? "Actualizando..." : "Actualizar"}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 sm:pb-6 max-w-5xl w-full mx-auto">
          {/* Welcome */}
          {connected && (
            <div
              className="rounded-2xl p-4 mb-4 flex items-center gap-3"
              style={{ background: "#39FF1418", border: "1px solid #39FF1440" }}
            >
              <CheckCircle2 className="w-6 h-6 flex-shrink-0" style={{ color: "#39FF14" }} />
              <div>
                <p className="font-bold text-white text-sm">Cuenta conectada exitosamente</p>
                <p className="text-xs" style={{ color: "#39FF14" }}>
                  Mercado Libre vinculado. Tus indicadores se actualizarán automáticamente.
                </p>
              </div>
            </div>
          )}

          {/* Global summary */}
          {!loading && accounts.length > 0 && (
            <>
              <KpiBar accountsCount={accounts.length} salesToday={totalSales} totalAmount={totalAmount} urgentAlerts={totalUrgent} />
              
              {/* Unified Post-Sale Panel - Gestión de problemas críticos */}
              <UnifiedPostSalePanel accounts={postSaleMetrics} isLoading={loading} />
            </>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-2xl p-5 text-center mb-4" style={{ background: "#ef444418", border: "1px solid #ef444440" }}>
              <XCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "#ef4444" }} />
              <p className="text-white font-semibold">Error al cargar</p>
              <p className="text-sm mt-1 mb-3" style={{ color: "#ef4444" }}>{error}</p>
              <button onClick={load} className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500 text-white">
                Reintentar
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="rounded-2xl p-5 animate-pulse" style={{ background: "#1F1F1F" }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-2xl" style={{ background: "#2a2a2a" }} />
                    <div className="flex-1">
                      <div className="h-4 rounded w-36 mb-1.5" style={{ background: "#2a2a2a" }} />
                      <div className="h-3 rounded w-24" style={{ background: "#2a2a2a" }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[1,2,3,4].map(j => <div key={j} className="h-24 rounded-2xl" style={{ background: "#2a2a2a" }} />)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No accounts */}
          {!loading && !error && accounts.length === 0 && (
            <div className="rounded-2xl p-10 text-center" style={{ background: "#1F1F1F" }}>
              <Store className="w-12 h-12 mx-auto mb-3" style={{ color: "#6B7280" }} />
              <p className="text-white font-bold text-lg">Sin cuentas conectadas</p>
              <p className="text-sm mt-1 mb-4" style={{ color: "#6B7280" }}>
                Conecta una cuenta de Mercado Libre para ver tus indicadores.
              </p>
              <Link
                href="/configuracion/meli"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black"
                style={{ background: "#FFE600" }}
              >
                Conectar Mercado Libre
              </Link>
            </div>
          )}

          {/* Accounts Dropdown + Details Panel */}
          {!loading && accounts.length > 0 && (
            <div className="space-y-4">
              {/* Account Selector Dropdown */}
              <AccountSelector
                accounts={accounts}
                selectedId={selectedAccountId}
                onSelect={setSelectedAccountId}
              />

              {/* Account Details Panel - Mostrar solo cuenta seleccionada */}
              {selectedAccount && (
                <AccountDetailsPanel data={selectedAccount} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function AppJeezPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#121212" }}>
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full border-2 animate-spin mx-auto mb-3"
            style={{ borderColor: "#FFE600", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "#6B7280" }}>Cargando panel...</p>
        </div>
      </div>
    }>
      <AppJeezInner />
    </Suspense>
  );
}
