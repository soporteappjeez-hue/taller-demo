"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, ShoppingCart, BarChart2, List,
  TrendingUp, Package, CreditCard, ChevronDown,
  CheckCircle, XCircle, AlertTriangle, Calendar,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { ventasDb } from "@/lib/db";
import { generateId } from "@/lib/utils";
import {
  VentaRepuesto, VentaItem, MetodoPago, VentasStats,
  VentasPorDia, TopProducto, METODO_PAGO_LABELS, METODO_PAGO_ICONS,
} from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ─── Helpers ─────────────────────────────────────────────────

const fmt = (n: number) =>
  "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function todayStr() { return new Date().toISOString().slice(0, 10); }
function weekRange(): [string, string] {
  const d = new Date();
  const day = d.getDay() || 7;
  const mon = new Date(d); mon.setDate(d.getDate() - day + 1);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}
function monthRange(): [string, string] {
  const d = new Date();
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const to = last.toISOString().slice(0, 10);
  return [from, to];
}

const METODO_COLORS: Record<MetodoPago, string> = {
  efectivo:      "#39FF14",
  transferencia: "#00E5FF",
  debito:        "#FDB71A",
  credito:       "#FF5722",
  mercado_pago:  "#2563EB",
};

// ─── Componente: Fila de ítem ─────────────────────────────────

function ItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: VentaItem;
  onChange: (id: string, field: keyof VentaItem, value: string | number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <div className="col-span-5">
        <input
          className="input input-sm"
          placeholder="Producto / descripción"
          value={item.producto}
          onChange={e => onChange(item.id, "producto", e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <input
          className="input input-sm"
          placeholder="SKU"
          value={item.sku}
          onChange={e => onChange(item.id, "sku", e.target.value)}
        />
      </div>
      <div className="col-span-2">
        <input
          type="number"
          min={1}
          className="input input-sm"
          placeholder="Cant."
          value={item.cantidad}
          onChange={e => onChange(item.id, "cantidad", Math.max(1, parseInt(e.target.value) || 1))}
        />
      </div>
      <div className="col-span-2">
        <input
          type="number"
          min={0}
          className="input input-sm"
          placeholder="$Precio"
          value={item.precioUnit || ""}
          onChange={e => onChange(item.id, "precioUnit", parseFloat(e.target.value) || 0)}
        />
      </div>
      <div className="col-span-1 flex justify-end">
        <button
          onClick={() => onRemove(item.id)}
          className="p-2 rounded-lg text-red-400 hover:bg-red-500/15 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Componente: Tarjeta de venta del día ─────────────────────

function VentaCard({ venta, onCancelar }: { venta: VentaRepuesto; onCancelar: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const hora = new Date(venta.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const cancelada = venta.status === "cancelada";

  return (
    <div className={`card border ${cancelada ? "border-red-500/30 opacity-60" : "border-white/10"}`}>
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-mono">{hora}</span>
            <span className="text-sm font-semibold text-gray-200 truncate">
              {venta.items.length === 1
                ? venta.items[0].producto
                : `${venta.items.length} productos`}
            </span>
            {cancelada && (
              <span className="text-xs font-bold text-red-400 bg-red-500/15 px-2 py-0.5 rounded-full">
                ANULADA
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-xs px-2 py-0.5 rounded-full border font-bold"
              style={{
                borderColor: METODO_COLORS[venta.metodoPago] + "80",
                color: METODO_COLORS[venta.metodoPago],
                background: METODO_COLORS[venta.metodoPago] + "15",
              }}
            >
              {METODO_PAGO_ICONS[venta.metodoPago]} {METODO_PAGO_LABELS[venta.metodoPago]}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-lg font-black ${cancelada ? "line-through text-gray-500" : "text-[#39FF14]"}`}
            style={cancelada ? {} : { textShadow: "0 0 8px rgba(57,255,20,0.5)" }}>
            {fmt(venta.total)}
          </p>
          <ChevronDown className={`w-4 h-4 text-gray-500 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
          {venta.items.map(i => (
            <div key={i.id} className="flex justify-between text-sm text-gray-400">
              <span className="truncate flex-1">{i.cantidad}x {i.producto} {i.sku && <span className="text-gray-600">({i.sku})</span>}</span>
              <span className="text-gray-300 font-semibold ml-2">{fmt(i.subtotal)}</span>
            </div>
          ))}
          {venta.notas && (
            <p className="text-xs text-gray-500 italic mt-1">&ldquo;{venta.notas}&rdquo;</p>
          )}
          {!cancelada && (
            <button
              onClick={() => {
                if (confirm("¿Anular esta venta? Esta acción no se puede deshacer.")) {
                  onCancelar(venta.id);
                }
              }}
              className="mt-2 flex items-center gap-2 text-xs text-red-400 hover:text-red-300 font-semibold"
            >
              <XCircle className="w-4 h-4" /> Anular Venta
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Componente: Mini métrica ─────────────────────────────────

function MetricCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="card border border-white/10">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black mt-1" style={{ color, textShadow: `0 0 10px ${color}70` }}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────

type Tab = "nueva" | "movimientos" | "estadisticas";
type RangoStats = "hoy" | "semana" | "mes" | "custom";

function newItem(): VentaItem {
  return { id: generateId(), ventaId: "", producto: "", sku: "", cantidad: 1, precioUnit: 0, subtotal: 0 };
}

export default function VentasPage() {
  const [tab, setTab] = useState<Tab>("nueva");

  // ── Nueva Venta
  const [items, setItems] = useState<VentaItem[]>([newItem()]);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [vendedor, setVendedor] = useState("Maqjeez");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Movimientos del día
  const [ventasHoy, setVentasHoy] = useState<VentaRepuesto[]>([]);
  const [loadingHoy, setLoadingHoy] = useState(false);

  // ── Estadísticas
  const [rango, setRango] = useState<RangoStats>("hoy");
  const [customDesde, setCustomDesde] = useState(todayStr());
  const [customHasta, setCustomHasta] = useState(todayStr());
  const [stats, setStats] = useState<VentasStats | null>(null);
  const [chartData, setChartData] = useState<VentasPorDia[]>([]);
  const [topProd, setTopProd] = useState<TopProducto[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Cálculos en tiempo real
  const itemsCalc = items.map(i => ({ ...i, subtotal: i.cantidad * i.precioUnit }));
  const total = itemsCalc.reduce((s, i) => s + i.subtotal, 0);

  const handleItemChange = (id: string, field: keyof VentaItem, value: string | number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleAddItem = () => setItems(prev => [...prev, newItem()]);
  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleGuardarVenta = async () => {
    const valid = itemsCalc.filter(i => i.producto.trim() && i.precioUnit > 0);
    if (valid.length === 0) { showToast("Agregá al menos un producto con precio", false); return; }
    setSaving(true);
    try {
      const venta: VentaRepuesto = {
        id:         generateId(),
        vendedor:   vendedor.trim() || "Maqjeez",
        metodoPago,
        total:      valid.reduce((s, i) => s + i.subtotal, 0),
        status:     "activa",
        notas,
        createdAt:  new Date().toISOString(),
        items:      valid.map(i => ({ ...i, ventaId: "" })),
      };
      await ventasDb.create(venta);
      setItems([newItem()]);
      setMetodoPago("efectivo");
      setNotas("");
      showToast(`Venta guardada: ${fmt(venta.total)}`);
      loadVentasHoy();
    } catch (e) {
      showToast("Error al guardar: " + String(e), false);
    } finally {
      setSaving(false);
    }
  };

  const loadVentasHoy = useCallback(async () => {
    setLoadingHoy(true);
    try { setVentasHoy(await ventasDb.getToday()); }
    catch { /* no-op */ }
    finally { setLoadingHoy(false); }
  }, []);

  const handleCancelar = async (id: string) => {
    await ventasDb.cancelar(id);
    loadVentasHoy();
  };

  // Rango de stats
  function getRango(): [string, string] {
    if (rango === "hoy")    return [todayStr(), todayStr()];
    if (rango === "semana") return weekRange();
    if (rango === "mes")    return monthRange();
    return [customDesde, customHasta];
  }

  const loadStats = useCallback(async () => {
    const [d, h] = getRango();
    setLoadingStats(true);
    try {
      const [s, chart, top] = await Promise.all([
        ventasDb.getStats(d, h),
        ventasDb.getVentasPorDia(d, h),
        ventasDb.getTopProductos(d, h),
      ]);
      setStats(s);
      setChartData(chart);
      setTopProd(top);
    } catch { /* no-op */ }
    finally { setLoadingStats(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rango, customDesde, customHasta]);

  useEffect(() => { loadVentasHoy(); }, [loadVentasHoy]);
  useEffect(() => { if (tab === "estadisticas") loadStats(); }, [tab, loadStats]);

  const ventasActivas = ventasHoy.filter(v => v.status === "activa");
  const totalHoy = ventasActivas.reduce((s, v) => s + v.total, 0);
  const [rangeDesde, rangeHasta] = getRango();
  const rangeLabel = rango === "hoy" ? "hoy" : rango === "semana" ? "esta semana" : rango === "mes" ? "este mes" : `${rangeDesde} → ${rangeHasta}`;

  const chartFormatted = chartData.map(d => ({
    name: new Date(d.dia + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric" }),
    total: d.total,
    cant: d.cant,
  }));

  return (
    <>
      <Navbar />

      {/* ── Tabs ── */}
      <div className="sticky top-14 z-30 border-b border-white/10"
        style={{ background: "rgba(18,18,18,0.95)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-3xl mx-auto px-4 flex">
          {([
            { id: "nueva",         label: "Nueva Venta",   icon: ShoppingCart },
            { id: "movimientos",   label: "Movimientos",   icon: List },
            { id: "estadisticas",  label: "Estadísticas",  icon: BarChart2 },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); if (id === "movimientos") loadVentasHoy(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold border-b-2 transition-colors
                ${tab === id
                  ? "border-[#FDB71A] text-[#FDB71A]"
                  : "border-transparent text-gray-500 hover:text-gray-300"}`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 sm:pb-6 space-y-6">

        {/* ══════════════════ NUEVA VENTA ══════════════════ */}
        {tab === "nueva" && (
          <div className="space-y-4">
            <div className="card border border-white/10">
              <h2 className="text-base font-bold text-gray-200 mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-[#FDB71A]" />
                Detalle de productos
              </h2>

              {/* Header de columnas */}
              <div className="grid grid-cols-12 gap-2 mb-2 px-1">
                <p className="col-span-5 text-xs text-gray-600 font-semibold">PRODUCTO</p>
                <p className="col-span-2 text-xs text-gray-600 font-semibold">SKU</p>
                <p className="col-span-2 text-xs text-gray-600 font-semibold">CANT.</p>
                <p className="col-span-2 text-xs text-gray-600 font-semibold">PRECIO</p>
                <p className="col-span-1" />
              </div>

              <div className="space-y-2">
                {itemsCalc.map(item => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onChange={handleItemChange}
                    onRemove={handleRemoveItem}
                  />
                ))}
              </div>

              <button
                onClick={handleAddItem}
                className="mt-3 flex items-center gap-2 text-sm text-[#00E5FF] hover:text-white font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar producto
              </button>
            </div>

            {/* Método de pago + vendedor */}
            <div className="card border border-white/10 space-y-4">
              <div>
                <label className="label">Forma de Pago</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1">
                  {(Object.keys(METODO_PAGO_LABELS) as MetodoPago[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setMetodoPago(m)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center
                        ${metodoPago === m
                          ? "text-white"
                          : "border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300"}`}
                      style={metodoPago === m ? {
                        borderColor: METODO_COLORS[m],
                        background: METODO_COLORS[m] + "20",
                        color: METODO_COLORS[m],
                        boxShadow: `0 0 10px ${METODO_COLORS[m]}40`,
                      } : {}}
                    >
                      <span className="block text-base">{METODO_PAGO_ICONS[m]}</span>
                      {METODO_PAGO_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Vendedor</label>
                  <input className="input" value={vendedor} onChange={e => setVendedor(e.target.value)} placeholder="Nombre del vendedor" />
                </div>
                <div>
                  <label className="label">Notas (opcional)</label>
                  <input className="input" value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: cliente frecuente" />
                </div>
              </div>
            </div>

            {/* Total + Guardar */}
            <div className="card border border-[#39FF14]/40"
              style={{ background: "rgba(57,255,20,0.05)", boxShadow: "0 0 20px rgba(57,255,20,0.10)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">Total de la venta</p>
                  <p className="text-4xl font-black text-[#39FF14]"
                    style={{ textShadow: "0 0 12px rgba(57,255,20,0.60)" }}>
                    {fmt(total)}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {itemsCalc.filter(i => i.producto).length} producto(s) · {METODO_PAGO_LABELS[metodoPago]}
                  </p>
                </div>
                <button
                  onClick={handleGuardarVenta}
                  disabled={saving || total === 0}
                  className="btn-primary px-8 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  {saving ? "Guardando..." : "Confirmar Venta"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ MOVIMIENTOS ══════════════════ */}
        {tab === "movimientos" && (
          <div className="space-y-4">
            {/* Resumen del día */}
            <div className="card border border-[#FDB71A]/30"
              style={{ background: "rgba(253,183,26,0.05)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Hoy — {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  <p className="text-3xl font-black text-[#FDB71A] mt-1"
                    style={{ textShadow: "0 0 10px rgba(253,183,26,0.50)" }}>
                    {fmt(totalHoy)}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {ventasActivas.length} venta{ventasActivas.length !== 1 ? "s" : ""} activa{ventasActivas.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button onClick={loadVentasHoy} className="btn-secondary btn-sm">
                  Actualizar
                </button>
              </div>
            </div>

            {loadingHoy ? (
              <div className="card flex items-center justify-center py-12">
                <span className="w-8 h-8 border-4 border-[#FDB71A] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ventasHoy.length === 0 ? (
              <div className="card flex flex-col items-center py-14 text-center">
                <ShoppingCart className="w-10 h-10 text-gray-700 mb-3" />
                <p className="text-gray-400 font-semibold">No hay ventas registradas hoy</p>
                <p className="text-gray-600 text-sm mt-1">Las ventas que registres aparecerán aquí</p>
              </div>
            ) : (
              ventasHoy.map(v => (
                <VentaCard key={v.id} venta={v} onCancelar={handleCancelar} />
              ))
            )}
          </div>
        )}

        {/* ══════════════════ ESTADÍSTICAS ══════════════════ */}
        {tab === "estadisticas" && (
          <div className="space-y-4">
            {/* Selector de rango */}
            <div className="card border border-white/10">
              <div className="flex gap-2 flex-wrap">
                {([
                  { id: "hoy",    label: "Hoy" },
                  { id: "semana", label: "Semana" },
                  { id: "mes",    label: "Mes" },
                  { id: "custom", label: "Personalizado" },
                ] as { id: RangoStats; label: string }[]).map(r => (
                  <button
                    key={r.id}
                    onClick={() => setRango(r.id)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-bold border transition-all
                      ${rango === r.id
                        ? "border-[#00E5FF] text-[#00E5FF] bg-[#00E5FF]/10"
                        : "border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300"}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {rango === "custom" && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="label">Desde</label>
                    <input type="date" className="input" value={customDesde} onChange={e => setCustomDesde(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Hasta</label>
                    <input type="date" className="input" value={customHasta} onChange={e => setCustomHasta(e.target.value)} />
                  </div>
                </div>
              )}

              <button onClick={loadStats} className="btn-secondary btn-sm mt-3">
                <TrendingUp className="w-4 h-4" /> Cargar estadísticas
              </button>
            </div>

            {loadingStats ? (
              <div className="card flex items-center justify-center py-12">
                <span className="w-8 h-8 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : stats ? (
              <>
                {/* Métricas clave */}
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label={`Total facturado (${rangeLabel})`}
                    value={fmt(stats.totalFacturado)}
                    sub={`${stats.cantVentas} venta${stats.cantVentas !== 1 ? "s" : ""}`}
                    color="#39FF14"
                  />
                  <MetricCard
                    label="Ventas totales"
                    value={String(stats.cantVentas)}
                    sub={rangeLabel}
                    color="#00E5FF"
                  />
                  <MetricCard
                    label="Método más usado"
                    value={stats.metodoTop ? METODO_PAGO_LABELS[stats.metodoTop as MetodoPago] ?? stats.metodoTop : "—"}
                    color="#FDB71A"
                  />
                  <MetricCard
                    label="Producto top"
                    value={stats.productoTop ?? "—"}
                    color="#FF5722"
                  />
                </div>

                {/* Gráfico de barras */}
                {chartFormatted.length > 0 && (
                  <div className="card border border-white/10">
                    <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-[#FDB71A]" />
                      Facturación por día
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={chartFormatted} barSize={32}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => "$" + (v / 1000).toFixed(0) + "k"} />
                        <Tooltip
                          contentStyle={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff" }}
                          formatter={(v: number | string | undefined) => [fmt(Number(v ?? 0)), "Total"]}
                        />
                        <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                          {chartFormatted.map((_, i) => (
                            <Cell key={i} fill={i % 2 === 0 ? "#FDB71A" : "#FF5722"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Top 5 productos */}
                {topProd.length > 0 && (
                  <div className="card border border-white/10">
                    <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#00E5FF]" />
                      Top 5 productos más vendidos
                    </h3>
                    <div className="space-y-2">
                      {topProd.map((p, i) => {
                        const maxCant = topProd[0]?.cantidad || 1;
                        const pct = Math.round((p.cantidad / maxCant) * 100);
                        return (
                          <div key={p.producto}>
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-sm text-gray-300 truncate flex-1 mr-2">
                                <span className="text-gray-600 font-mono mr-1">#{i + 1}</span>
                                {p.producto}
                              </span>
                              <div className="text-right flex-shrink-0">
                                <span className="text-xs text-[#00E5FF] font-bold">{p.cantidad} uds</span>
                                <span className="text-xs text-gray-600 ml-2">{fmt(p.total)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/5">
                              <div
                                className="h-1.5 rounded-full transition-all"
                                style={{ width: `${pct}%`, background: i === 0 ? "#FDB71A" : "#00E5FF" }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Distribución por método de pago */}
              </>
            ) : (
              <div className="card flex flex-col items-center py-14 text-center">
                <CreditCard className="w-10 h-10 text-gray-700 mb-3" />
                <p className="text-gray-400 font-semibold">Seleccioná un rango y cargá las estadísticas</p>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />

      {toast && (
        <div className={`fixed bottom-28 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
          px-5 py-3.5 rounded-2xl shadow-2xl text-white font-semibold text-sm
          ${toast.ok ? "bg-green-700" : "bg-red-700"}`}>
          {toast.ok
            ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
            : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}
    </>
  );
}
