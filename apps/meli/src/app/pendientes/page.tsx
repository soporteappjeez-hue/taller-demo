"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import { getPendientes, removePendiente, clearPendientes, PendienteEntrega } from "@/lib/pendientes";
import { Package, CheckCircle2, Trash2, Truck, Clock, ShoppingBag, RefreshCw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type TipoFiltro = "todas" | "flex" | "correo" | "turbo";

const TYPE_LABELS: Record<string, string> = {
  flex:   "Flex",
  correo: "Correo",
  turbo:  "Turbo",
};
const TYPE_COLORS: Record<string, string> = {
  flex:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  correo: "bg-blue-500/20   text-blue-300   border-blue-500/40",
  turbo:  "bg-purple-500/20 text-purple-300 border-purple-500/40",
};
const TYPE_BG: Record<string, string> = {
  flex:   "#FFE60015",
  correo: "#3B82F615",
  turbo:  "#A855F715",
};
const TYPE_BORDER: Record<string, string> = {
  flex:   "#FFE60040",
  correo: "#3B82F640",
  turbo:  "#A855F740",
};
const TYPE_SOLID: Record<string, string> = {
  flex:   "#FFE600",
  correo: "#3B82F6",
  turbo:  "#A855F7",
};

function timeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export default function PendientesPage() {
  const [items, setItems] = useState<PendienteEntrega[]>([]);
  const [timeLeft, setTimeLeft] = useState(timeUntilMidnight());
  const [filtroTipo, setFiltroTipo] = useState<TipoFiltro>("todas");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    try {
      const list = getPendientes();
      setItems(list);
      setTimeLeft(timeUntilMidnight());
    } catch (e) {
      console.error("Error cargando pendientes:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleEntregado = (shipment_id: number) => {
    removePendiente(shipment_id);
    refresh();
  };

  const handleClearAll = () => {
    if (!confirm("¿Marcar todos como entregados?")) return;
    clearPendientes();
    refresh();
  };

  // Filtrar items según el tipo seleccionado
  const itemsFiltrados = filtroTipo === "todas"
    ? items
    : items.filter(i => i.type === filtroTipo);

  // Conteos por tipo
  const countFlex = items.filter(i => i.type === "flex").length;
  const countCorreo = items.filter(i => i.type === "correo").length;
  const countTurbo = items.filter(i => i.type === "turbo").length;

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 sm:pb-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-500 rounded-xl p-2.5">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Pendientes de Entrega</h1>
              <p className="text-gray-400 text-sm flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Expiran a las 00:00 hs — quedan {timeLeft}
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1 border border-gray-700 hover:border-red-500/50 rounded-xl px-3 py-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar todo
            </button>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1 border border-gray-700 hover:border-gray-500 rounded-xl px-3 py-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        {/* Filtros por tipo */}
        {items.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-[10px] font-bold" style={{ color: "#9CA3AF" }}>VER:</span>
            <button
              onClick={() => setFiltroTipo("todas")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-bold transition-all whitespace-nowrap"
              style={
                filtroTipo === "todas"
                  ? { background: "#FFE600", color: "#121212", border: "2px solid #FFE600" }
                  : { background: "transparent", color: "#FFE600", border: "2px solid #FFE60040" }
              }
            >
              TODAS
              <span className={`text-[9px] font-black px-1 py-0.5 rounded-full min-w-[18px] text-center ${
                items.length > 0 ? "bg-yellow-500 text-black" : "bg-gray-700 text-gray-400"
              }`}>
                {items.length}
              </span>
            </button>

            {(["flex", "correo", "turbo"] as const).map(type => {
              const count = type === "flex" ? countFlex : type === "correo" ? countCorreo : countTurbo;
              const isActive = filtroTipo === type;
              return (
                <button
                  key={type}
                  onClick={() => setFiltroTipo(isActive ? "todas" : type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-bold transition-all whitespace-nowrap"
                  style={
                    isActive
                      ? { background: TYPE_SOLID[type], color: "#121212", border: `2px solid ${TYPE_SOLID[type]}` }
                      : count > 0
                        ? { background: `${TYPE_SOLID[type]}20`, color: TYPE_SOLID[type], border: `2px solid ${TYPE_SOLID[type]}60` }
                        : { background: "transparent", color: "#4B5563", border: "2px solid #4B556320" }
                  }
                >
                  {TYPE_LABELS[type]}
                  <span className={`text-[9px] font-black px-1 py-0.5 rounded-full min-w-[18px] text-center ${
                    count > 0 ? "bg-red-500 text-white" : "bg-gray-700 text-gray-400"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-gray-500">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3" />
            <p className="text-sm">Cargando pendientes...</p>
          </div>
        )}

        {/* Resumen */}
        {!loading && items.length > 0 && filtroTipo === "todas" && (
          <div className="grid grid-cols-3 gap-3">
            {(["flex","correo","turbo"] as const).map(t => {
              const count = items.filter(i => i.type === t).length;
              if (count === 0) return null;
              return (
                <div key={t} className={`rounded-2xl border p-3 text-center ${TYPE_COLORS[t]}`}>
                  <p className="text-2xl font-black">{count}</p>
                  <p className="text-xs font-semibold opacity-80">{TYPE_LABELS[t]}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Sin pendientes */}
        {!loading && itemsFiltrados.length === 0 && (
          <div className="text-center py-20 text-gray-500 space-y-3">
            <CheckCircle2 className="w-14 h-14 mx-auto opacity-20" />
            <p className="font-semibold text-lg">
              {items.length === 0 ? "Todo entregado" : "Sin pendientes de este tipo"}
            </p>
            <p className="text-sm">
              {items.length === 0
                ? "No hay envíos pendientes de entrega por hoy."
                : `No hay envíos ${filtroTipo !== "todas" ? TYPE_LABELS[filtroTipo] : ""} pendientes.`}
            </p>
            <Link
              href="/etiquetas"
              className="inline-block mt-2 text-yellow-400 text-sm font-semibold hover:underline"
            >
              Ir a Etiquetas →
            </Link>
          </div>
        )}

        {/* Lista agrupada por tipo — secciones independientes */}
        {!loading &&
          (filtroTipo === "todas" ? (["flex", "correo", "turbo"] as const) : [filtroTipo])
          .map(type => {
            const group = items.filter(i => i.type === type);
            if (group.length === 0) return null;
            return (
              <div key={type} className="mb-4 rounded-2xl overflow-hidden"
                style={{ border: `2px solid ${TYPE_BORDER[type]}`, background: "#1a1a1a" }}>
                {/* Header del tipo */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b"
                  style={{ borderColor: TYPE_BORDER[type], background: TYPE_BG[type] }}>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full ${TYPE_COLORS[type]}`}>
                    {TYPE_LABELS[type]}
                  </span>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full animate-pulse bg-red-500 text-white">
                    PENDIENTES DE ENVÍO
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 ml-auto">
                    {group.length} {group.length === 1 ? "envío" : "envíos"} por despachar hoy
                  </span>
                </div>
                {/* Lista */}
                <div className="p-3 space-y-2">
                  {group.map(item => {
                    const horaCompra = item.order_date
                      ? new Date(item.order_date).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : null;
                    return (
                      <div
                        key={item.shipment_id}
                        className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-3 flex items-start gap-3"
                      >
                        {/* Thumbnail */}
                        {item.thumbnail ? (
                          <Image
                            src={item.thumbnail}
                            alt={item.title}
                            width={56}
                            height={56}
                            className="rounded-lg object-cover flex-shrink-0 bg-gray-700"
                            unoptimized
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <Package className="w-6 h-6 text-gray-500" />
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold ${TYPE_COLORS[item.type]}`}>
                              {TYPE_LABELS[item.type]}
                            </span>
                            {/* Hora de compra bien visible */}
                            {horaCompra && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-green-500 text-white">
                                🕐 {horaCompra} hs
                              </span>
                            )}
                          </div>
                          <p className="text-white font-semibold text-sm leading-snug line-clamp-2">
                            {item.title || "Sin título"}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {item.buyer_nickname && (
                              <span className="text-gray-400 text-xs">@{item.buyer_nickname}</span>
                            )}
                            <span className="text-gray-500 text-xs">x{item.quantity}</span>
                            {item.seller_sku && (
                              <span className="text-gray-600 text-[10px] font-mono">SKU: {item.seller_sku}</span>
                            )}
                          </div>
                          <p className="text-gray-600 text-[10px] mt-0.5 font-mono">
                            ID: {item.shipment_id}
                          </p>
                        </div>

                        {/* Botón entregado */}
                        <button
                          onClick={() => handleEntregado(item.shipment_id)}
                          className="flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-xl text-gray-600 hover:text-green-400 hover:bg-green-900/20 border border-transparent hover:border-green-700/40 transition-all"
                          title="Marcar como entregado"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="text-[9px] font-bold">Listo</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </main>
      <BottomNav />
    </>
  );
}
