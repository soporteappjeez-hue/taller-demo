"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Printer, Download, CheckCircle2,
  Package, Truck, Zap, AlertCircle, Search,
} from "lucide-react";

interface ShipmentInfo {
  shipment_id: number;
  account: string;
  meli_user_id: string;
  type: "flex" | "turbo" | "correo";
  buyer: string;
  title: string;
}
interface LabelData {
  shipments: ShipmentInfo[];
  summary: { total: number; correo: number; turbo: number; flex: number };
}

function TypeBadge({ type }: { type: string }) {
  const cfg = type === "flex"
    ? { bg: "#00E5FF", label: "FLEX" }
    : type === "turbo"
    ? { bg: "#A855F7", label: "TURBO" }
    : { bg: "#FF9800", label: "CORREO" };
  return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: cfg.bg, color: "#121212" }}>
      {cfg.label}
    </span>
  );
}

function EtiquetasInner() {
  const [data, setData]       = useState<LabelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [filter, setFilter]   = useState<"all" | "correo" | "turbo" | "flex">("all");
  const [search, setSearch]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meli-labels?action=list");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setData(d);
      setSelected(new Set((d.shipments ?? []).map((s: ShipmentInfo) => s.shipment_id)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = (data?.shipments ?? []).filter(s => {
    if (filter !== "all" && s.type !== filter) return false;
    if (search && !s.title.toLowerCase().includes(search.toLowerCase()) &&
        !s.buyer.toLowerCase().includes(search.toLowerCase()) &&
        !s.account.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleItem = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map(s => s.shipment_id)));
  const deselectAll = () => setSelected(new Set());

  const handleDownload = useCallback(async (format: "pdf" | "zpl") => {
    if (!selected.size) return;
    setDownloading(true);
    try {
      const ids = Array.from(selected);
      const idsStr = ids.join(",");
      const res = await fetch(`/api/meli-labels?action=download&format=${format}&ids=${idsStr}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const ext  = format === "zpl" ? "zpl" : "pdf";

      if (format === "pdf") {
        const win = window.open(url, "_blank");
        if (win) win.print();
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `etiquetas-appjeez.${ext}`;
        a.click();
      }
      URL.revokeObjectURL(url);

      await fetch("/api/meli-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipment_ids: ids }),
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }, [selected, load]);

  return (
    <main className="min-h-screen pb-24" style={{ background: "#121212" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b"
        style={{ background: "rgba(18,18,18,0.97)", backdropFilter: "blur(16px)", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <Link href="/appjeez/envios" className="p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="font-black text-white text-base flex items-center gap-2">
              <Printer className="w-5 h-5" style={{ color: "#FFE600" }} /> Etiquetas de Envío
            </h1>
            <p className="text-[10px]" style={{ color: "#6B7280" }}>Impresión masiva multicuenta</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl p-10 text-center" style={{ background: "#1F1F1F" }}>
            <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3" style={{ color: "#FFE600" }} />
            <p className="text-white font-bold">Buscando envíos pendientes...</p>
            <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Consultando todas las cuentas</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "#ef444418", border: "1px solid #ef444440" }}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#ef4444" }} />
            <p className="text-sm text-white">{error}</p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Total",  val: data.summary.total,  color: "#FFE600", icon: <Package className="w-4 h-4" /> },
                { label: "Correo", val: data.summary.correo, color: "#FF9800", icon: <Truck className="w-4 h-4" /> },
                { label: "Turbo",  val: data.summary.turbo,  color: "#A855F7", icon: <Zap className="w-4 h-4" /> },
                { label: "Flex",   val: data.summary.flex,   color: "#00E5FF", icon: <Truck className="w-4 h-4" /> },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-3 text-center" style={{ background: "#1F1F1F", border: `1px solid ${s.color}22` }}>
                  <p className="text-2xl font-black" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[10px] font-bold text-white mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Packing Slip / Resumen de Impresión */}
            {data.shipments.length > 0 && (
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-sm font-black text-white flex items-center gap-2">
                  <Package className="w-4 h-4" style={{ color: "#FFE600" }} />
                  Resumen de Despacho
                </p>
                <div className="space-y-1.5">
                  {data.shipments.map(s => (
                    <div key={s.shipment_id} className="flex items-center gap-2 text-xs">
                      <TypeBadge type={s.type} />
                      <span className="text-white font-medium flex-1 line-clamp-1">{s.title}</span>
                      <span className="text-gray-500 flex-shrink-0">{s.account}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filtros */}
            <div className="flex gap-2">
              {([["all", "Todos"], ["correo", "Correo"], ["turbo", "Turbo"], ["flex", "Flex"]] as const).map(([v, label]) => (
                <button key={v} onClick={() => setFilter(v)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                  style={filter === v ? { background: "#FFE600", color: "#121212" } : { background: "#1F1F1F", color: "#6B7280" }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Buscador */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#6B7280" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por producto, comprador o cuenta..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs text-white outline-none"
                style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            </div>

            {/* Lista */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <p className="text-sm font-bold text-white">{filtered.length} envíos</p>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "#FFE60018", color: "#FFE600" }}>
                    Todas
                  </button>
                  <button onClick={deselectAll} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "#1a1a1a", color: "#6B7280" }}>
                    Ninguna
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                {filtered.map(s => (
                  <div key={s.shipment_id}
                    onClick={() => toggleItem(s.shipment_id)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all"
                    style={{ background: selected.has(s.shipment_id) ? "#FFE60008" : "transparent" }}>
                    <div
                      className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2"
                      style={{ borderColor: selected.has(s.shipment_id) ? "#FFE600" : "#4B5563", background: selected.has(s.shipment_id) ? "#FFE600" : "transparent" }}>
                      {selected.has(s.shipment_id) && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <TypeBadge type={s.type} />
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFE60018", color: "#FFE600" }}>
                          {s.account}
                        </span>
                      </div>
                      <p className="text-xs text-white font-medium line-clamp-1">{s.title}</p>
                      <p className="text-[10px]" style={{ color: "#6B7280" }}>
                        Comprador: {s.buyer} · Envío #{s.shipment_id}
                      </p>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="p-8 text-center">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: "#39FF14" }} />
                    <p className="text-white font-bold text-sm">Sin envíos pendientes</p>
                  </div>
                )}
              </div>
            </div>

            {/* Botones de descarga */}
            {data.shipments.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => handleDownload("pdf")}
                  disabled={selected.size === 0 || downloading}
                  className="w-full py-3.5 rounded-xl font-black text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: "#FFE600", color: "#121212" }}>
                  {downloading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generando...</>
                    : <><Printer className="w-4 h-4" /> Imprimir PDF ({selected.size} etiquetas)</>}
                </button>
                <button
                  onClick={() => handleDownload("zpl")}
                  disabled={selected.size === 0 || downloading}
                  className="w-full py-3 rounded-xl font-black text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: "#1F1F1F", color: "#FFE600", border: "1px solid #FFE60033" }}>
                  <Download className="w-4 h-4" /> Descargar ZPL (Impresora térmica)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function EtiquetasPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#121212" }}>
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "#FFE600" }} />
      </div>
    }>
      <EtiquetasInner />
    </Suspense>
  );
}
