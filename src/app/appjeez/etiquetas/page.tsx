"use client";
import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, RefreshCw, Printer, Download, CheckCircle2,
  Package, Truck, Zap, AlertCircle, ChevronDown, ChevronRight, Send,
} from "lucide-react";
import { calculateZoneDistance, ZONE_CFG } from "@/lib/zone-calc";
import { ZoneIndicator } from "@/components/ZoneIndicator";
import { supabase } from "@/lib/supabase";

type StatusTab = "pending" | "printed" | "in_transit" | "returns";
type LogisticType = "todas" | "flex" | "correo" | "turbo" | "full";
type TimeFilter = "all" | "today" | "upcoming";

interface ShipmentInfo {
  shipment_id: number;
  order_id: number | null;
  account: string;
  type: LogisticType;
  buyer: string;
  buyer_nickname: string | null;
  buyer_phone?: string | null;
  buyer_email?: string | null;
  title: string;
  quantity: number;
  thumbnail: string | null;
  delivery_date: string | null;
  dispatch_date: string | null;
  delivery_address?: string | null;
  delivery_state?: string | null;
  delivery_zip?: string | null;
  buyer_notes?: string | null;
  total_price?: number | null;
  shipping_cost?: number | null;
  coupon_code?: string | null;
  printed_at?: string | null;
  item_id: string | null;
  purchase_url?: string | null;
  seller_sku?: string | null;
  attributes?: string | null;
  urgency: "delayed" | "today" | "tomorrow" | "week" | "upcoming";
  status: string;
  status_label: string | null;
  meli_user_id: string;
  unit_price?: number | null;
}

interface LabelData {
  shipments: ShipmentInfo[];
  printed?: ShipmentInfo[];
  in_transit?: ShipmentInfo[];
  returns?: ShipmentInfo[];
  full?: ShipmentInfo[];
  summary: Record<string, number>;
}

const TYPE_CFG: Record<LogisticType, { color: string; label: string; icon: React.ReactNode }> = {
  todas: { color: "#FFE600", label: "TODAS", icon: <span className="text-xs">📦</span> },
  correo: { color: "#FF9800", label: "CORREO", icon: <Truck className="w-3.5 h-3.5" /> },
  flex: { color: "#00E5FF", label: "FLEX", icon: <Truck className="w-3.5 h-3.5" /> },
  turbo: { color: "#A855F7", label: "TURBO", icon: <Zap className="w-3.5 h-3.5" /> },
  full: { color: "#FFE600", label: "FULL", icon: <span className="text-xs">⚡</span> },
};

// Mapeo de cuentas a colores
const getAccountColor = (meli_user_id: string, accountName: string): { bg: string; text: string; border: string } => {
  const colors = [
    { bg: "#FF6B6B", text: "#fff", border: "#ff5252" },      // Rojo
    { bg: "#4ECDC4", text: "#121212", border: "#45b7a8" },    // Turquesa
    { bg: "#45B7D1", text: "#fff", border: "#3da5b8" },      // Azul
    { bg: "#FF9F43", text: "#121212", border: "#ff8c2a" },    // Naranja
    { bg: "#A29BFE", text: "#fff", border: "#8c84e8" },      // Violeta
    { bg: "#55EFC4", text: "#121212", border: "#3fd4a8" },    // Verde neon
    { bg: "#FD79A8", text: "#fff", border: "#e8608c" },      // Rosa
    { bg: "#FFEAA7", text: "#121212", border: "#e6d490" },    // Amarillo
  ];
  
  // Usar hash combinado de meli_user_id + nombre para mejor distribución
  const str = meli_user_id + accountName;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const colorIndex = Math.abs(hash) % colors.length;
  
  return colors[colorIndex];
};

