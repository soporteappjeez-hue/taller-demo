"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, RefreshCw, Printer, Download, CheckCircle2,
  Package, Truck, Zap, AlertCircle, ChevronDown, ChevronRight, Send,
} from "lucide-react";
import { calculateZoneDistance, ZONE_CFG } from "@/lib/zone-calc";
import { ZoneIndicator } from "@/components/ZoneIndicator";

type StatusTab = "pending" | "printed" | "all";
type LogisticType = "flex" | "correo" | "turbo" | "full";

interface ShipmentInfo {
  shipment_id: number;
  order_id: number | null;
  account: string;
  type: LogisticType;
  buyer: string;
  buyer_nickname: string | null;
  title: string;
  quantity: number;
  thumbnail: string | null;
  delivery_date: string | null;
  dispatch_date: string | null;
  printed_at?: string | null;
  item_id: string | null;
  purchase_url?: string | null;
  seller_sku?: string | null;
  attributes?: string | null;
  urgency: "delayed" | "today" | "tomorrow" | "week" | "upcoming";
  status: string;
  status_label: string | null;
}

interface LabelData {
  shipments: ShipmentInfo[];
  summary: Record<LogisticType, number>;
}

const TYPE_CFG: Record<LogisticType, { color: string; label: string; icon: React.ReactNode }> = {
  correo: { color: "#FF9800", label: "CORREO", icon: <Truck className="w-3.5 h-3.5" /> },
  flex: { color: "#00E5FF", label: "FLEX", icon: <Truck className="w-3.5 h-3.5" /> },
  turbo: { color: "#A855F7", label: "TURBO", icon: <Zap className="w-3.5 h-3.5" /> },
  full: { color: "#FFE600", label: "FULL", icon: <span className="text-xs">⚡</span> },
};

