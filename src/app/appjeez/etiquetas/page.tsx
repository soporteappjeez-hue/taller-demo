"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { isSpoolerAgentAvailable, printZPLviaAgent, purgeAgentQueue } from "@/lib/spooler-agent";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, RefreshCw, Printer, Download, CheckCircle2,
  Package, Truck, Zap, AlertCircle, ChevronDown, ChevronRight, Clock, BarChart3,
} from "lucide-react";
import { calculateZoneDistance, ZONE_CFG } from "@/lib/zone-calc";
import { ZoneIndicator } from "@/components/ZoneIndicator";
import { ShippingTypeButtons } from "@/components/ShippingTypeButtons";
import { StatsPanel } from "@/components/StatsPanel";

type UrgencyType = "delayed" | "today" | "tomorrow" | "week" | "upcoming";
type LogisticType = "flex" | "turbo" | "correo" | "full";
type MainTab = "pendientes" | "impresas" | "todas" | "demoradas" | "estadisticas";

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
  substatus: string | null;
  urgency: UrgencyType;
  delivery_date: string | null;
  dispatch_date: string | null;
  thumbnail: string | null;
  item_id: string | null;
  printed_at?: string;
}

interface Summary {
  correo: number;
  flex: number;
  turbo: number;
  full: number;
  in_transit: number;
  delayed_unshipped: number;
  delayed_in_transit: number;
}

interface LabelData {
  shipments: ShipmentInfo[];
  full: ShipmentInfo[];
  in_transit: ShipmentInfo[];
  delayed_unshipped: ShipmentInfo[];
  delayed_in_transit: ShipmentInfo[];
  summary: Summary;
}

const TYPE_CFG: Record<LogisticType, { color: string; label: string; icon: React.ReactNode }> = {
  correo: { color: "#FF9800", label: "CORREO", icon: <Truck className="w-3.5 h-3.5" /> },
  flex: { color: "#00E5FF", label: "FLEX", icon: <Truck className="w-3.5 h-3.5" /> },
  turbo: { color: "#A855F7", label: "TURBO", icon: <Zap className="w-3.5 h-3.5" /> },
  full: { color: "#FFE600", label: "FULL", icon: <span className="text-xs">⚡</span> },
};

const URGENCY_CFG: Record<UrgencyType, { label: string; color: string }> = {
  delayed: { label: "DEMORADO", color: "#ef4444" },
  today: { label: "HOY", color: "#FBBF24" },
  tomorrow: { label: "MAÑANA", color: "#22c55e" },
  week: { label: "ESTA SEMANA", color: "#6B7280" },
  upcoming: { label: "PRÓXIMO", color: "#4B5563" },
};