function LabelCard({
  shipment,
  tabContext,
  onPrinted,
  isSelected,
  onToggleSelection,
}: {
  shipment: ShipmentInfo;
  tabContext: "pending" | "printed" | "in_transit" | "returns";
  onPrinted?: (id: number) => void;
  isSelected?: boolean;
  onToggleSelection?: (id: number) => void;
}) {
  const cfg = TYPE_CFG[shipment.type as LogisticType] || TYPE_CFG.correo;
  const zone = calculateZoneDistance(shipment.delivery_date);
  const zoneCfg = ZONE_CFG[zone];
  const thumb = (shipment.thumbnail || "").replace("http://", "https://");

  // Calcular si está demorada (dispatch_date pasó de las 00:00 del día)
  const isDelayed = (() => {
    if (!shipment.dispatch_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dispDate = new Date(shipment.dispatch_date);
    return dispDate < today;
  })();
  const delayDays = isDelayed && shipment.dispatch_date
    ? Math.floor((new Date().setHours(0,0,0,0) - new Date(shipment.dispatch_date).getTime()) / 86400000)
    : 0;

  return (
    <div
      className="rounded-2xl overflow-hidden mb-3 flex items-start gap-4 p-3 relative transition-all"
      style={{ 
        background: "#1A1A1A", 
        border: isDelayed ? "2px solid #EF4444" : isSelected ? "2px solid #39FF14" : "1px solid rgba(255,255,255,0.06)",
        boxShadow: isDelayed ? "0 0 12px rgba(239, 68, 68, 0.3)" : isSelected ? "0 0 12px rgba(57, 255, 20, 0.3)" : "none",
      }}
    >
      {/* Checkbox en esquina superior izquierda */}
      {(tabContext === "pending" || tabContext === "printed") && onToggleSelection && (
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

      {/* Info completa */}
      <div className="flex-1 min-w-0 flex flex-col justify-between pt-2 gap-2">
        {/* Encabezado + Badge de Cuenta */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: cfg.color, color: "#121212" }}>
                {cfg.label}
              </span>
              {/* Badge DEMORADA */}
              {isDelayed && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse"
                  style={{ background: "#EF4444", color: "#fff" }}>
                  DEMORADA {delayDays > 0 ? `${delayDays}d` : ""}
                </span>
              )}
              {/* Zona solo para Flex - prominente */}
              {shipment.type === "flex" && (
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full"
                  style={{
                    background: zoneCfg.bgColor,
                    color: zoneCfg.color,
                    border: `2px solid ${zoneCfg.color}`,
                  }}>
                  {zone === "cercana" && "📍 ZONA CERCANA"}
                  {zone === "media" && "📍 ZONA MEDIA"}
                  {zone === "larga" && "📍 ZONA LARGA"}
                  {zone === "desconocida" && "📍 ZONA ?"}
                </span>
              )}
              {shipment.printed_at && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: "#10B981", color: "#fff" }}>
                  Impresa
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-white line-clamp-2">
              {shipment.title}
              {shipment.attributes && (
                <span className="text-gray-400 text-[11px] font-normal"> • {shipment.attributes}</span>
              )}
            </p>
          </div>
          
          {/* Badge Cuenta en esquina derecha */}
          <div style={{
            background: getAccountColor(shipment.meli_user_id, shipment.account).bg,
            color: getAccountColor(shipment.meli_user_id, shipment.account).text,
            border: `1px solid ${getAccountColor(shipment.meli_user_id, shipment.account).border}`,
            padding: "0.25rem 0.5rem",
            borderRadius: "0.375rem",
            fontSize: "0.75rem",
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}>
            {shipment.account}
          </div>
        </div>

        {/* Comprador + Contacto */}
        <div className="text-[10px] space-y-1">
          <p style={{ color: "#D1D5DB" }}>
            <span style={{ color: "#9CA3AF" }}>👤</span> {shipment.buyer}{shipment.buyer_nickname ? ` (@${shipment.buyer_nickname})` : ""}
          </p>
          {(shipment.buyer_email || shipment.buyer_phone) && (
            <p style={{ color: "#D1D5DB" }}>
              {shipment.buyer_email && <span>📧 {shipment.buyer_email}</span>}
              {shipment.buyer_email && shipment.buyer_phone && <span> | </span>}
              {shipment.buyer_phone && <span>☎️ {shipment.buyer_phone}</span>}
            </p>
          )}
        </div>

        {/* Dirección */}
        {(shipment.delivery_address || shipment.delivery_state || shipment.delivery_zip) && (
          <div className="text-[10px] p-1.5 rounded" style={{ background: "rgba(255,255,255,0.05)" }}>
            <p style={{ color: "#9CA3AF" }} className="font-bold">📍 ENTREGA:</p>
            {shipment.delivery_address && <p style={{ color: "#D1D5DB" }}>{shipment.delivery_address}</p>}
            {(shipment.delivery_state || shipment.delivery_zip) && (
              <p style={{ color: "#D1D5DB" }}>
                {shipment.delivery_state}{shipment.delivery_state && shipment.delivery_zip ? `, ${shipment.delivery_zip}` : shipment.delivery_zip ? shipment.delivery_zip : ""}
              </p>
            )}
          </div>
        )}

        {/* Precios */}
        {(shipment.unit_price || shipment.total_price || shipment.shipping_cost) && (
          <div className="text-[10px] p-1.5 rounded" style={{ background: "rgba(255,255,255,0.05)" }}>
            <p style={{ color: "#9CA3AF" }} className="font-bold">💰 VALORES:</p>
            {shipment.unit_price && (
              <p style={{ color: "#D1D5DB" }}>Producto: ${shipment.unit_price?.toLocaleString("es-AR")} x{shipment.quantity} = ${(shipment.unit_price * shipment.quantity).toLocaleString("es-AR")}</p>
            )}
            {shipment.shipping_cost !== undefined && (
              <p style={{ color: "#D1D5DB" }}>Envío: ${shipment.shipping_cost?.toLocaleString("es-AR") ?? "0"}</p>
            )}
            {shipment.total_price && (
              <p style={{ color: "#39FF14", fontWeight: "bold" }}>Total: ${shipment.total_price?.toLocaleString("es-AR")}</p>
            )}
          </div>
        )}

        {/* Notas + Cupón */}
        <div className="text-[10px] space-y-1">
          {shipment.buyer_notes && (
            <p style={{ color: "#D1D5DB" }}>
              📝 <span style={{ color: "#9CA3AF" }}>Notas:</span> &quot;{shipment.buyer_notes}&quot;
            </p>
          )}
          {shipment.coupon_code && (
            <p style={{ color: "#D1D5DB" }}>
              🛒 <span style={{ color: "#9CA3AF" }}>Cupón:</span> {shipment.coupon_code}
            </p>
          )}
        </div>

        {/* Detalles: Unidades + SKU */}
        <div className="flex items-center gap-2 text-[10px] p-1.5 rounded"
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
          <p className="text-[10px]" style={{ color: "#FF9800" }}>
            📦 Despachar antes del {new Date(shipment.dispatch_date).toLocaleDateString("es-AR", { weekday: "long", day: "numeric" })}
          </p>
        )}
      </div>

      {/* Botones */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        {tabContext === "pending" && (
          <button
            onClick={() => onPrinted?.(shipment.shipment_id)}
            className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
            style={{ background: cfg.color, color: "#121212" }}
            title="Imprimir y marcar como impresa"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
        )}
        {tabContext === "printed" && (
          <button
            onClick={() => onPrinted?.(shipment.shipment_id)}
            className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all"
            style={{ background: "#10B981", color: "#fff" }}
            title="Re-imprimir etiqueta"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-imprimir</span>
          </button>
        )}
        {/* in_transit y returns no tienen botón de impresión */}
      </div>
    </div>
  );
}

