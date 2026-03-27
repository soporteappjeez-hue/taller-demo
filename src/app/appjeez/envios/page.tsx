"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Truck, Package, Star,
  AlertCircle, ExternalLink, Tag, CheckCircle2,
  Clock, AlertTriangle, XCircle,
} from "lucide-react";

interface Shipment {
  shipment_id:     number;
  order_id:        number | null;
  account:         string;
  logistic_type:   string;
  type:            "flex" | "turbo" | "correo" | "full";
  substatus:       string | null;
  tracking_number: string | null;
  date_created:    string | null;
  shipping_limit:  string | null;
  urgency:         "overdue" | "urgent" | "soon" | "ok";
  list_type:       "ready" | "upcoming";
  label_url:       string;
}

interface ShipmentsData {
  ready:       Shipment[];
  upcoming:    Shipment[];
  full_count:  number;
  turbo_count: number;
}

const URGENCY_CONFIG = {
  overdue: { color: "#ef4444", label: "VENCIDO",  icon: XCircle },
  urgent:  { color: "#FF5722", label: "URGENTE",  icon: AlertTriangle },
  soon:    { color: "#FF9800", label: "PRONTO",   icon: Clock },
  ok:      { color: "#39FF14", label: "A TIEMPO", icon: CheckCircle2 },
};

function timeUntil(date: string | null) {
  if (!date) return null;
  const diffMs = new Date(date).getTime() - Date.now();
  const diffH  = diffMs / 3600000;
  if (diffH < 0)   return `Venció hace ${Math.abs(Math.ceil(diffH))}h`;
  if (diffH < 1)   return `${Math.floor(diffMs / 60000)}min restantes`;
  if (diffH < 24)  return `${Math.floor(diffH)}h restantes`;
  return `${Math.floor(diffH / 24)}d restantes`;
}

function ShipmentCard({ s }: { s: Shipment }) {
  const isFlex   = s.type === "flex";
  const isTurbo  = s.type === "turbo";
  const typeColor = isFlex ? "#00E5FF" : isTurbo ? "#A855F7" : "#FF9800";
  const typeLabel = isFlex ? "FLEX" : isTurbo ? "TURBO" : "CORREO";
  const urg     = URGENCY_CONFIG[s.urgency];
  const UrgIcon = urg.icon;
  const until   = timeUntil(s.shipping_limit);

  return (
    <div className="rounded-xl p-4"
      style={{ background: "#1F1F1F", border: `1px solid ${urg.color}33` }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${typeColor}18` }}>
          {isFlex ? <Truck className="w-5 h-5" style={{ color: typeColor }} />
                  : <Package className="w-5 h-5" style={{ color: typeColor }} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded"
              style={{ background: typeColor, color: "#121212" }}>
              {typeLabel}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#FFE60018", color: "#FFE600" }}>
              @{s.account}
            </span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ background: `${urg.color}22`, color: urg.color }}>
              <UrgIcon className="w-3 h-3" />
              {urg.label}
            </span>
          </div>

          <p className="text-sm text-white font-semibold">
            Envío #{s.shipment_id}
            {s.order_id ? <span className="text-gray-500 font-normal ml-1">· Orden #{s.order_id}</span> : ""}
          </p>

          {until && (
            <p className="text-xs mt-0.5 font-bold" style={{ color: urg.color }}>
              ⏱ {until}
            </p>
          )}

          {s.tracking_number && (
            <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>
              Tracking: {s.tracking_number}
            </p>
          )}
          {s.substatus && (
            <p className="text-[10px] mt-0.5" style={{ color: "#6B7280" }}>{s.substatus}</p>
          )}
        </div>

        <a href={s.label_url} target="_blank" rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold flex-shrink-0 transition-opacity hover:opacity-80"
          style={{ background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}33` }}>
          <Tag className="w-4 h-4" />
          <span>Etiqueta</span>
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>
      </div>
    </div>
  );
}

type TabType = "ready" | "upcoming" | "full" | "turbo";

function filterByType(list: Shipment[], type: "flex" | "turbo" | "correo" | "all") {
  if (type === "all") return list;
  return list.filter(s => s.type === type);
}

