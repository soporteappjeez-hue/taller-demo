"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Truck, Package, Star,
  AlertCircle, ExternalLink, Tag, CheckCircle2,
} from "lucide-react";

interface Shipment {
  shipment_id:     number;
  order_id:        number;
  account:         string;
  logistic_type:   string;
  type:            "flex" | "correo" | "full";
  substatus:       string | null;
  tracking_number: string | null;
  date_created:    string | null;
  label_url:       string;
}

interface ShipmentsData {
  flex:        Shipment[];
  correo:      Shipment[];
  full_count:  number;
}

function timeAgo(date: string | null) {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1)  return "hace menos de 1h";
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function ShipmentCard({ s }: { s: Shipment }) {
  const isFlex = s.type === "flex";
  const color  = isFlex ? "#00E5FF" : "#FF9800";
  const label  = isFlex ? "FLEX" : "CORREO";

  return (
    <div className="rounded-xl p-4 flex items-start justify-between gap-3"
      style={{ background: "#1F1F1F", border: `1px solid ${color}22` }}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18` }}>
          {isFlex ? <Truck className="w-5 h-5" style={{ color }} />
                  : <Package className="w-5 h-5" style={{ color }} />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded"
              style={{ background: color, color: "#121212" }}>
              {label}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#FFE60018", color: "#FFE600" }}>
              @{s.account}
            </span>
          </div>
          <p className="text-sm text-white font-semibold">Orden #{s.order_id ?? s.shipment_id}</p>
          {s.tracking_number && (
            <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>
              Tracking: {s.tracking_number}
            </p>
          )}
          <p className="text-[10px] mt-0.5" style={{ color: "#6B7280" }}>
            {timeAgo(s.date_created)}
            {s.substatus ? ` · ${s.substatus}` : ""}
          </p>
        </div>
      </div>
      <a
        href={s.label_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-opacity hover:opacity-80"
        style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}
      >
        <Tag className="w-3.5 h-3.5" />
        Etiqueta
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

function EnviosInner() {
  const [data, setData]       = useState<ShipmentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [tab, setTab]         = useState<"flex" | "correo">("flex");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/meli-shipments");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const list = tab === "flex" ? (data?.flex ?? []) : (data?.correo ?? []);

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
            </h1>
            <p className="text-[10px]" style={{ color: "#6B7280" }}>Todas las cuentas · Listos para despachar</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-xl disabled:opacity-40"
          style={{ background: "#1F1F1F", color: "#00E5FF" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

        {/* Resumen */}
        {data && !loading && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl p-4 text-center"
              style={{ background: "#00E5FF12", border: "1px solid #00E5FF33" }}>
              <p className="text-2xl font-black" style={{ color: "#00E5FF" }}>{data.flex.length}</p>
              <p className="text-[11px] font-bold text-white mt-1">Flex</p>
              <p className="text-[10px]" style={{ color: "#6B7280" }}>Listos</p>
            </div>
            <div className="rounded-2xl p-4 text-center"
              style={{ background: "#FF980012", border: "1px solid #FF980033" }}>
              <p className="text-2xl font-black" style={{ color: "#FF9800" }}>{data.correo.length}</p>
              <p className="text-[11px] font-bold text-white mt-1">Correo</p>
              <p className="text-[10px]" style={{ color: "#6B7280" }}>Listos</p>
            </div>
            <div className="rounded-2xl p-4 text-center"
              style={{ background: "#39FF1412", border: "1px solid #39FF1433" }}>
              <p className="text-2xl font-black" style={{ color: "#39FF14" }}>{data.full_count}</p>
              <p className="text-[11px] font-bold text-white mt-1">Full MeLi</p>
              <p className="text-[10px]" style={{ color: "#6B7280" }}>Ventas</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          {(["flex", "correo"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={tab === t
                ? { background: t === "flex" ? "#00E5FF" : "#FF9800", color: "#121212" }
                : { background: "#1F1F1F", color: "#6B7280" }}>
              {t === "flex" ? "🚴 Flex" : "📦 Correo"}
              {data && (
                <span className="ml-2 text-xs opacity-70">
                  ({t === "flex" ? data.flex.length : data.correo.length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl p-4 text-center" style={{ background: "#ef444418", border: "1px solid #ef444440" }}>
            <AlertCircle className="w-7 h-7 mx-auto mb-1" style={{ color: "#ef4444" }} />
            <p className="text-sm text-white">{error}</p>
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

        {/* Lista */}
        {!loading && !error && (
          <div className="space-y-3">
            {list.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: "#1F1F1F" }}>
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: "#39FF14" }} />
                <p className="text-white font-bold">Sin envíos pendientes</p>
                <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                  No hay envíos {tab === "flex" ? "Flex" : "por Correo"} listos para despachar
                </p>
              </div>
            ) : (
              list.map((s: Shipment) => <ShipmentCard key={s.shipment_id} s={s} />)
            )}
          </div>
        )}

        {/* Info Full */}
        {!loading && data && data.full_count > 0 && (
          <div className="rounded-2xl p-4"
            style={{ background: "#39FF1408", border: "1px solid #39FF1422" }}>
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4" style={{ color: "#39FF14" }} />
              <p className="font-bold text-white text-sm">Full MeLi — {data.full_count} ventas</p>
            </div>
            <p className="text-xs" style={{ color: "#6B7280" }}>
              Los envíos Full son gestionados automáticamente por Mercado Libre desde sus depósitos. No requieren etiqueta manual.
            </p>
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