function EtiquetasInner() {
  const [data, setData] = useState<LabelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<StatusTab>("pending");
  const [logisticFilter, setLogisticFilter] = useState<LogisticType>("todas");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [printing, setPrinting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [printMode, setPrintMode] = useState<'thermal' | 'pdf'>('thermal');
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tzOffset = -new Date().getTimezoneOffset() / 60;
      const res = await fetch(`/api/meli-labels?action=list&tz_offset=${tzOffset}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d: LabelData = await res.json();
      
      // No combinar arrays - la API ya separa correctamente pending/printed/in_transit/returns
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

  // Supabase Realtime: actualizar contadores cuando se añaden nuevas etiquetas impresas
  useEffect(() => {
    const channel = supabase
      .channel("printed-labels-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "printed_labels",
        },
        (payload: any) => {
          // Re-fetch para actualizar contadores en vivo
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  // Limpiar seleccion y resetear filtros al cambiar de pestana
  useEffect(() => {
    setSelectedIds(new Set());
    setLogisticFilter("todas");
    setTimeFilter("all");
  }, [statusTab]);


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

  // FASE 4: Verificación de Duplicados
  const checkForDuplicates = useCallback(() => {
    const shipmentIds = new Set<number>();
    const duplicates: number[] = [];
    
    (data?.shipments ?? []).forEach(s => {
      if (shipmentIds.has(s.shipment_id)) {
        duplicates.push(s.shipment_id);
      }
      shipmentIds.add(s.shipment_id);
    });
    
    if (duplicates.length > 0) {
      console.warn(`[DEBUG] Shipments duplicados encontrados: ${duplicates.join(", ")}`);
    }
    
    return duplicates.length === 0;
  }, [data?.shipments]);

  // Summary por Cuenta (usa arrays separados: shipments=pending, printed=impresas)
  const summaryByAccount = useMemo(() => {
    const map = new Map<string, { pending: number; printed: number; account_name: string; meli_user_id: string }>();
    
    // Pending viene en shipments
    (data?.shipments ?? []).forEach(s => {
      const key = s.account;
      if (!map.has(key)) {
        map.set(key, { pending: 0, printed: 0, account_name: s.account, meli_user_id: s.meli_user_id });
      }
      map.get(key)!.pending++;
    });
    
    // Impresas viene en printed
    (data?.printed ?? []).forEach(s => {
      const key = s.account;
      if (!map.has(key)) {
        map.set(key, { pending: 0, printed: 0, account_name: s.account, meli_user_id: s.meli_user_id });
      }
      map.get(key)!.printed++;
    });
    
    return map;
  }, [data?.shipments, data?.printed]);

  // Handler para imprimir etiqueta de prueba (sandbox)
  const handlePrintTest = async () => {
    setTestLoading(true);
    try {
      const res = await fetch("/api/meli-labels/test-print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create test label");
      }

      const result = await res.json();
      console.log("✅ Test label created:", result);
      alert(`🧪 Etiqueta de prueba creada exitosamente!\n\nShipment: ${result.test_data.shipment_id}\n\nRevisá el historial para buscarla.`);
      load(); // Refrescar para actualizar contadores
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      alert(`❌ Error en modo test: ${msg}`);
      console.error("Test print error:", e);
    } finally {
      setTestLoading(false);
    }
  };

  // Verificar duplicados al cargar
  useEffect(() => {
    if (data?.shipments) {
      checkForDuplicates();
    }
  }, [data?.shipments, checkForDuplicates]);

  // Filtrar datos según pestaña de estado y logística
  const filtered = useMemo(() => {
    let source: ShipmentInfo[] = [];

    // Seleccionar fuente según pestaña
    if (statusTab === "pending") {
      if (logisticFilter === "full") {
        source = data?.full ?? [];
      } else {
        source = data?.shipments ?? [];
      }
    } else if (statusTab === "printed") {
      source = data?.printed ?? [];
    } else if (statusTab === "in_transit") {
      source = data?.in_transit ?? [];
    } else if (statusTab === "returns") {
      source = data?.returns ?? [];
    }

    // Filtrar por tipo (excepto "todas" que muestra todo, y "full" que ya viene filtrado)
    if (logisticFilter !== "todas" && logisticFilter !== "full") {
      source = source.filter(s => s.type === logisticFilter);
    }

    // Filtrar por tiempo (solo para pendientes)
    // Regla: después de las 13:00, los envíos de "hoy" pasan a "próximos"
    if (statusTab === "pending" && timeFilter !== "all") {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const cutoffPassed = now.getHours() >= 13;
      if (timeFilter === "today") {
        source = source.filter(s => {
          if (!s.dispatch_date) return !cutoffPassed;
          const d = s.dispatch_date.split("T")[0];
          return cutoffPassed ? d < todayStr : d <= todayStr;
        });
      } else if (timeFilter === "upcoming") {
        source = source.filter(s => {
          if (!s.dispatch_date) return cutoffPassed;
          const d = s.dispatch_date.split("T")[0];
          return cutoffPassed ? d >= todayStr : d > todayStr;
        });
      }
    }

    return source;
  }, [data, statusTab, logisticFilter, timeFilter]);

  // Contar por tipo para cada estado
  const countByType = useCallback((type: LogisticType, status: StatusTab) => {
    let source: ShipmentInfo[] = [];
    if (status === "pending") source = data?.shipments ?? [];
    else if (status === "printed") source = data?.printed ?? [];
    else if (status === "in_transit") source = data?.in_transit ?? [];
    else if (status === "returns") source = data?.returns ?? [];

    if (type === "todas") return source.length;
    if (type === "full" && status === "pending") return (data?.full ?? []).length;
    return source.filter(s => s.type === type).length;
  }, [data]);

  // Conteo de envios hoy vs proximos (solo pendientes)
  // Regla: después de las 13:00 Argentina, los envíos de "hoy" pasan a "próximos"
  const timeCounts = useMemo(() => {
    const source = data?.shipments ?? [];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const cutoffPassed = now.getHours() >= 13; // Corte 13:00 - después ya no se despacha hoy
    const today = source.filter(s => {
      if (!s.dispatch_date) return !cutoffPassed;
      const d = s.dispatch_date.split("T")[0];
      return cutoffPassed ? d < todayStr : d <= todayStr;
    }).length;
    const upcoming = source.filter(s => {
      if (!s.dispatch_date) return cutoffPassed;
      const d = s.dispatch_date.split("T")[0];
      return cutoffPassed ? d >= todayStr : d > todayStr;
    }).length;
    return { today, upcoming };
  }, [data?.shipments]);

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

  const handlePrintAll = async (mode?: 'thermal' | 'pdf') => {
    if (selectedIds.size === 0) return;
    const actualMode = mode || printMode;
    setPrinting(true);
    try {
      // Buscar en el array correcto segun la pestana
      const sourceArray: ShipmentInfo[] = statusTab === "printed"
        ? (data?.printed ?? [])
        : [...(data?.shipments ?? []), ...(data?.full ?? []), ...(data?.printed ?? [])];
      const selectedShipments = sourceArray.filter(s => selectedIds.has(s.shipment_id));
      const meli_user_id = selectedShipments[0]?.meli_user_id || "";

      // PASO 1: Validar que los IDs seleccionados aún estén en estado ready_to_print
      const validateRes = await fetch("/api/meli-labels/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipment_ids: Array.from(selectedIds),
          meli_user_id,
        }),
      });

      if (!validateRes.ok) {
        throw new Error("Validation failed");
      }

      const { valid, already_printed } = (await validateRes.json()) as {
        valid: number[];
        already_printed: number[];
      };

      // Si hay ya impresas, avisar pero continuar con las válidas
      if (already_printed.length > 0) {
        const msg = `${already_printed.length} etiqueta(s) ya fueron impresa(s). Continuaré con las ${valid.length} restantes.`;
        if (!window.confirm(msg)) {
          setPrinting(false);
          return;
        }
      }

      if (valid.length === 0) {
        alert("Todas las etiquetas seleccionadas ya fueron impresas.");
        setPrinting(false);
        return;
      }

      // PASO 2: Generar PDF
      const ids = valid.join(",");
      const tzOffset = -new Date().getTimezoneOffset() / 60;
      const pdfRes = await fetch(`/api/meli-labels?ids=${ids}&tz_offset=${tzOffset}`);

      if (!pdfRes.ok) {
        throw new Error("Failed to generate PDF");
      }

      const pdfBlob = await pdfRes.blob();

      // PASO 3: Descargar PDF inmediatamente (mejor UX)
      if (actualMode === "pdf") {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `etiquetas-${new Date().toISOString().split("T")[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      // PASO 4: Convertir blob a base64 y guardar en historial (batch)
      // Usar Promesa para envolver FileReader (callback-based)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = (reader.result as string).split(",")[1];
          resolve(result);
        };
        reader.onerror = () => {
          reject(new Error("Failed to read PDF blob"));
        };
        reader.readAsDataURL(pdfBlob);
      });

      // Preparar metadata de los shipments válidos
      const shipmentsToSave = selectedShipments
        .filter(s => valid.includes(s.shipment_id))
        .map(s => ({
          shipment_id: s.shipment_id,
          order_id: s.order_id,
          tracking_number: (s as any).tracking_number || null,
          buyer_nickname: s.buyer_nickname || null,
          sku: s.seller_sku || null,
          variation: s.attributes || null,
          quantity: s.quantity,
          account_id: s.account,
          meli_user_id: s.meli_user_id,
          shipping_method: s.type,
        }));

      console.log("🔄 Saving print history...", { shipmentsToSave, baseLength: base64.length });

      // POST a save-print-batch
      const saveRes = await fetch("/api/meli-labels/save-print-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shipments: shipmentsToSave,
          pdf_base64: base64,
          tzOffset,
        }),
      });

      if (!saveRes.ok) {
        const errorData = await saveRes.json();
        console.error("❌ Save failed:", errorData);
        throw new Error(`Failed to save to history: ${errorData.error || "Unknown error"}`);
      }

      const saveData = await saveRes.json();
      console.log("✅ Saved successfully:", saveData);

      // PASO 5: Solo después de guardar exitosamente, marcar como impresas
      const markRes = await fetch("/api/meli-labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark-printed",
          shipment_ids: valid,
          shipments: shipmentsToSave.map(s => ({
            shipment_id: s.shipment_id,
            account: s.account_id,
            type: s.shipping_method,
            buyer: "", // No usado en este contexto
            title: "",
            thumbnail: "",
            delivery_date: "",
            buyer_nickname: s.buyer_nickname,
          })),
        }),
      });

      if (!markRes.ok) {
        console.warn("⚠️ Failed to mark as printed, but PDF was saved");
      }

      // Actualizar estado local
      setSelectedIds(new Set());
      alert(`✅ ${valid.length} etiqueta(s) impresa(s) y guardada(s) en historial`);
      load(); // Re-fetch para actualizar contadores
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      alert(`❌ Error: ${msg}`);
      console.error("Print error:", e);
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
            {/* Summary por Cuenta */}
            {data && summaryByAccount.size > 0 && (
              <p className="text-[10px] text-gray-400 mt-1">
                Total {(data.shipments?.length ?? 0) + (data.printed?.length ?? 0)} etiquetas:&nbsp;
                {Array.from(summaryByAccount.entries()).map(([account, stats], idx) => (
                  <span key={account}>
                    {idx > 0 ? " | " : ""}
                    <span style={{ color: getAccountColor(stats.meli_user_id, stats.account_name).text }}>
                      {stats.account_name}
                    </span>
                    {" "}({stats.pending}P + {stats.printed}I)
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Badge Modo Test */}
          {testMode && (
            <span
              className="px-3 py-2 rounded-lg text-xs font-bold animate-pulse"
              style={{
                background: "rgba(57,255,20,0.2)",
                color: "#39FF14",
                border: "1px solid rgba(57,255,20,0.5)",
              }}
            >
              🧪 MODO PRUEBA
            </span>
          )}
          <Link
            href="/appjeez/historial-etiquetas"
            className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: testMode ? "rgba(255,255,255,0.05)" : "rgba(57,255,20,0.1)",
              color: testMode ? "#9CA3AF" : "#39FF14",
              border: testMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(57,255,20,0.3)",
            }}
          >
            📋 Historial
          </Link>
          {/* Botón Modo Test */}
          <button
            onClick={handlePrintTest}
            disabled={testLoading}
            className="px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
            style={{
              background: testMode ? "#39FF14" : "rgba(57,255,20,0.1)",
              color: testMode ? "#121212" : "#39FF14",
              border: "1px solid rgba(57,255,20,0.3)",
              opacity: testLoading ? 0.6 : 1,
            }}
            title="Generar etiqueta de prueba (sandbox)"
          >
            {testLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                🧪 Test
              </>
            )}
          </button>
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
            {/* Pestañas de Estado */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {(["pending", "printed", "in_transit", "returns"] as StatusTab[]).map(tab => {
                const counts = {
                  pending:    (data?.shipments ?? []).length,
                  printed:    (data?.printed ?? []).length,
                  in_transit: (data?.in_transit ?? []).length,
                  returns:    (data?.returns ?? []).length,
                };
                const isActive = statusTab === tab;
                const tabLabels: Record<StatusTab, string> = {
                  pending: "📥 Pendientes",
                  printed: "✅ Impresas",
                  in_transit: "🚚 En Tránsito",
                  returns: "↩️ Devoluciones",
                };
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
                    {tabLabels[tab]}
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

            {/* Filtros Logísticos + Filtro de Tiempo */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-1 px-1">
              {/* Botón TODAS */}
              <button
                onClick={() => { setLogisticFilter("todas"); setTimeFilter("all"); }}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap"
                style={
                  logisticFilter === "todas" && timeFilter === "all"
                    ? { background: "#FFE600", color: "#121212", border: "2px solid #FFE600" }
                    : { background: "transparent", color: "#9CA3AF", border: "2px solid #9CA3AF40" }
                }
              >
                <span className="text-xs">📦</span>
                TODAS
                <span className="text-[9px] font-black px-1">{countByType("todas", statusTab)}</span>
              </button>

              {/* Botones HOY / PROXIMOS (solo en Pendientes, justo al lado de TODAS) */}
              {statusTab === "pending" && (
                <>
                  <button
                    onClick={() => { setTimeFilter(timeFilter === "today" ? "all" : "today"); setLogisticFilter("todas"); }}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap"
                    style={
                      timeFilter === "today"
                        ? { background: "#FF6B6B", color: "#fff", border: "2px solid #FF6B6B" }
                        : { background: "transparent", color: "#FF6B6B", border: "2px solid #FF6B6B40" }
                    }
                  >
                    HOY
                    <span className="text-[9px] font-black px-1">{timeCounts.today}</span>
                  </button>
                  <button
                    onClick={() => { setTimeFilter(timeFilter === "upcoming" ? "all" : "upcoming"); setLogisticFilter("todas"); }}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap"
                    style={
                      timeFilter === "upcoming"
                        ? { background: "#FFE600", color: "#121212", border: "2px solid #FFE600" }
                        : { background: "transparent", color: "#FFE600", border: "2px solid #FFE60040" }
                    }
                  >
                    PROXIMOS
                    <span className="text-[9px] font-black px-1">{timeCounts.upcoming}</span>
                  </button>
                </>
              )}

              {/* Separador */}
              <div className="w-px h-8 self-center" style={{ background: "rgba(255,255,255,0.15)" }} />

              {/* Filtros por tipo logístico */}
              {(["flex", "correo", "turbo", "full"] as LogisticType[]).map(type => {
                const cfg = TYPE_CFG[type];
                const count = countByType(type, statusTab);
                const isActive = logisticFilter === type;
                return (
                  <button
                    key={type}
                    onClick={() => { setLogisticFilter(type); setTimeFilter("all"); }}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap"
                    style={
                      isActive
                        ? { background: cfg.color, color: "#121212", border: `2px solid ${cfg.color}` }
                        : { background: "transparent", color: cfg.color, border: `2px solid ${cfg.color}40` }
                    }
                  >
                    {cfg.icon}
                    {cfg.label}
                    <span className="text-[9px] font-black px-1">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Barra de Acciones: Marcar Todas + Imprimir (solo en tabs imprimibles) */}
            {(statusTab === "pending" || statusTab === "printed") && filtered.length > 0 && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => selectAll(filtered.map(s => s.shipment_id))}
                  className="px-3 py-2 rounded-lg transition-all text-xs font-bold flex items-center gap-2"
                  style={{
                    background: filtered.every(s => selectedIds.has(s.shipment_id)) ? "#39FF14" : "rgba(255,255,255,0.05)",
                    color: filtered.every(s => selectedIds.has(s.shipment_id)) ? "#121212" : "#fff",
                  }}
                  title={filtered.every(s => selectedIds.has(s.shipment_id)) ? "Deseleccionar todas" : "Seleccionar todas"}
                >
                  <div className="w-4 h-4 rounded border-2 flex items-center justify-center" style={{
                    borderColor: filtered.every(s => selectedIds.has(s.shipment_id)) ? "#121212" : "rgba(255,255,255,0.5)",
                    background: filtered.every(s => selectedIds.has(s.shipment_id)) ? "#121212" : "transparent",
                  }}>
                    {filtered.every(s => selectedIds.has(s.shipment_id)) && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                  {filtered.every(s => selectedIds.has(s.shipment_id)) ? "Desmarcar Todas" : "Marcar Todas"}
                </button>

                {/* Dropdown Imprimir */}
                <div className="relative">
                  <button
                    onClick={() => setShowPrintMenu(!showPrintMenu)}
                    disabled={printing || selectedIds.size === 0}
                    className="px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                    style={{
                      background: statusTab === "printed" ? "#10B981" : (selectedIds.size > 0 ? "#39FF14" : "#6B7280"),
                      color: "#121212",
                      opacity: (printing || selectedIds.size === 0) ? 0.6 : 1,
                      cursor: (printing || selectedIds.size === 0) ? "not-allowed" : "pointer",
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
                        {statusTab === "printed" ? "Re-imprimir" : "Imprimir"} ({selectedIds.size}) ▼
                      </>
                    )}
                  </button>

                  {/* Menu Dropdown */}
                  {showPrintMenu && !printing && (
                    <div className="absolute top-full mt-1 right-0 bg-gray-900 rounded-lg shadow-lg border border-gray-700 z-50"
                      style={{ minWidth: "200px" }}>
                      <button
                        onClick={() => {
                          setPrintMode('thermal');
                          handlePrintAll('thermal');
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-800 text-xs font-bold text-white flex items-center gap-2 rounded-t-lg transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        🖨️ {statusTab === "printed" ? "Re-imprimir" : "Imprimir"} Térmica
                      </button>
                      <div style={{ height: "1px", background: "rgba(255,255,255,0.1)" }}></div>
                      <button
                        onClick={() => {
                          setPrintMode('pdf');
                          handlePrintAll('pdf');
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-800 text-xs font-bold text-white flex items-center gap-2 rounded-b-lg transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        📄 {statusTab === "printed" ? "Re-descargar" : "Descargar"} PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Botón Imprimir Seleccionadas (versión antigua - removida) */}

            {/* Lista de Etiquetas */}
            {filtered.length === 0 ? (
              <div
                className="rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-2"
                style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <CheckCircle2 className="w-8 h-8" style={{ color: "#39FF14" }} />
                <p className="text-white font-bold">Sin etiquetas en este filtro</p>
                <p className="text-xs" style={{ color: "#6B7280" }}>
                  {statusTab === "pending" && "Todas las pendientes estan impresas"}
                  {statusTab === "printed" && "No hay etiquetas impresas todavia"}
                  {statusTab === "in_transit" && "No hay envios en transito"}
                  {statusTab === "returns" && "No hay devoluciones"}
                </p>
              </div>
            ) : statusTab === "pending" ? (() => {
              // Agrupar pendientes: DEMORADAS → HOY → PRÓXIMOS
              // Regla: después de las 13:00, envíos de hoy pasan a "próximos"
              const now = new Date();
              const localYear = now.getFullYear();
              const localMonth = String(now.getMonth() + 1).padStart(2, "0");
              const localDay = String(now.getDate()).padStart(2, "0");
              const todayStr = `${localYear}-${localMonth}-${localDay}`;
              const cutoffPassed = now.getHours() >= 13;

              // Demoradas: dispatch_date estrictamente antes de hoy (a las 00:00 ya son demoradas)
              const delayedShipments = filtered.filter(s => {
                if (!s.dispatch_date) return false;
                const d = s.dispatch_date.split("T")[0];
                return d < todayStr;
              });

              // Hoy: dispatch_date = hoy (solo antes del corte de las 13:00)
              const todayShipments = filtered.filter(s => {
                if (!s.dispatch_date) return !cutoffPassed;
                const d = s.dispatch_date.split("T")[0];
                if (d < todayStr) return false; // son demoradas
                return cutoffPassed ? false : d === todayStr;
              });

              // Próximos: dispatch_date > hoy, o = hoy después de las 13:00
              const futureShipments = filtered.filter(s => {
                if (!s.dispatch_date) return cutoffPassed;
                const d = s.dispatch_date.split("T")[0];
                if (d < todayStr) return false; // son demoradas
                return cutoffPassed ? d >= todayStr : d > todayStr;
              });

              // Agrupar futuros por fecha
              const futureByDate = new Map<string, ShipmentInfo[]>();
              futureShipments.forEach(s => {
                const d = (s.dispatch_date || "").split("T")[0];
                if (!futureByDate.has(d)) futureByDate.set(d, []);
                futureByDate.get(d)!.push(s);
              });
              const sortedDates = Array.from(futureByDate.keys()).sort();

              const formatDate = (dateStr: string) => {
                const date = new Date(dateStr + "T12:00:00");
                const dias = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
                const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                return `${dias[date.getDay()]} ${date.getDate()} ${meses[date.getMonth()]}`;
              };

              return (
                <div className="space-y-4">
                  {/* Demoradas - envios con dispatch_date pasada */}
                  {delayedShipments.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="text-xs font-black px-3 py-1 rounded-full animate-pulse"
                          style={{ background: "#EF4444", color: "#fff" }}>
                          DEMORADAS
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: "#EF4444" }}>
                          {delayedShipments.length} {delayedShipments.length === 1 ? "envio demorado" : "envios demorados"} - Afecta reputacion
                        </span>
                      </div>
                      <div className="space-y-2">
                        {delayedShipments.map(shipment => (
                          <LabelCard
                            key={shipment.shipment_id}
                            shipment={shipment}
                            tabContext={statusTab}
                            onPrinted={handlePrinted}
                            isSelected={selectedIds.has(shipment.shipment_id)}
                            onToggleSelection={toggleSelection}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Envios de Hoy */}
                  {todayShipments.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="text-xs font-black px-3 py-1 rounded-full"
                          style={{ background: "#FF6B6B", color: "#fff" }}>
                          ENVIOS DE HOY
                        </span>
                        <span className="text-[10px] font-bold" style={{ color: "#9CA3AF" }}>
                          {todayShipments.length} {todayShipments.length === 1 ? "envio" : "envios"}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {todayShipments.map(shipment => (
                          <LabelCard
                            key={shipment.shipment_id}
                            shipment={shipment}
                            tabContext={statusTab}
                            onPrinted={handlePrinted}
                            isSelected={selectedIds.has(shipment.shipment_id)}
                            onToggleSelection={toggleSelection}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Proximos Envios (agrupados por fecha) */}
                  {sortedDates.length > 0 && (
                    <div className="flex items-center gap-2 mt-4 mb-1 px-1">
                      <span className="text-xs font-black px-3 py-1 rounded-full"
                        style={{ background: "#FFE600", color: "#121212" }}>
                        PROXIMOS ENVIOS
                      </span>
                      <span className="text-[10px] font-bold" style={{ color: "#9CA3AF" }}>
                        {futureShipments.length} {futureShipments.length === 1 ? "envio" : "envios"}
                      </span>
                    </div>
                  )}
                  {sortedDates.map(dateStr => {
                    const items = futureByDate.get(dateStr)!;
                    return (
                      <div key={dateStr}>
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <span className="text-xs font-black px-3 py-1 rounded-full"
                            style={{ background: "#FFE600", color: "#121212" }}>
                            DESPACHAR: {formatDate(dateStr)}
                          </span>
                          <span className="text-[10px] font-bold" style={{ color: "#9CA3AF" }}>
                            {items.length} {items.length === 1 ? "envio" : "envios"}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {items.map(shipment => (
                            <LabelCard
                              key={shipment.shipment_id}
                              shipment={shipment}
                              tabContext={statusTab}
                              onPrinted={handlePrinted}
                              isSelected={selectedIds.has(shipment.shipment_id)}
                              onToggleSelection={toggleSelection}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })() : (
              <div className="space-y-2">
                {filtered.map(shipment => (
                  <LabelCard
                    key={shipment.shipment_id}
                    shipment={shipment}
                    tabContext={statusTab}
                    onPrinted={statusTab === "printed" ? handlePrinted : undefined}
                    isSelected={selectedIds.has(shipment.shipment_id)}
                    onToggleSelection={statusTab === "printed" ? toggleSelection : undefined}
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