function LabelCard({
  shipment,
  onPrinted,
  isSelected,
  onToggleSelection,
}: {
  shipment: ShipmentInfo;
  onPrinted?: (id: number) => void;
  isSelected?: boolean;
  onToggleSelection?: (id: number) => void;
}) {
  const cfg = TYPE_CFG[shipment.type];
  const zone = calculateZoneDistance(shipment.delivery_date);
  const zoneCfg = ZONE_CFG[zone];
  const thumb = (shipment.thumbnail || "").replace("http://", "https://");

  return (
    <div
      className="rounded-2xl overflow-hidden mb-3 flex items-start gap-4 p-3 relative transition-all"
      style={{ 
        background: "#1A1A1A", 
        border: isSelected ? "2px solid #39FF14" : "1px solid rgba(255,255,255,0.06)",
        boxShadow: isSelected ? "0 0 12px rgba(57, 255, 20, 0.3)" : "none",
      }}
    >
      {/* Checkbox en esquina superior izquierda */}
      {onToggleSelection && (
        <button
          onClick={() => onToggleSelection(shipment.shipment_id)}
          className="absolute top-3 left-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-all z-10"
          style={{
            borderColor: isSelected ? "#39FF14" : "rgba(255,255,255,0.3)",
            background: isSelected ? "#39FF14" : "transparent",
          }}
          title="Seleccionar para imprimir"
        >
          {isSelected && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#121212" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </button>
      )}
      {/* Imagen 100x100px */}
      <a
        href={shipment.purchase_url || `https://www.mercadolibre.com.ar/compras/${shipment.order_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-24 h-24 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center cursor-pointer group relative"
        style={{ background: "#2a2a2a", border: "1px solid rgba(255,255,255,0.1)" }}
        title="Ver compra en Mercado Libre"
      >
        {thumb ? (
          <Image
            src={thumb}
            alt={shipment.title}
            width={96}
            height={96}
            loading="lazy"
            className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
            unoptimized
          />
        ) : (
          <Package className="w-8 h-8 text-gray-600" />
        )}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.6)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </div>
      </a>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between pt-2">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{ background: cfg.color, color: "#121212" }}>
              {cfg.label}
            </span>
            <ZoneIndicator zone={zone} />
          </div>
          <p className="text-xs font-bold text-white line-clamp-2 mb-1">
            {shipment.title}
            {shipment.attributes && (
              <span className="text-gray-400 text-[11px] font-normal"> • {shipment.attributes}</span>
            )}
          </p>
          <p className="text-[10px]" style={{ color: "#6B7280" }}>
            {shipment.buyer}{shipment.buyer_nickname ? ` (@${shipment.buyer_nickname})` : ""}
          </p>
          
          {/* Detalles: Unidades + SKU */}
          <div className="flex items-center gap-2 text-[10px] mt-2 p-1.5 rounded"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            <div>
              <span style={{ color: "#9CA3AF" }}>Unidades:</span>
              <span className="ml-1 font-bold text-white">{shipment.quantity}</span>
            </div>
            {shipment.seller_sku && (
              <>
                <div style={{ width: "1px", height: "14px", background: "rgba(255,255,255,0.2)" }}></div>
                <div className="truncate">
                  <span style={{ color: "#9CA3AF" }}>SKU:</span>
                  <span className="ml-1 font-bold text-white truncate">{shipment.seller_sku}</span>
                </div>
              </>
            )}
          </div>
          {shipment.dispatch_date && (
            <p className="text-[10px] mt-1" style={{ color: "#FF9800" }}>
              📦 Despachar antes del {new Date(shipment.dispatch_date).toLocaleDateString("es-AR", { weekday: "long", day: "numeric" })}
            </p>
          )}
        </div>
      </div>

      {/* Botones */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <button
          onClick={() => onPrinted?.(shipment.shipment_id)}
          className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
          style={{ background: cfg.color, color: "#121212" }}
          title="Imprimir y marcar como impresa"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Imprimir</span>
        </button>
      </div>
    </div>
  );
}

function EtiquetasInner() {
  const [data, setData] = useState<LabelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<StatusTab>("pending");
  const [logisticFilter, setLogisticFilter] = useState<LogisticType>("flex");
  const [printing, setPrinting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meli-labels?action=list");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d: LabelData = await res.json();
      setData(d);
    } catch (e) {
      console.error("Error loading labels:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Funciones para manejar selección
  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((allIds: number[]) => {
    setSelectedIds(prev => {
      // Si todos están seleccionados, deseleccionar todos
      if (allIds.every(id => prev.has(id))) {
        return new Set();
      }
      // Si no, seleccionar todos
      return new Set(allIds);
    });
  }, []);

  // Filtrar datos según pestaña de estado y logística
  const filtered = data?.shipments?.filter(s => {
    const isPrinted = !!s.printed_at;
    
    // Filtro de estado
    if (statusTab === "pending" && isPrinted) return false;
    if (statusTab === "printed" && !isPrinted) return false;
    
    // Filtro de logística
    if (s.type !== logisticFilter) return false;
    
    return true;
  }) ?? [];

  // Contar por tipo para cada estado
  const countByType = useCallback((type: LogisticType, status: StatusTab) => {
    return (data?.shipments ?? []).filter(s => {
      const isPrinted = !!s.printed_at;
      if (status === "pending" && isPrinted) return false;
      if (status === "printed" && !isPrinted) return false;
      return s.type === type;
    }).length;
  }, [data]);

  const handlePrinted = async (shipmentId: number) => {
    setPrinting(true);
    try {
      // Marcar como impresa en Supabase
      const res = await fetch("/api/meli-labels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipment_id: shipmentId, status: "printed" }),
      });

      if (!res.ok) throw new Error("Failed to mark as printed");

      // Actualizar estado local
      setData(prev => prev ? {
        ...prev,
        shipments: prev.shipments.map(s =>
          s.shipment_id === shipmentId
            ? { ...s, printed_at: new Date().toISOString() }
            : s
        ),
      } : null);
    } catch (e) {
      console.error("Error marking as printed:", e);
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintAll = async () => {
    if (selectedIds.size === 0) return;
    setPrinting(true);
    try {
      // Descargar PDF consolidado solo con los seleccionados
      const ids = Array.from(selectedIds).join(",");
      
      const res = await fetch(`/api/meli-labels?ids=${ids}`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `etiquetas-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Marcar solo las seleccionadas como impresas
      await Promise.all(
        Array.from(selectedIds).map(id =>
          fetch("/api/meli-labels", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shipment_id: id, status: "printed" }),
          })
        )
      );

      // Actualizar estado local
      setData(prev => prev ? {
        ...prev,
        shipments: prev.shipments.map(s =>
          selectedIds.has(s.shipment_id)
            ? { ...s, printed_at: new Date().toISOString() }
            : s
        ),
      } : null);
      
      // Limpiar selección después de imprimir
      setSelectedIds(new Set());
    } catch (e) {
      console.error("Error printing selected:", e);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <main className="min-h-screen pb-24" style={{ background: "#121212" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b"
        style={{
          background: "rgba(18,18,18,0.97)",
          backdropFilter: "blur(16px)",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-3">
          <Link href="/appjeez" className="p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="font-black text-white text-base flex items-center gap-2">
              <Printer className="w-5 h-5" style={{ color: "#FFE600" }} />
              Gestor de Expedición
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusTab === "pending" && filtered.length > 0 && (
            <button
              onClick={() => selectAll(filtered.map(s => s.shipment_id))}
              className="p-2 rounded-lg transition-all"
              style={{ background: "rgba(255,255,255,0.05)" }}
              title={filtered.every(s => selectedIds.has(s.shipment_id)) ? "Deseleccionar todos" : "Seleccionar todos"}
            >
              <div className="w-4 h-4 rounded border-2 flex items-center justify-center" style={{
                borderColor: filtered.every(s => selectedIds.has(s.shipment_id)) ? "#39FF14" : "rgba(255,255,255,0.3)",
                background: filtered.every(s => selectedIds.has(s.shipment_id)) ? "#39FF14" : "transparent",
              }}>
                {filtered.every(s => selectedIds.has(s.shipment_id)) && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#121212" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg transition-all"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-4">
        {loading ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: "#1A1A1A" }}>
            <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3" style={{ color: "#FFE600" }} />
            <p className="text-white font-bold">Cargando etiquetas...</p>
          </div>
        ) : !data ? (
          <div
            className="rounded-2xl p-10 text-center flex items-center justify-center gap-3"
            style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <AlertCircle className="w-8 h-8" style={{ color: "#ef4444" }} />
            <p className="text-white font-bold">Error al cargar etiquetas</p>
          </div>
        ) : (
          <>
            {/* 3 Pestañas de Estado */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {(["pending", "printed", "all"] as StatusTab[]).map(tab => {
                const counts = {
                  pending: data.shipments.filter(s => !s.printed_at).length,
                  printed: data.shipments.filter(s => s.printed_at).length,
                  all: data.shipments.length,
                };
                const isActive = statusTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setStatusTab(tab)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all"
                    style={
                      isActive
                        ? { background: "#FFE600", color: "#121212" }
                        : { background: "#1A1A1A", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.06)" }
                    }
                  >
                    {tab === "pending" && "📥 Pendientes"}
                    {tab === "printed" && "✅ Impresas"}
                    {tab === "all" && "👁️ Todas"}
                    <span
                      className="text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                      style={
                        isActive
                          ? { background: "rgba(0,0,0,0.2)" }
                          : { background: "#FFE60025", color: "#FFE600" }
                      }
                    >
                      {counts[tab]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Filtros Logísticos */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-1 px-1">
              {(["flex", "correo", "turbo", "full"] as LogisticType[]).map(type => {
                const cfg = TYPE_CFG[type];
                const count = countByType(type, statusTab);
                const isActive = logisticFilter === type;
                return (
                  <button
                    key={type}
                    onClick={() => setLogisticFilter(type)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap"
                    style={
                      isActive
                        ? { background: cfg.color, color: "#121212", border: `2px solid ${cfg.color}` }
                        : {
                          background: "transparent",
                          color: cfg.color,
                          border: `2px solid ${cfg.color}40`,
                        }
                    }
                  >
                    {cfg.icon}
                    {cfg.label}
                    <span className="text-[9px] font-black px-1">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Botón Imprimir Seleccionadas */}
            {statusTab === "pending" && filtered.length > 0 && (
              <div className="mb-4 flex justify-center">
                <button
                  onClick={handlePrintAll}
                  disabled={printing || selectedIds.size === 0}
                  className="px-6 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2"
                  style={{
                    background: selectedIds.size > 0 ? "#39FF14" : "#6B7280",
                    color: "#121212",
                    opacity: (printing || selectedIds.size === 0) ? 0.6 : 1,
                  }}
                >
                  {printing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Imprimir Seleccionadas ({selectedIds.size})
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Lista de Etiquetas */}
            {filtered.length === 0 ? (
              <div
                className="rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-2"
                style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <CheckCircle2 className="w-8 h-8" style={{ color: "#39FF14" }} />
                <p className="text-white font-bold">Sin etiquetas en este filtro</p>
                <p className="text-xs" style={{ color: "#6B7280" }}>
                  {statusTab === "pending" && "Todas las pendientes están impresas ✓"}
                  {statusTab === "printed" && "No hay etiquetas impresas en este tipo"}
                  {statusTab === "all" && "Sin datos"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(shipment => (
                  <LabelCard
                    key={shipment.shipment_id}
                    shipment={shipment}
                    onPrinted={handlePrinted}
                    isSelected={selectedIds.has(shipment.shipment_id)}
                    onToggleSelection={toggleSelection}
                  />
                ))}
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: "#121212" }}>
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "#FFE600" }} />
        </div>
      }
    >
      <EtiquetasInner />
    </Suspense>
  );
}