function EnviosInner() {
  const [data, setData]         = useState<ShipmentsData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [tab, setTab]           = useState<TabType>("ready");
  const [typeFilter, setTypeFilter] = useState<"flex" | "turbo" | "correo" | "all">("all");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/meli-shipments");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentList = filterByType(
    (tab === "ready" || tab === "turbo") ? (data?.ready ?? []) : (data?.upcoming ?? []),
    tab === "turbo" ? "turbo" : typeFilter
  );

  const readyCount    = filterByType(data?.ready    ?? [], typeFilter).length;
  const upcomingCount = filterByType(data?.upcoming ?? [], typeFilter).length;

  const overdueCount = (data?.ready ?? []).filter(s => s.urgency === "overdue").length
                     + (data?.upcoming ?? []).filter(s => s.urgency === "overdue").length;

  return (
    <main className="min-h-screen pb-24" style={{ background: "#121212" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b"
        style={{ background: "rgba(18,18,18,0.97)", backdropFilter: "blur(16px)", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <Link href="/appjeez" className="p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="font-black text-white text-base flex items-center gap-2">
              <Truck className="w-5 h-5" style={{ color: "#00E5FF" }} />
              Envíos y Etiquetas
              {overdueCount > 0 && (
                <span className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center"
                  style={{ background: "#ef4444", color: "#fff" }}>{overdueCount}</span>
              )}
            </h1>
            <p className="text-[10px]" style={{ color: "#6B7280" }}>Todas las cuentas</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-xl disabled:opacity-40"
          style={{ background: "#1F1F1F", color: "#00E5FF" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3">

        {/* Resumen */}
        {data && !loading && (
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-2xl p-3 text-center"
              style={{ background: "#39FF1412", border: "1px solid #39FF1433" }}>
              <p className="text-2xl font-black" style={{ color: "#39FF14" }}>{data.ready.length}</p>
              <p className="text-[10px] font-bold text-white mt-0.5">Listos</p>
            </div>
            <div className="rounded-2xl p-3 text-center"
              style={{ background: "#FF980012", border: "1px solid #FF980033" }}>
              <p className="text-2xl font-black" style={{ color: "#FF9800" }}>{data.upcoming.length}</p>
              <p className="text-[10px] font-bold text-white mt-0.5">Próximos</p>
            </div>
            <div className="rounded-2xl p-3 text-center"
              style={{ background: "#A855F712", border: "1px solid #A855F733" }}>
              <p className="text-2xl font-black" style={{ color: "#A855F7" }}>{data.turbo_count}</p>
              <p className="text-[10px] font-bold text-white mt-0.5">Turbo</p>
            </div>
            <div className="rounded-2xl p-3 text-center"
              style={{ background: "#FFE60012", border: "1px solid #FFE60033" }}>
              <p className="text-2xl font-black" style={{ color: "#FFE600" }}>{data.full_count}</p>
              <p className="text-[10px] font-bold text-white mt-0.5">Full MeLi</p>
            </div>
          </div>
        )}

        {/* Filtro tipo */}
        {tab !== "turbo" && (
        <div className="flex gap-2">
          {([["all","Todos"],["flex","🚴 Flex"],["turbo","🚀 Turbo"],["correo","📦 Correo"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setTypeFilter(v)}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={typeFilter === v
                ? { background: "#FFE600", color: "#121212" }
                : { background: "#1F1F1F", color: "#6B7280" }}>
              {label}
            </button>
          ))}
        </div>
        )}

        {/* Tabs Listos / Próximos / Turbo / Full */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setTab("ready")}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={tab === "ready"
              ? { background: "#39FF14", color: "#121212" }
              : { background: "#1F1F1F", color: "#6B7280" }}>
            Listos {data ? `(${readyCount})` : ""}
          </button>
          <button onClick={() => setTab("upcoming")}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={tab === "upcoming"
              ? { background: "#FF9800", color: "#121212" }
              : { background: "#1F1F1F", color: "#6B7280" }}>
            Próximos {data ? `(${upcomingCount})` : ""}
          </button>
          <button onClick={() => setTab("turbo")}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={tab === "turbo"
              ? { background: "#A855F7", color: "#ffffff" }
              : { background: "#1F1F1F", color: "#6B7280" }}>
            🚀 Turbo {data ? `(${data.turbo_count})` : ""}
          </button>
          <button onClick={() => setTab("full")}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={tab === "full"
              ? { background: "#FFE600", color: "#121212" }
              : { background: "#1F1F1F", color: "#6B7280" }}>
            Full {data ? `(${data.full_count})` : ""}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl p-4 text-center" style={{ background: "#ef444418", border: "1px solid #ef444440" }}>
            <AlertCircle className="w-7 h-7 mx-auto mb-1" style={{ color: "#ef4444" }} />
            <p className="text-sm text-white">{error}</p>
            <button onClick={load} className="mt-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white">Reintentar</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: "#1F1F1F" }}>
                <div className="h-4 rounded w-1/2 mb-2" style={{ background: "#2a2a2a" }} />
                <div className="h-3 rounded w-3/4" style={{ background: "#2a2a2a" }} />
              </div>
            ))}
          </div>
        )}

        {/* Lista envíos */}
        {!loading && !error && tab !== "full" && (
          <div className="space-y-3">
            {currentList.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: "#1F1F1F" }}>
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: "#39FF14" }} />
                <p className="text-white font-bold">Sin envíos pendientes</p>
                <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                  No hay envíos {tab === "ready" ? "listos" : tab === "turbo" ? "turbo" : "próximos"}
                  {tab !== "turbo" && typeFilter !== "all" ? ` de tipo ${typeFilter}` : ""}
                </p>
              </div>
            ) : (
              currentList.map((s: Shipment) => <ShipmentCard key={s.shipment_id} s={s} />)
            )}
          </div>
        )}

        {/* Tab Full */}
        {!loading && !error && tab === "full" && (
          <div className="rounded-2xl p-6 text-center"
            style={{ background: "#FFE60008", border: "1px solid #FFE60022" }}>
            <Star className="w-12 h-12 mx-auto mb-3" style={{ color: "#FFE600" }} />
            <p className="font-black text-white text-xl mb-1">{data?.full_count ?? 0} ventas Full</p>
            <p className="text-sm mb-4" style={{ color: "#6B7280" }}>
              Los envíos Full son gestionados automáticamente por Mercado Libre desde sus depósitos. No requieren etiqueta manual ni preparación de tu parte.
            </p>
            <a href="https://www.mercadolibre.com.ar/envios/fulfillment"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
              style={{ background: "#FFE600", color: "#121212" }}>
              Ver en MeLi <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </main>
  );
}

export default function EnviosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#121212" }}>
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "#00E5FF" }} />
      </div>
    }>
      <EnviosInner />
    </Suspense>
  );
}
