"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Printer, Download, CheckCircle2,
  Package, Truck, Zap, AlertCircle, ChevronDown, ChevronRight, Star,
} from "lucide-react";

type UrgencyType = "delayed" | "today" | "upcoming";
type LogisticType = "flex" | "turbo" | "correo" | "full";
type MainTab = "despachar" | "proximos" | "impresas" | "full";

interface ShipmentInfo {
  shipment_id: number;
  order_id: number | null;
  order_date: string | null;
  account: string;
  meli_user_id: string;
  type: LogisticType;
  buyer: string;
  buyer_nickname: string | null;
  title: string;
  quantity: number;
  unit_price: number | null;
  seller_sku: string | null;
  status: string;
  status_label: string | null;
  urgency: UrgencyType;
  delivery_date: string | null;
  dispatch_date: string | null;
  thumbnail: string | null;
  item_id: string | null;
  printed_at?: string;
}
interface Summary {
  total: number; correo: number; turbo: number; flex: number; full: number;
  delayed: number; today: number; upcoming: number;
}
interface LabelData {
  shipments: ShipmentInfo[];
  full: ShipmentInfo[];
  summary: Summary;
}

/* ── Badges ── */
function TypeBadge({ type }: { type: string }) {
  const cfg =
    type === "flex"  ? { bg: "#00E5FF", label: "FLEX" } :
    type === "turbo" ? { bg: "#A855F7", label: "TURBO" } :
    type === "full"  ? { bg: "#39FF14", label: "FULL" } :
                       { bg: "#FF9800", label: "CORREO" };
  return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
      style={{ background: cfg.bg, color: "#121212" }}>
      {cfg.label}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: UrgencyType }) {
  if (urgency === "delayed") return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
      style={{ background: "#ef444422", color: "#ef4444", border: "1px solid #ef444455" }}>
      DEMORADO
    </span>
  );
  if (urgency === "today") return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
      style={{ background: "#FF980022", color: "#FF9800", border: "1px solid #FF980055" }}>
      HOY
    </span>
  );
  return null;
}

