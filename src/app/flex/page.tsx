"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import OCRScanner, { PaqueteOCR } from "@/components/OCRScanner";
import { flexDb, clientesFlexDb, faseLabel } from "@/lib/db";
import {
  FlexEnvio, FlexZona,
  FLEX_LOCALIDADES, FLEX_TARIFAS, FidelAlerta,
} from "@/lib/types";
import {
  Truck, Trash2, TrendingUp, DollarSign,
  MapPin, Package, Camera, BarChart2, Settings, Calendar,
  Star, Gift, AlertTriangle,
} from "lucide-react";

const fmt = (n: number) =>
  "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 0 });

const ZONA_COLORS: Record<FlexZona, string> = {
  cercana: "bg-green-500/20 text-green-300 border-green-500/40",
  media:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  lejana:  "bg-red-500/20 text-red-300 border-red-500/40",
};
const ZONA_BAR: Record<FlexZona, string> = {
  cercana: "bg-green-500",
  media:   "bg-yellow-500",
  lejana:  "bg-red-500",
};
const ZONA_LABELS: Record<FlexZona, string> = {
  cercana: "Cercana",
  media:   "Media",
  lejana:  "Lejana",
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function useTarifas() {
  const [tarifas, setTarifas] = useState(
    FLEX_TARIFAS.reduce((acc, t) => ({ ...acc, [t.zona]: t.precio }), {} as Record<FlexZona, number>)
  );
  const update = (zona: FlexZona, precio: number) =>
    setTarifas(prev => ({ ...prev, [zona]: precio }));
  return { tarifas, update };
}

type Periodo = "dia" | "semana" | "mes";

function filtrarPorPeriodo(envios: FlexEnvio[], periodo: Periodo): FlexEnvio[] {
  const now  = new Date();
  const hoy  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return envios.filter(e => {
    const d = new Date(e.fecha);
    if (periodo === "dia")    return d >= hoy;
    if (periodo === "semana") {
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
      return d >= lunes;
    }
    // mes
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
}

// Agrupa envíos por fecha YYYY-MM-DD y cuenta por zona
function agruparPorDia(envios: FlexEnvio[]): { fecha: string; cercana: number; media: number; lejana: number }[] {
  const map: Record<string, { cercana: number; media: number; lejana: number }> = {};
  envios.forEach(e => {
    if (!map[e.fecha]) map[e.fecha] = { cercana: 0, media: 0, lejana: 0 };
    map[e.fecha][e.zona]++;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, v]) => ({ fecha, ...v }));
}

export default function FlexPage() {
  const [envios, setEnvios]           = useState<FlexEnvio[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showOCR, setShowOCR]         = useState(false);
  const [alertas, setAlertas]         = useState<FidelAlerta[]>([]);
  const { tarifas, update: updateTarifa } = useTarifas();
  const [settingEdit, setSettingEdit] = useState<Record<FlexZona, string>>({
    cercana: "4490", media: "6490", lejana: "8490",
  });
  const [filterZona, setFilterZona]   = useState<FlexZona | "todas">("todas");
  const [periodo, setPeriodo]         = useState<Periodo>("semana");

  const load = async () => {
    setLoading(true);
    try { setEnvios(await flexDb.getAll()); } catch (_) { setEnvios([]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este envío?")) return;
    await flexDb.delete(id);
    await load();
  };

  const handleOCRFinish = async (paquetes: PaqueteOCR[]) => {
    setShowOCR(false);
    const hoy = new Date().toISOString().slice(0, 10);
    const validos = paquetes.filter(p => p.localidad && p.estado === "ok");
    const nuevasAlertas: FidelAlerta[] = [];

    for (const p of validos) {
      try {
        await flexDb.create({
          id:                 generateId(),
          fecha:              hoy,
          localidad:          p.localidad!,
          zona:               p.zona ?? "lejana",
          precioML:           p.precioML,
          pagoFlete:          p.pagoFlete,
          ganancia:           p.ganancia,
          descripcion:        "",
          nroSeguimiento:     p.envioId ?? "",
          usuarioML:          p.usuarioML ?? "",
          nombreDestinatario: p.nombreDestinatario ?? "",
          direccion:          p.direccion ?? "",
          codigoPostal:       p.codigoPostal ?? "",
          productoSku:        p.productoSku ?? "",
          packId:             p.packId ?? "",
          createdAt:          new Date().toISOString(),
        });
        // Registrar compra en sistema de fidelización
        if (p.usuarioML) {
          const alerta = await clientesFlexDb.registrarCompra(
            p.usuarioML,
            p.nombreDestinatario ?? "",
            p.productoSku ?? "",
            p.localidad!,
            p.productoNombre ?? "",
            p.direccion ?? "",
          );
          if (alerta) nuevasAlertas.push(alerta);
        }
      } catch (_) {}
    }
    await load();
    if (nuevasAlertas.length > 0) setAlertas(nuevasAlertas);
    else if (validos.length > 0) alert(`✓ ${validos.length} envíos guardados correctamente.`);
    else alert("No se detectaron zonas válidas en las fotos.");
  };

  // ── Stats generales ──
  const stats = useMemo(() => {
    const filtered = filterZona === "todas" ? envios : envios.filter(e => e.zona === filterZona);
    const totalML       = filtered.reduce((s, e) => s + e.precioML, 0);
    const totalFlete    = filtered.reduce((s, e) => s + e.pagoFlete, 0);
    const totalGanancia = filtered.reduce((s, e) => s + e.ganancia, 0);
    const porZona = (["cercana", "media", "lejana"] as FlexZona[]).map(z => ({
      zona: z,
      count:    envios.filter(e => e.zona === z).length,
      ganancia: envios.filter(e => e.zona === z).reduce((s, e) => s + e.ganancia, 0),
    }));
    const byLoc: Record<string, { count: number; ganancia: number }> = {};
    envios.forEach(e => {
      if (!byLoc[e.localidad]) byLoc[e.localidad] = { count: 0, ganancia: 0 };
      byLoc[e.localidad].count++;
      byLoc[e.localidad].ganancia += e.ganancia;
    });
    const topLocalidades = Object.entries(byLoc)
      .sort((a, b) => b[1].ganancia - a[1].ganancia)
      .slice(0, 5);
    return { totalML, totalFlete, totalGanancia, porZona, topLocalidades, filtered };
  }, [envios, filterZona]);

  // ── Stats por período ──
  const grafStats = useMemo(() => {
    const base = filtrarPorPeriodo(envios, periodo);
    const total   = base.length;
    const ganancia = base.reduce((s, e) => s + e.ganancia, 0);
    const porZona = (["cercana", "media", "lejana"] as FlexZona[]).map(z => ({
      zona: z,
      count: base.filter(e => e.zona === z).length,
    }));
    const dias = agruparPorDia(base);
    return { total, ganancia, porZona, dias };
  }, [envios, periodo]);

  const maxDayTotal = useMemo(() =>
    Math.max(...grafStats.dias.map(d => d.cercana + d.media + d.lejana), 1),
  [grafStats.dias]);

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-6 pt-16 sm:pt-4 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500 rounded-xl p-2.5">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Logística Flex</h1>
              <p className="text-gray-400 text-sm">Mercado Libre — Control de envíos y ganancias</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2.5 rounded-xl bg-gray-800 text-gray-400 hover:text-white border border-gray-700 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowOCR(true)}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Camera className="w-4 h-4" /> Escanear
            </button>
          </div>
        </div>

        {/* Panel tarifas */}
        {showSettings && (
          <div className="bg-gray-800/80 rounded-2xl border border-gray-700 p-5 space-y-4">
            <h2 className="text-white font-bold flex items-center gap-2">
              <Settings className="w-4 h-4 text-yellow-400" /> Configurar Tarifas de Zonas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(["cercana", "media", "lejana"] as FlexZona[]).map(zona => (
                <div key={zona} className="space-y-1">
                  <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                    Zona {ZONA_LABELS[zona]}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={settingEdit[zona]}
                      onChange={e => setSettingEdit(prev => ({ ...prev, [zona]: e.target.value }))}
                      className="flex-1 bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-yellow-400 outline-none"
                    />
                    <button
                      onClick={() => {
                        const val = parseInt(settingEdit[zona]);
                        if (val > 0) updateTarifa(zona, val);
                      }}
                      className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-3 rounded-lg text-sm transition-colors"
                    >OK</button>
                  </div>
                  <p className="text-yellow-300 text-xs font-semibold">{fmt(tarifas[zona])}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cards resumen total */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-800/60 rounded-2xl border border-gray-700 p-4 text-center">
            <DollarSign className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-xs text-gray-400">Total ML</p>
            <p className="text-white font-black text-lg leading-tight">{fmt(stats.totalML)}</p>
          </div>
          <div className="bg-gray-800/60 rounded-2xl border border-gray-700 p-4 text-center">
            <Truck className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-xs text-gray-400">Pago Flete</p>
            <p className="text-white font-black text-lg leading-tight">{fmt(stats.totalFlete)}</p>
          </div>
          <div className="bg-green-900/40 rounded-2xl border border-green-700/50 p-4 text-center">
            <TrendingUp className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <p className="text-xs text-gray-400">Ganancia</p>
            <p className="text-green-300 font-black text-lg leading-tight">{fmt(stats.totalGanancia)}</p>
          </div>
        </div>

        {/* ══════════════════════════════════════
            ZONA DE GRÁFICOS
        ══════════════════════════════════════ */}
        <div className="bg-gray-800/60 rounded-2xl border border-gray-700 p-5 space-y-5">
          {/* Header gráficos + selector período */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-white font-bold flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-yellow-400" /> Análisis de Envíos
            </h2>
            <div className="flex items-center gap-1 bg-gray-900/60 rounded-xl p-1 border border-gray-700">
              {(["dia", "semana", "mes"] as Periodo[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    periodo === p
                      ? "bg-yellow-500 text-black"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {p === "dia" ? "Hoy" : p === "semana" ? "Semana" : "Mes"}
                </button>
              ))}
            </div>
          </div>

          {/* Mini resumen del período */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-900/50 rounded-xl p-3 flex items-center gap-3">
              <Package className="w-8 h-8 text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-gray-400 text-xs">Paquetes</p>
                <p className="text-white font-black text-2xl leading-tight">{grafStats.total}</p>
                <p className="text-gray-500 text-xs capitalize flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {periodo === "dia" ? "hoy" : periodo === "semana" ? "esta semana" : "este mes"}
                </p>
              </div>
            </div>
            <div className="bg-green-900/30 rounded-xl p-3 flex items-center gap-3 border border-green-700/30">
              <TrendingUp className="w-8 h-8 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-gray-400 text-xs">Ganancia</p>
                <p className="text-green-300 font-black text-xl leading-tight">{fmt(grafStats.ganancia)}</p>
                <p className="text-gray-500 text-xs">20% de gestión</p>
              </div>
            </div>
          </div>

          {/* Gráfico de barras por zona */}
          <div className="space-y-2">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Paquetes por Zona</p>
            {grafStats.porZona.map(({ zona, count }) => {
              const maxZ = Math.max(...grafStats.porZona.map(z => z.count), 1);
              const pct  = Math.round((count / maxZ) * 100);
              return (
                <div key={zona} className="flex items-center gap-3">
                  <span className={`w-20 text-xs font-bold shrink-0 ${
                    zona === "cercana" ? "text-green-400" : zona === "media" ? "text-yellow-400" : "text-red-400"
                  }`}>{ZONA_LABELS[zona]}</span>
                  <div className="flex-1 h-6 bg-gray-700/60 rounded-lg overflow-hidden">
                    <div
                      className={`h-full rounded-lg flex items-center px-2 transition-all duration-700 ${ZONA_BAR[zona]}`}
                      style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
                    >
                      {count > 0 && (
                        <span className="text-white text-xs font-black">{count}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-gray-400 text-xs w-12 text-right">{count} pkg</span>
                </div>
              );
            })}
          </div>

          {/* Gráfico de barras apiladas por día */}
          {grafStats.dias.length > 0 && (
            <div className="space-y-2">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                Paquetes por Día {periodo === "dia" ? "(hoy)" : periodo === "semana" ? "(esta semana)" : "(este mes)"}
              </p>
              <div className="flex items-end gap-1.5 h-28 overflow-x-auto pb-1">
                {grafStats.dias.map(d => {
                  const total = d.cercana + d.media + d.lejana;
                  const h = Math.round((total / maxDayTotal) * 96);
                  const fecha = new Date(d.fecha + "T12:00:00");
                  const label = periodo === "mes"
                    ? fecha.toLocaleDateString("es-AR", { day: "numeric" })
                    : fecha.toLocaleDateString("es-AR", { weekday: "short", day: "numeric" });
                  return (
                    <div key={d.fecha} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: "36px" }}>
                      <span className="text-white text-[10px] font-bold">{total}</span>
                      <div className="flex flex-col justify-end rounded-md overflow-hidden w-8" style={{ height: "80px" }}>
                        <div className="bg-gray-700/40 rounded-md overflow-hidden w-full flex flex-col justify-end" style={{ height: "80px" }}>
                          <div className="bg-red-500 w-full transition-all duration-500"    style={{ height: `${Math.round((d.lejana  / maxDayTotal) * 80)}px` }} />
                          <div className="bg-yellow-500 w-full transition-all duration-500" style={{ height: `${Math.round((d.media   / maxDayTotal) * 80)}px` }} />
                          <div className="bg-green-500 w-full transition-all duration-500"  style={{ height: `${Math.round((d.cercana / maxDayTotal) * 80)}px` }} />
                        </div>
                      </div>
                      <span className="text-gray-500 text-[9px] text-center leading-tight">{label}</span>
                    </div>
                  );
                })}
              </div>
              {/* Leyenda */}
              <div className="flex gap-4 justify-center">
                {(["cercana","media","lejana"] as FlexZona[]).map(z => (
                  <div key={z} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-sm ${ZONA_BAR[z]}`} />
                    <span className="text-gray-400 text-xs">{ZONA_LABELS[z]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {grafStats.total === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">Sin datos para el período seleccionado</p>
          )}
        </div>

        {/* Top localidades */}
        {stats.topLocalidades.length > 0 && (
          <div className="bg-gray-800/60 rounded-2xl border border-gray-700 p-5 space-y-3">
            <h2 className="text-white font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-yellow-400" /> Top 5 Localidades más Rentables
            </h2>
            <div className="space-y-2">
              {stats.topLocalidades.map(([loc, data], i) => {
                const zona = FLEX_LOCALIDADES.find(l => l.nombre === loc)?.zona ?? "lejana";
                return (
                  <div key={loc} className="flex items-center gap-3 py-2 border-b border-gray-700/50 last:border-0">
                    <span className="text-gray-500 text-sm font-bold w-5">#{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-white text-sm font-semibold">{loc}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${ZONA_COLORS[zona]}`}>
                        {ZONA_LABELS[zona]}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-green-300 font-bold text-sm">{fmt(data.ganancia)}</p>
                      <p className="text-gray-400 text-xs">{data.count} envíos</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filtro + lista de envíos */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-400 text-sm">Filtrar:</span>
            {(["todas", "cercana", "media", "lejana"] as const).map(z => (
              <button
                key={z}
                onClick={() => setFilterZona(z)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                  filterZona === z
                    ? "bg-yellow-500 text-black border-yellow-500"
                    : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
                }`}
              >
                {z === "todas" ? "Todas" : ZONA_LABELS[z]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : stats.filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">Sin envíos registrados</p>
              <p className="text-sm">Usá &quot;Escanear&quot; para cargar envíos con la cámara</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.filtered.map(envio => (
                <div key={envio.id} className="bg-gray-800/60 rounded-2xl border border-gray-700 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${ZONA_COLORS[envio.zona]}`}>
                          {ZONA_LABELS[envio.zona]}
                        </span>
                        <span className="text-white font-semibold">{envio.localidad}</span>
                        <span className="text-gray-500 text-xs">{new Date(envio.fecha).toLocaleDateString("es-AR")}</span>
                      </div>
                      {envio.nombreDestinatario && (
                        <p className="text-gray-300 text-sm font-medium">{envio.nombreDestinatario}
                          {envio.usuarioML && <span className="text-gray-500 text-xs ml-1">({envio.usuarioML})</span>}
                        </p>
                      )}
                      {envio.direccion && (
                        <p className="text-gray-500 text-xs mt-0.5"><MapPin className="w-3 h-3 inline mr-0.5" />{envio.direccion}</p>
                      )}
                      {envio.nroSeguimiento && (
                        <p className="text-gray-500 text-xs mt-0.5 font-mono">ID: {envio.nroSeguimiento}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-white text-sm">ML: <span className="font-bold">{fmt(envio.precioML)}</span></p>
                      <p className="text-blue-300 text-xs">Flete: {fmt(envio.pagoFlete)}</p>
                      <p className="text-green-300 text-xs font-bold">Gan: {fmt(envio.ganancia)}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(envio.id)}
                      className="p-2 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-900/20 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {showOCR && (
        <OCRScanner
          tarifas={tarifas}
          onFinish={handleOCRFinish}
          onClose={() => setShowOCR(false)}
        />
      )}

      {/* ══ MODAL DE ALERTAS DE FIDELIZACIÓN ══ */}
      {alertas.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-gray-900 rounded-3xl border border-gray-700 shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-white" />
                <h3 className="text-white font-black text-lg">Sistema Verdent — Fidelización</h3>
              </div>
              <span className="bg-white/20 text-white text-xs font-bold px-2 py-1 rounded-full">
                {alertas.length} cliente{alertas.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="p-4 space-y-4 max-h-[78vh] overflow-y-auto">
              {alertas.map((a, i) => {
                const faseBg =
                  a.fase === "oro"   ? "border-yellow-500/60 bg-yellow-900/20" :
                  a.fase === "plata" ? "border-gray-400/60 bg-gray-700/20" :
                                       "border-orange-700/60 bg-orange-900/10";
                const esRegaloUrgente = a.comprasEsteMes >= 3 || a.totalCompras >= 10;
                return (
                  <div key={i} className={`rounded-2xl border p-4 space-y-3 ${faseBg}`}>

                    {/* Identificación del cliente */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-white font-black text-base">{a.nombre || a.usuarioML}</p>
                        <p className="text-gray-400 text-xs font-mono">@{a.usuarioML}</p>
                        {a.direccion && (
                          <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{a.direccion}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-black">{faseLabel(a.fase)}</p>
                        {a.esNuevoNivel && (
                          <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse block mt-1">
                            ¡SUBIÓ DE NIVEL!
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Producto detectado */}
                    {(a.productoNombre || a.ultimoProducto) && (
                      <div className="bg-gray-800/60 rounded-xl px-3 py-2 flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-gray-400 text-xs">Producto detectado</p>
                          <p className="text-white text-sm font-semibold">{a.productoNombre || a.ultimoProducto}</p>
                        </div>
                      </div>
                    )}

                    {/* 🚨 ALERTA REGALO — máxima prominencia */}
                    <div className={`rounded-xl p-4 border-2 ${
                      esRegaloUrgente
                        ? "bg-green-900/50 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                        : "bg-purple-900/40 border-purple-600/70"
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Gift className={`w-5 h-5 ${esRegaloUrgente ? "text-green-400" : "text-purple-400"}`} />
                        <span className={`text-sm font-black uppercase tracking-wider ${
                          esRegaloUrgente ? "text-green-300" : "text-purple-300"
                        }`}>
                          {esRegaloUrgente ? "🚨 ALERTA REGALO — INCLUIR EN LA CAJA" : "REGALO SUGERIDO"}
                        </span>
                      </div>
                      <p className={`text-2xl font-black ${esRegaloUrgente ? "text-white" : "text-purple-100"}`}>
                        {a.regalSugerido}
                      </p>
                      {esRegaloUrgente && (
                        <p className="text-green-300 text-xs mt-1 font-semibold">
                          {a.comprasEsteMes >= 3 ? `✓ ${a.comprasEsteMes} compras este mes` : ""}{" "}
                          {a.totalCompras >= 10 ? `✓ ${a.totalCompras} compras totales` : ""}
                        </p>
                      )}
                    </div>

                    {/* Contadores */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-gray-800/60 rounded-xl p-2.5 text-center">
                        <p className="text-gray-400 text-[10px] uppercase">Total</p>
                        <p className="text-white font-black text-xl">{a.totalCompras}</p>
                      </div>
                      <div className="bg-gray-800/60 rounded-xl p-2.5 text-center">
                        <p className="text-gray-400 text-[10px] uppercase">Este mes</p>
                        <p className="text-white font-black text-xl">{a.comprasEsteMes}</p>
                      </div>
                      <div className="bg-gray-800/60 rounded-xl p-2.5 text-center">
                        <p className="text-gray-400 text-[10px] uppercase">Próx. fase</p>
                        <p className="text-white font-black text-xl">
                          {a.fase === "bronce" ? `${10 - a.totalCompras}` :
                           a.fase === "plata"  ? `${50 - a.totalCompras}` : "✓"}
                        </p>
                      </div>
                    </div>

                    {/* Línea para Supabase/Excel — copiable */}
                    <div className="space-y-1.5">
                      <p className="text-gray-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                        <BarChart2 className="w-3 h-3" /> Línea para Supabase / Excel
                      </p>
                      <div className="bg-gray-950 rounded-xl p-3 flex items-start gap-2">
                        <code className="text-green-300 text-[11px] font-mono flex-1 break-all leading-relaxed">
                          {a.lineaSupabase}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(a.lineaSupabase);
                          }}
                          className="flex-shrink-0 bg-gray-700 hover:bg-green-700 text-gray-300 hover:text-white px-2 py-1 rounded-lg text-[10px] font-bold transition-colors"
                        >
                          COPIAR
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => setAlertas([])}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-2xl transition-colors text-lg"
              >
                Entendido — Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}