function SummaryCard({ type, count, active, onClick }: {
  type: LogisticType;
  count: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const cfg = TYPE_CFG[type];
  return (
    <button
      onClick={onClick}
      className="flex-1 min-w-0 rounded-2xl p-3 text-center transition-all"
      style={{
        background: active ? `${cfg.color}22` : "#1A1A1A",
        border: `1.5px solid ${active ? cfg.color : cfg.color + "30"}`,
      }}
    >
      <p className="text-xl font-black" style={{ color: cfg.color }}>{count}</p>
      <p className="text-[10px] font-black text-white mt-0.5 flex items-center justify-center gap-1">
        {cfg.icon}
        {cfg.label}
      </p>
    </button>
  );
}

function TypeBadge({ type }: { type: LogisticType }) {
  const cfg = TYPE_CFG[type];
  return (
    <span
      className="text-[9px] font-black px-1.5 py-0.5 rounded"
      style={{ background: cfg.color, color: "#121212" }}
    >
      {cfg.label}
    </span>
  );
}

function ShipmentCard({
  s,
  selected,
  onToggle,
  showCheckbox = true,
  showAsImprinted = false,
}: {
  s: ShipmentInfo;
  selected?: boolean;
  onToggle?: (id: number) => void;
  showCheckbox?: boolean;
  showAsImprinted?: boolean;
}) {
  const urg = URGENCY_CFG[s.urgency] ?? URGENCY_CFG["upcoming"];
  const borderColor =
    s.urgency && s.urgency !== "week" && s.urgency !== "upcoming"
      ? urg.color
      : "rgba(255,255,255,0.06)";

  const zone = calculateZoneDistance(s.delivery_date);

  const formattedDate = s.order_date
    ? new Date(s.order_date).toLocaleString("es-AR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const deliveryStr = s.delivery_date
    ? new Date(s.delivery_date).toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null;

  const thumb = (s.thumbnail || "").replace("http://", "https://");

  return (
    <div
      onClick={() => onToggle?.(s.shipment_id)}
      className={`rounded-2xl mb-2 overflow-hidden transition-all ${onToggle ? "cursor-pointer" : ""}`}
      style={{
        background: selected ? "rgba(255,230,0,0.05)" : "#1A1A1A",
        border: `1px solid ${selected ? "#FFE60050" : borderColor}`,
        opacity: showAsImprinted ? 0.6 : 1,
      }}
    >
      {/* Fila superior */}
      <div
        className="flex items-center gap-2 px-3 pt-2.5 pb-1.5 flex-wrap"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        {showCheckbox && onToggle && (
          <div
            className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all"
            style={{
              borderColor: selected ? "#FFE600" : "#374151",
              background: selected ? "#FFE600" : "transparent",
            }}
          >
            {selected && <CheckCircle2 className="w-3 h-3 text-black" />}
          </div>
        )}
        <span
          className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: "#FFE60020", color: "#FFE600" }}
        >
          {s.account}
        </span>
        {s.order_id && (
          <span className="text-[10px] font-bold flex-shrink-0" style={{ color: "#9CA3AF" }}>
            #{s.order_id}
          </span>
        )}
        {formattedDate && (
          <span className="text-[10px] flex-shrink-0" style={{ color: "#6B7280" }}>
            {formattedDate} hs
          </span>
        )}
        <TypeBadge type={s.type} />
        <ZoneIndicator zone={zone} />
        {s.urgency !== "week" && s.urgency !== "upcoming" && (
          <span
            className="text-[9px] font-black px-1.5 py-0.5 rounded"
            style={{
              background: urg.color + "22",
              color: urg.color,
              border: `1px solid ${urg.color}40`,
            }}
          >
            {urg.label}
          </span>
        )}
        <div className="ml-auto text-right flex-shrink-0">
          <p className="text-[10px] font-bold text-white leading-tight">{s.buyer}</p>
          {s.buyer_nickname && (
            <p className="text-[9px]" style={{ color: "#6B7280" }}>
              {s.buyer_nickname}
            </p>
          )}
        </div>
      </div>

      {/* Fila inferior - Producto con imagen GRANDE (100x100px) */}
      <div className="px-3 py-2">
        <div className="mb-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[11px] font-black text-white">{s.status_label ?? s.status}</p>
            {(s.substatus === "printed" || s.substatus === "label_printed") && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: "#39FF1420",
                  color: "#39FF14",
                  border: "1px solid #39FF1440",
                }}
              >
                ✓ Impresa
              </span>
            )}
          </div>
          {s.dispatch_date && (
            <p className="text-[10px] font-semibold" style={{ color: "#FF9800" }}>
              Despachar antes del{" "}
              {new Date(s.dispatch_date).toLocaleDateString("es-AR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          )}
          {deliveryStr && (
            <p className="text-[10px]" style={{ color: "#9CA3AF" }}>
              Llega el {deliveryStr}
            </p>
          )}
        </div>

        {/* Contenedor flex con imagen grande + info */}
        <div className="flex items-start gap-3">
          {/* IMAGEN 100x100px - Protagonista */}
          <div
            className="flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
            style={{
              width: "100px",
              height: "100px",
              background: "#2A2A2A",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {thumb ? (
              <Image
                src={thumb}
                alt={s.title}
                width={100}
                height={100}
                className="w-full h-full object-contain"
                unoptimized
              />
            ) : (
              <Package className="w-8 h-8" style={{ color: "#4B5563" }} />
            )}
          </div>

          {/* Info del producto */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <p className="text-xs text-white font-medium line-clamp-3 leading-tight">
              {s.title}
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
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

function TypeAccordion({
  type,
  items,
  selected,
  onToggle,
  onPrint,
  downloading,
  defaultOpen = true,
  readOnly = false,
}: {
  type: LogisticType;
  items: ShipmentInfo[];
  selected?: Set<number>;
  onToggle?: (id: number) => void;
  onPrint?: (fmt: "pdf" | "zpl", type: LogisticType) => void;
  downloading?: boolean;
  defaultOpen?: boolean;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!items.length) return null;

  const cfg = TYPE_CFG[type];
  const blockIds = items.map(s => s.shipment_id);
  const selIn = selected ? blockIds.filter(id => selected.has(id)) : [];
  const allSel = selIn.length === blockIds.length;

  const firstDispatch = items[0]?.dispatch_date;
  const dispatchDay = firstDispatch
    ? new Date(firstDispatch)
        .toLocaleDateString("es-AR", { weekday: "long" })
        .replace(/^\w/, c => c.toUpperCase())
    : null;

  const toggleAll = () => {
    if (!onToggle) return;
    allSel
      ? blockIds.forEach(onToggle)
      : blockIds.filter(id => !selected?.has(id)).forEach(onToggle);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden mb-3"
      style={{ background: "#161616", border: `1px solid ${cfg.color}25` }}
    >
      <button
        className="w-full px-4 py-3 flex items-center gap-2 text-left"
        style={{ borderBottom: open ? `1px solid ${cfg.color}20` : "none" }}
        onClick={() => setOpen(v => !v)}
      >
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        <span className="font-black text-sm" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
        {dispatchDay && (
          <span className="text-xs font-semibold" style={{ color: cfg.color + "bb" }}>
            | {dispatchDay}
          </span>
        )}
        <span className="flex-1" />
        <span
          className="text-xs font-black px-2 py-0.5 rounded-full mr-2"
          style={{ background: `${cfg.color}20`, color: cfg.color }}
        >
          {items.length}
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />
        ) : (
          <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />
        )}
      </button>
      {open && (
        <>
          {!readOnly && onToggle && (
            <div className="px-4 pt-2 pb-1 flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "#6B7280" }}>
                {selIn.length} de {items.length} seleccionados
              </span>
              <button
                onClick={toggleAll}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                style={{ background: `${cfg.color}15`, color: cfg.color }}
              >
                {allSel ? "Deseleccionar todas" : "Seleccionar todas"}
              </button>
            </div>
          )}
          <div className="px-2 pt-1">
            {items.map(s => (
              <ShipmentCard
                key={s.shipment_id}
                s={s}
                selected={selected?.has(s.shipment_id)}
                onToggle={readOnly ? undefined : onToggle}
                showCheckbox={!readOnly}
              />
            ))}
          </div>
          {!readOnly && onPrint && (
            <div className="px-3 pb-3 pt-2">
              <ShippingTypeButtons
                selectedByType={{
                  flex: selIn.filter(id => items.find(s => s.shipment_id === id)?.type === "flex").length,
                  correo: selIn.filter(id => items.find(s => s.shipment_id === id)?.type === "correo").length,
                  turbo: selIn.filter(id => items.find(s => s.shipment_id === id)?.type === "turbo").length,
                  full: 0,
                }}
                downloading={downloading ?? false}
                onPrint={(fmt, shipType) => {
                  const idsForType = selIn.filter(id =>
                    items.find(s => s.shipment_id === id)?.type === shipType
                  );
                  onPrint(fmt, shipType);
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EtiquetasInner() {
  const [data, setData] = useState<LabelData | null>(null);
  const [history, setHistory] = useState<ShipmentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHist, setLoadingHist] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>("pendientes");

  const [printStatus, setPrintStatus] = useState<string | null>(null);
  const printStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [agentStatus, setAgentStatus] = useState<"unchecked" | "available" | "unavailable">("unchecked");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meli-labels?action=list");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d: LabelData = await res.json();
      setData(d);

      // Pre-seleccionar urgentes (demorados + hoy)
      const urgent = (d.shipments ?? []).filter(s => s.urgency === "delayed" || s.urgency === "today");
      setSelected(new Set(urgent.map(s => s.shipment_id)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHist(true);
    try {
      const res = await fetch("/api/meli-labels?action=history&period=today");
      if (!res.ok) throw new Error();
      const d = await res.json();
      setHistory(d.shipments ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoadingHist(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (mainTab === "impresas") loadHistory();
  }, [mainTab, loadHistory]);

  useEffect(() => {
    isSpoolerAgentAvailable().then(ok => setAgentStatus(ok ? "available" : "unavailable"));
  }, []);

  const toggleItem = (id: number) =>
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const showStatus = useCallback((msg: string) => {
    setPrintStatus(msg);
    if (printStatusTimer.current) clearTimeout(printStatusTimer.current);
    printStatusTimer.current = setTimeout(() => setPrintStatus(null), 4000);
  }, []);

  const handlePrint = useCallback(
    async (format: "pdf" | "zpl", shipType: LogisticType) => {
      // Obtener IDs para este tipo de logística
      const idsForType = Array.from(selected).filter(id =>
        (data?.shipments ?? []).find(s => s.shipment_id === id && s.type === shipType)
      );

      if (!idsForType.length) return;
      setDownloading(true);

      try {
        const res = await fetch(
          `/api/meli-labels?action=download&format=${format}&ids=${idsForType.join(",")}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();

        if (format === "pdf") {
          const url = URL.createObjectURL(blob);
          const w = window.open(url, "_blank");
          if (w) w.print();
          URL.revokeObjectURL(url);
        } else {
          const shipments = (data?.shipments ?? []).filter(s => idsForType.includes(s.shipment_id));
          const tipo = shipments.length === 1 ? shipments[0].type : "multi";
          const idPart = idsForType.length === 1 ? String(idsForType[0]) : `${idsForType[0]}_y${idsForType.length - 1}mas`;
          const filename = `Etiqueta_${idPart}_${tipo}.zpl`;
          const zplText = await blob.text();
          let printed = false;

          try {
            const ok = agentStatus === "available" || (await isSpoolerAgentAvailable());
            if (ok) {
              setAgentStatus("available");
              if (idsForType.length > 1) await purgeAgentQueue().catch(() => {});
              await printZPLviaAgent(zplText);
              showStatus("✓ Impreso vía impresora directa");
              printed = true;
            }
          } catch {
            setAgentStatus("unavailable");
          }

          if (!printed) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            showStatus("⚠ Impresora no detectada — archivo descargado");
          }
        }

        // Marcar como impresas
        const printedShipments = (data?.shipments ?? []).filter(s =>
          idsForType.includes(s.shipment_id)
        );
        await fetch("/api/meli-labels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shipment_ids: idsForType,
            shipments: printedShipments.map(s => ({
              shipment_id: s.shipment_id,
              account: s.account,
              type: s.type,
              buyer: s.buyer,
              title: s.title,
              thumbnail: s.thumbnail,
              delivery_date: s.delivery_date,
              buyer_nickname: s.buyer_nickname,
            })),
          }),
        });

        // Mover automáticamente a "Impresas" y recargar
        setMainTab("impresas");
        load();
        loadHistory();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setDownloading(false);
      }
    },
    [selected, data, agentStatus, load, loadHistory, showStatus]
  );

  const all = data?.shipments ?? [];
  const fullItems = data?.full ?? [];
  const inTransit = data?.in_transit ?? [];
  const delayedU = data?.delayed_unshipped ?? [];
  const delayedT = data?.delayed_in_transit ?? [];
  const summary = data?.summary;

  const totalDemorados = delayedU.length + delayedT.length;

  // NUEVA LÓGICA: 4 pestañas
  const pendientes = all.filter(s => !s.printed_at);
  const impresas = history;
  const todas = all;
  const demoradas = all.filter(s => s.urgency === "delayed");

  const tabs: { id: MainTab; label: string; badge: number | null; badgeColor: string }[] = [
    { id: "pendientes", label: "Pendientes", badge: pendientes.length, badgeColor: "#FF9800" },
    { id: "impresas", label: "Impresas", badge: impresas.length, badgeColor: "#39FF14" },
    { id: "todas", label: "Todas", badge: all.length, badgeColor: "#00E5FF" },
    { id: "demoradas", label: "Demoradas", badge: demoradas.length > 0 ? demoradas.length : null, badgeColor: "#ef4444" },
    { id: "estadisticas", label: "Estadísticas", badge: null, badgeColor: "#FFE600" },
  ];

  return (
    <main className="min-h-screen pb-28" style={{ background: "#121212" }}>
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
            <p className="text-[10px]" style={{ color: "#6B7280" }}>Etiquetas inteligentes con zonas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)" }}
            title={agentStatus === "available" ? "Impresora conectada" : "Impresora no detectada"}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                agentStatus === "available"
                  ? "bg-green-400"
                  : agentStatus === "unchecked"
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-gray-600"
              }`}
            />
            <Printer
              className={`w-3.5 h-3.5 ${
                agentStatus === "available" ? "text-green-400" : "text-gray-500"
              }`}
            />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Print status toast */}
      {printStatus && (
        <div
          className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl px-4 py-3 text-sm font-bold text-center"
          style={{
            background: printStatus.startsWith("✓") ? "#39FF1420" : "#FF980020",
            border: `1px solid ${printStatus.startsWith("✓") ? "#39FF1440" : "#FF980040"}`,
            color: printStatus.startsWith("✓") ? "#39FF14" : "#FF9800",
          }}
        >
          {printStatus}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
        {loading && (
          <div className="rounded-2xl p-10 text-center" style={{ background: "#1A1A1A" }}>
            <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3" style={{ color: "#FFE600" }} />
            <p className="text-white font-bold">Consultando todas las cuentas...</p>
            <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
              Correo · Flex · Turbo · Full
            </p>
          </div>
        )}

        {error && !loading && (
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "#ef444418", border: "1px solid #ef444440" }}
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#ef4444" }} />
            <p className="text-sm text-white">{error}</p>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Resumen por tipo */}
            <div className="grid grid-cols-4 gap-2">
              {(["correo", "flex", "turbo", "full"] as LogisticType[]).map(t => (
                <SummaryCard
                  key={t}
                  type={t}
                  count={
                    t === "full"
                      ? summary?.full ?? 0
                      : summary?.[t as "correo" | "flex" | "turbo"] ?? 0
                  }
                  onClick={() => setMainTab("pendientes")}
                />
              ))}
            </div>

            {/* Alerta demorados */}
            {totalDemorados > 0 && mainTab !== "demoradas" && (
              <button
                onClick={() => setMainTab("demoradas")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
                style={{ background: "#ef444415", border: "1px solid #ef444440" }}
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#ef4444" }} />
                <div>
                  <p className="text-sm font-black" style={{ color: "#ef4444" }}>
                    {totalDemorados} envío{totalDemorados > 1 ? "s" : ""} demorado
                    {totalDemorados > 1 ? "s" : ""}
                  </p>
                  <p className="text-[10px]" style={{ color: "#9CA3AF" }}>
                    {delayedU.length} sin despachar · {delayedT.length} en tránsito retrasado
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: "#ef4444" }} />
              </button>
            )}

            {/* Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {tabs.map(tab => {
                const active = mainTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setMainTab(tab.id)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap"
                    style={
                      active
                        ? { background: "#FFE600", color: "#121212" }
                        : { background: "#1A1A1A", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.06)" }
                    }
                  >
                    {tab.label}
                    {tab.badge !== null && tab.badge > 0 && (
                      <span
                        className="text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                        style={
                          active
                            ? { background: "rgba(0,0,0,0.2)", color: "#121212" }
                            : { background: tab.badgeColor + "25", color: tab.badgeColor }
                        }
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* PESTAÑA: PENDIENTES */}
            {mainTab === "pendientes" && (
              <div className="space-y-3">
                {pendientes.length === 0 ? (
                  <div className="rounded-2xl p-10 text-center" style={{ background: "#1A1A1A" }}>
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: "#39FF14" }} />
                    <p className="text-white font-bold text-sm">Sin envíos pendientes</p>
                  </div>
                ) : (
                  (["correo", "flex", "turbo"] as LogisticType[]).map(t => (
                    <TypeAccordion
                      key={t}
                      type={t}
                      items={pendientes.filter(s => s.type === t)}
                      selected={selected}
                      onToggle={toggleItem}
                      onPrint={handlePrint}
                      downloading={downloading}
                      defaultOpen
                    />
                  ))
                )}
              </div>
            )}

            {/* PESTAÑA: IMPRESAS */}
            {mainTab === "impresas" && (
              <div className="space-y-3">
                {loadingHist ? (
                  <div className="rounded-2xl p-8 text-center" style={{ background: "#1A1A1A" }}>
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin" style={{ color: "#39FF14" }} />
                  </div>
                ) : impresas.length === 0 ? (
                  <div className="rounded-2xl p-10 text-center" style={{ background: "#1A1A1A" }}>
                    <Package className="w-8 h-8 mx-auto mb-2" style={{ color: "#6B7280" }} />
                    <p className="text-white font-bold text-sm">Sin etiquetas impresas hoy</p>
                  </div>
                ) : (
                  (["correo", "flex", "turbo"] as LogisticType[]).map(t => (
                    <TypeAccordion
                      key={t}
                      type={t}
                      items={impresas.filter(s => s.type === t)}
                      readOnly
                      defaultOpen={false}
                    />
                  ))
                )}
              </div>
            )}

            {/* PESTAÑA: TODAS */}
            {mainTab === "todas" && (
              <div className="space-y-3">
                {todas.length === 0 ? (
                  <div className="rounded-2xl p-10 text-center" style={{ background: "#1A1A1A" }}>
                    <Package className="w-8 h-8 mx-auto mb-2" style={{ color: "#6B7280" }} />
                    <p className="text-white font-bold text-sm">Sin envíos</p>
                  </div>
                ) : (
                  (["correo", "flex", "turbo"] as LogisticType[]).map(t => (
                    <TypeAccordion
                      key={t}
                      type={t}
                      items={todas.filter(s => s.type === t)}
                      selected={selected}
                      onToggle={toggleItem}
                      onPrint={handlePrint}
                      downloading={downloading}
                      defaultOpen={false}
                    />
                  ))
                )}
              </div>
            )}

            {/* PESTAÑA: DEMORADAS */}
            {mainTab === "demoradas" && (
              <div className="space-y-3">
                {demoradas.length === 0 ? (
                  <div className="rounded-2xl p-10 text-center" style={{ background: "#1A1A1A" }}>
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: "#39FF14" }} />
                    <p className="text-white font-bold text-sm">Sin envíos demorados</p>
                  </div>
                ) : (
                  (["correo", "flex", "turbo"] as LogisticType[]).map(t => (
                    <TypeAccordion
                      key={t}
                      type={t}
                      items={demoradas.filter(s => s.type === t)}
                      selected={selected}
                      onToggle={toggleItem}
                      onPrint={handlePrint}
                      downloading={downloading}
                      defaultOpen
                    />
                  ))
                )}
              </div>
            )}

            {/* PESTAÑA: ESTADÍSTICAS */}
            {mainTab === "estadisticas" && (
              <div className="space-y-4">
                <div
                  className="rounded-2xl p-4 flex items-center gap-2"
                  style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <BarChart3 className="w-4 h-4" style={{ color: "#FFE600" }} />
                  <span className="text-xs font-bold" style={{ color: "#FFE600" }}>
                    Estadísticas de zonas de entrega (hoy)
                  </span>
                </div>
                <StatsPanel accountId={data?.shipments?.[0]?.account ?? ""} />
              </div>
            )}
          </>
        )}

        {!loading && !data && !error && (
          <div className="rounded-2xl p-10 text-center" style={{ background: "#1A1A1A" }}>
            <Clock className="w-8 h-8 mx-auto mb-2" style={{ color: "#6B7280" }} />
            <p className="text-white font-bold text-sm">Sin datos</p>
          </div>
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