/* ── Fila de envío estilo MeLi Ventas ── */
function ShipmentRow({ s, selected, onToggle }: {
  s: ShipmentInfo; selected?: boolean; onToggle?: (id: number) => void;
}) {
  const borderColor =
    s.urgency === "delayed" ? "#ef4444" :
    s.urgency === "today"   ? "#FF9800" :
    "rgba(255,255,255,0.07)";

  const formattedDate = s.order_date
    ? new Date(s.order_date).toLocaleString("es-AR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })
    : null;

  const deliveryStr = s.delivery_date
    ? new Date(s.delivery_date).toLocaleDateString("es-AR", { weekday:"long", day:"numeric", month:"long" })
    : null;

  return (
    <div
      onClick={() => onToggle?.(s.shipment_id)}
      className={`rounded-2xl mb-2 overflow-hidden transition-all ${onToggle ? "cursor-pointer" : ""}`}
      style={{
        background: selected ? "rgba(255,230,0,0.05)" : "#1A1A1A",
        border: `1px solid ${selected ? "#FFE60040" : borderColor}`,
      }}>

      {/* Fila superior: checkbox + orden + fecha + tipo + comprador */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 flex-wrap"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {onToggle && (
          <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all"
            style={{ borderColor: selected ? "#FFE600" : "#374151", background: selected ? "#FFE600" : "transparent" }}>
            {selected && <CheckCircle2 className="w-3 h-3 text-black" />}
          </div>
        )}
        {/* Cuenta badge */}
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: "#FFE60020", color: "#FFE600" }}>
          {s.account}
        </span>
        {/* Número de venta */}
        {s.order_id && (
          <span className="text-[10px] font-bold flex-shrink-0" style={{ color: "#9CA3AF" }}>
            #{s.order_id}
          </span>
        )}
        {/* Fecha */}
        {formattedDate && (
          <span className="text-[10px] flex-shrink-0" style={{ color: "#6B7280" }}>
            {formattedDate} hs
          </span>
        )}
        {/* Type badge */}
        <TypeBadge type={s.type} />
        {/* Urgency badge */}
        <UrgencyBadge urgency={s.urgency} />
        {/* Comprador — empuja a la derecha */}
        <div className="ml-auto text-right flex-shrink-0">
          <p className="text-[10px] font-bold text-white leading-tight">{s.buyer}</p>
          {s.buyer_nickname && (
            <p className="text-[9px]" style={{ color: "#6B7280" }}>{s.buyer_nickname}</p>
          )}
        </div>
      </div>

      {/* Fila inferior: estado + imagen + producto + precio + cantidad + SKU */}
      <div className="px-3 py-2">
        {/* Estado del envío */}
        <div className="mb-1.5">
          <p className="text-[11px] font-black text-white">{s.status_label ?? s.status}</p>
          {s.dispatch_date && (
            <p className="text-[10px] font-semibold" style={{ color: "#FF9800" }}>
              Despachar antes del {new Date(s.dispatch_date).toLocaleDateString("es-AR", { weekday:"long", day:"numeric", month:"long" })}
            </p>
          )}
          {deliveryStr && (
            <p className="text-[10px]" style={{ color: "#9CA3AF" }}>
              Llega el {deliveryStr}
            </p>
          )}
        </div>

        {/* Producto */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden"
            style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.07)" }}>
            {s.thumbnail
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={s.thumbnail} alt={s.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-4 h-4" style={{ color: "#4B5563" }} />
                </div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white font-medium line-clamp-2 leading-tight">{s.title}</p>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {s.unit_price != null && (
                <span className="text-[11px] font-black" style={{ color: "#39FF14" }}>
                  ${s.unit_price.toLocaleString("es-AR")}
                </span>
              )}
              <span className="text-[10px]" style={{ color: "#6B7280" }}>
                {s.quantity} unidad{s.quantity > 1 ? "es" : ""}
              </span>
              {s.seller_sku && (
                <span className="text-[10px]" style={{ color: "#6B7280" }}>
                  SKU: {s.seller_sku}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Acordeón por tipo ── */
function TypeAccordion({ label, color, icon, items, selected, onToggle, onPrint, downloading, defaultOpen = true }: {
  label: string; color: string; icon: React.ReactNode;
  items: ShipmentInfo[]; selected?: Set<number>;
  onToggle?: (id: number) => void;
  onPrint?: (format: "pdf" | "zpl", ids: number[]) => void;
  downloading?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!items.length) return null;

  const blockIds  = items.map(s => s.shipment_id);
  const selInBlock = selected ? blockIds.filter(id => selected.has(id)) : [];
  const allSel     = selInBlock.length === blockIds.length;

  const toggleAll = () => {
    if (!onToggle) return;
    if (allSel) blockIds.forEach(onToggle);
    else blockIds.filter(id => !selected?.has(id)).forEach(onToggle);
  };

  return (
    <div className="rounded-2xl overflow-hidden mb-3"
      style={{ background: "#1A1A1A", border: `1px solid ${color}22` }}>

      {/* Header del acordeón */}
      <button className="w-full px-4 py-3 flex items-center gap-2 text-left"
        style={{ borderBottom: open ? `1px solid ${color}22` : "none" }}
        onClick={() => setOpen(v => !v)}>
        <span style={{ color }}>{icon}</span>
        <span className="font-black text-sm flex-1" style={{ color }}>{label}</span>
        <span className="text-xs font-black px-2 py-0.5 rounded-full mr-2"
          style={{ background: `${color}20`, color }}>
          {items.length}
        </span>
        {open
          ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color }} />
          : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color }} />}
      </button>

      {/* Contenido */}
      {open && (
        <>
          {onToggle && (
            <div className="px-4 pt-2 pb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold" style={{ color: "#6B7280" }}>
                {selInBlock.length} de {items.length} seleccionados
              </span>
              <button onClick={toggleAll}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all"
                style={{ background: `${color}15`, color }}>
                {allSel ? "Deseleccionar todas" : "Seleccionar todas"}
              </button>
            </div>
          )}

          <div className="px-2 pt-1">
            {items.map(s => (
              <ShipmentRow key={s.shipment_id} s={s}
                selected={selected?.has(s.shipment_id)}
                onToggle={onToggle} />
            ))}
          </div>

          {onPrint && (
            <div className="px-3 pb-3 pt-1 flex gap-2">
              <button
                onClick={() => onPrint("pdf", selInBlock)}
                disabled={selInBlock.length === 0 || downloading}
                className="flex-1 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-35"
                style={{ background: color, color: "#121212" }}>
                {downloading
                  ? <><RefreshCw className="w-3 h-3 animate-spin" />Generando...</>
                  : <><Printer className="w-3 h-3" />PDF ({selInBlock.length})</>}
              </button>
              <button
                onClick={() => onPrint("zpl", selInBlock)}
                disabled={selInBlock.length === 0 || downloading}
                className="py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-35"
                style={{ background: "transparent", color, border: `1px solid ${color}44` }}>
                <Download className="w-3 h-3" />ZPL
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Página principal ── */
function EtiquetasInner() {
  const [data, setData]               = useState<LabelData | null>(null);
  const [history, setHistory]         = useState<ShipmentInfo[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingHist, setLoadingHist] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [selected, setSelected]       = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [mainTab, setMainTab]         = useState<MainTab>("despachar");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/meli-labels?action=list");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d: LabelData = await res.json();
      setData(d);
      const urgent = (d.shipments ?? []).filter(s => s.urgency !== "upcoming");
      setSelected(new Set(urgent.map(s => s.shipment_id)));
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHist(true);
    try {
      const res = await fetch("/api/meli-labels?action=history&period=today");
      if (!res.ok) throw new Error();
      const d = await res.json();
      setHistory(d.shipments ?? []);
    } catch { /* ignore */ }
    finally { setLoadingHist(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (mainTab === "impresas") loadHistory(); }, [mainTab, loadHistory]);

  const toggleItem = (id: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleDownload = useCallback(async (format: "pdf" | "zpl", ids: number[]) => {
    if (!ids.length) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/meli-labels?action=download&format=${format}&ids=${ids.join(",")}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      if (format === "pdf") {
        const win = window.open(url, "_blank");
        if (win) win.print();
      } else {
        const a = document.createElement("a");
        a.href = url; a.download = "etiquetas.zpl"; a.click();
      }
      URL.revokeObjectURL(url);
      const printed = (data?.shipments ?? []).filter(s => ids.includes(s.shipment_id));
      await fetch("/api/meli-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipment_ids: ids,
          shipments: printed.map(s => ({
            shipment_id: s.shipment_id,
            account: s.account, type: s.type, buyer: s.buyer, title: s.title,
          })),
        }),
      });
      load();
    } catch (e) { setError((e as Error).message); }
    finally { setDownloading(false); }
  }, [data, load]);

  const all       = data?.shipments ?? [];
  const urgent    = all.filter(s => s.urgency !== "upcoming");   // delayed + today
  const upcoming  = all.filter(s => s.urgency === "upcoming");
  const fullItems = data?.full ?? [];
  const summary   = data?.summary;

  // Contadores para tabs
  const tabs = [
    { id: "despachar" as MainTab, label: "A Despachar", count: urgent.length,   color: urgent.length > 0 ? "#ef4444" : "#6B7280" },
    { id: "proximos"  as MainTab, label: "Próximos",    count: upcoming.length,  color: "#6B7280" },
    { id: "impresas"  as MainTab, label: "Impresas hoy",count: null,             color: "#39FF14" },
    { id: "full"      as MainTab, label: "Full",         count: fullItems.length, color: "#39FF14" },
  ];

  return (
    <main className="min-h-screen pb-28" style={{ background: "#121212" }}>

      {/* Header */}
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b"
        style={{ background: "rgba(18,18,18,0.97)", backdropFilter: "blur(16px)", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <Link href="/appjeez" className="p-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)" }}>
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="font-black text-white text-base flex items-center gap-2">
              <Printer className="w-5 h-5" style={{ color: "#FFE600" }} />
              Etiquetas de Envío
            </h1>
            <p className="text-[10px]" style={{ color: "#6B7280" }}>Impresión masiva multicuenta</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

        {loading && (
          <div className="rounded-2xl p-10 text-center" style={{ background: "#1F1F1F" }}>
            <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3" style={{ color: "#FFE600" }} />
            <p className="text-white font-bold">Consultando todas las cuentas...</p>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "#ef444418", border: "1px solid #ef444440" }}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#ef4444" }} />
            <p className="text-sm text-white">{error}</p>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Tabs estilo MeLi Ventas */}
            <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {tabs.map(tab => {
                const active = mainTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setMainTab(tab.id)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap"
                    style={active
                      ? { background: "#FFE600", color: "#121212" }
                      : { background: "#1A1A1A", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {tab.label}
                    {tab.count !== null && tab.count > 0 && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                        style={active
                          ? { background: "rgba(0,0,0,0.2)", color: "#121212" }
                          : { background: tab.color + "25", color: tab.color }}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ══ TAB A DESPACHAR ══ */}
            {mainTab === "despachar" && (
              <div className="space-y-0">
                {urgent.length === 0 ? (
                  <div className="rounded-2xl p-10 text-center" style={{ background: "#1F1F1F" }}>
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: "#39FF14" }} />
                    <p className="text-white font-bold text-sm">Sin envíos urgentes</p>
                    <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Todo al día 🎉</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="w-4 h-4" style={{ color: "#ef4444" }} />
                      <span className="text-sm font-black" style={{ color: "#ef4444" }}>
                        {urgent.filter(s=>s.urgency==="delayed").length > 0
                          ? `${urgent.filter(s=>s.urgency==="delayed").length} demorado${urgent.filter(s=>s.urgency==="delayed").length>1?"s":""} · ${urgent.filter(s=>s.urgency==="today").length} de hoy`
                          : `${urgent.length} envío${urgent.length>1?"s":""} para despachar hoy`
                        }
                      </span>
                    </div>
                    <TypeAccordion label="CORREO" color="#FF9800" icon={<Truck className="w-4 h-4" />}
                      items={urgent.filter(s => s.type === "correo")}
                      selected={selected} onToggle={toggleItem}
                      onPrint={handleDownload} downloading={downloading} />
                    <TypeAccordion label="FLEX" color="#00E5FF" icon={<Truck className="w-4 h-4" />}
                      items={urgent.filter(s => s.type === "flex")}
                      selected={selected} onToggle={toggleItem}
                      onPrint={handleDownload} downloading={downloading} />
                    <TypeAccordion label="TURBO" color="#A855F7" icon={<Zap className="w-4 h-4" />}
                      items={urgent.filter(s => s.type === "turbo")}
                      selected={selected} onToggle={toggleItem}
                      onPrint={handleDownload} downloading={downloading} />
                    <p className="text-[10px] text-center pt-1" style={{ color: "#4B5563" }}>
                      Al imprimir, los envíos pasan a Impresas automáticamente
                    </p>
                  </>
                )}
              </div>
            )}

            {/* ══ TAB PRÓXIMOS ══ */}
            {mainTab === "proximos" && (
              <div className="space-y-0">
                {upcoming.length === 0 ? (
                  <div className="rounded-2xl p-10 text-center" style={{ background: "#1F1F1F" }}>
                    <Package className="w-8 h-8 mx-auto mb-2" style={{ color: "#6B7280" }} />
                    <p className="text-white font-bold text-sm">Sin próximos envíos</p>
                  </div>
                ) : (
                  <>
                    <TypeAccordion label="CORREO" color="#FF9800" icon={<Truck className="w-4 h-4" />}
                      items={upcoming.filter(s => s.type === "correo")}
                      selected={selected} onToggle={toggleItem}
                      onPrint={handleDownload} downloading={downloading} />
                    <TypeAccordion label="FLEX" color="#00E5FF" icon={<Truck className="w-4 h-4" />}
                      items={upcoming.filter(s => s.type === "flex")}
                      selected={selected} onToggle={toggleItem}
                      onPrint={handleDownload} downloading={downloading} />
                    <TypeAccordion label="TURBO" color="#A855F7" icon={<Zap className="w-4 h-4" />}
                      items={upcoming.filter(s => s.type === "turbo")}
                      selected={selected} onToggle={toggleItem}
                      onPrint={handleDownload} downloading={downloading} />
                  </>
                )}
              </div>
            )}

            {/* ══ TAB IMPRESAS HOY ══ */}
            {mainTab === "impresas" && (
              <div className="space-y-0">
                {loadingHist ? (
                  <div className="rounded-2xl p-8 text-center" style={{ background: "#1F1F1F" }}>
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin" style={{ color: "#39FF14" }} />
                  </div>
                ) : history.length === 0 ? (
                  <div className="rounded-2xl p-10 text-center" style={{ background: "#1F1F1F" }}>
                    <Package className="w-8 h-8 mx-auto mb-2" style={{ color: "#6B7280" }} />
                    <p className="text-white font-bold text-sm">Sin etiquetas impresas hoy</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4" style={{ color: "#39FF14" }} />
                      <span className="text-sm font-black" style={{ color: "#39FF14" }}>
                        {history.length} etiqueta{history.length>1?"s":""} impresa{history.length>1?"s":""} hoy
                      </span>
                    </div>
                    <TypeAccordion label="CORREO" color="#FF9800" icon={<Truck className="w-4 h-4" />}
                      items={history.filter(s => s.type === "correo")}
                      defaultOpen={false} />
                    <TypeAccordion label="FLEX" color="#00E5FF" icon={<Truck className="w-4 h-4" />}
                      items={history.filter(s => s.type === "flex")}
                      defaultOpen={false} />
                    <TypeAccordion label="TURBO" color="#A855F7" icon={<Zap className="w-4 h-4" />}
                      items={history.filter(s => s.type === "turbo")}
                      defaultOpen={false} />
                  </>
                )}
              </div>
            )}

            {/* ══ TAB FULL ══ */}
            {mainTab === "full" && (
              <div className="space-y-3">
                <div className="rounded-2xl p-4"
                  style={{ background: "#39FF1410", border: "1px solid #39FF1430" }}>
                  <p className="text-xs font-bold" style={{ color: "#39FF14" }}>
                    Los envíos Full son gestionados por el depósito de Mercado Libre. No requieren impresión de etiqueta.
                  </p>
                </div>
                {fullItems.length === 0 ? (
                  <div className="rounded-2xl p-10 text-center" style={{ background: "#1F1F1F" }}>
                    <Star className="w-8 h-8 mx-auto mb-2" style={{ color: "#39FF14" }} />
                    <p className="text-white font-bold text-sm">Sin envíos Full pendientes</p>
                  </div>
                ) : fullItems.map(s => (
                  <ShipmentRow key={s.shipment_id} s={s} />
                ))}
              </div>
            )}

            {/* Resumen inferior */}
            {(mainTab === "despachar" || mainTab === "proximos") && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                {[
                  { label: "Correo", val: (mainTab==="despachar"?urgent:upcoming).filter(s=>s.type==="correo").length, color: "#FF9800" },
                  { label: "Flex",   val: (mainTab==="despachar"?urgent:upcoming).filter(s=>s.type==="flex").length,   color: "#00E5FF" },
                  { label: "Turbo",  val: (mainTab==="despachar"?urgent:upcoming).filter(s=>s.type==="turbo").length,  color: "#A855F7" },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl p-3 text-center"
                    style={{ background: "#1A1A1A", border: `1px solid ${s.color}20` }}>
                    <p className="text-lg font-black" style={{ color: s.color }}>{s.val}</p>
                    <p className="text-[10px] font-bold text-white mt-0.5">{s.label}</p>
                  </div>
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#121212" }}>
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "#FFE600" }} />
      </div>
    }>
      <EtiquetasInner />
    </Suspense>
  );
}
