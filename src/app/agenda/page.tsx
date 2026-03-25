"use client";

import { useState, useEffect, useMemo } from "react";
import { AgendaCliente, HistorialReparacion } from "@/lib/types";
import { agendaDb, historialDb } from "@/lib/db";
import { formatDate, formatCurrency } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import {
  Users, Search, Phone, ChevronRight, X,
  Wrench, Trash2, Camera, Calendar,
  ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";

// ─── Línea de tiempo de un cliente ──────────────────────────────

function Timeline({ items }: { items: HistorialReparacion[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  if (items.length === 0) return (
    <div className="flex flex-col items-center py-10 text-gray-500">
      <Wrench className="w-10 h-10 mb-2 opacity-30" />
      <p className="text-sm">No hay reparaciones registradas</p>
    </div>
  );

  return (
    <ol className="relative border-l-2 border-orange-500/30 ml-4 space-y-0">
      {items.map((o, idx) => {
        const isOpen = expanded[o.id];
        return (
          <li key={o.id} className="mb-0 ml-6">
            <span className={`absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full border-2
              ${idx === 0 ? "bg-orange-500 border-orange-400" : "bg-gray-700 border-gray-500"}`} />
            <div className="card mb-4">
              <button className="w-full text-left" onClick={() => toggle(o.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg border
                        ${o.motorType === "2T"
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                          : "bg-orange-500/20 text-orange-300 border-orange-500/40"}`}>
                        {o.motorType}
                      </span>
                      {idx === 0 && (
                        <span className="badge bg-orange-900/40 text-orange-300 border-orange-600">
                          Última visita
                        </span>
                      )}
                    </div>
                    <p className="text-white font-bold">{o.brand} {o.model}</p>
                    <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" /> {formatDate(o.fechaIngreso)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {o.presupuesto !== null && (
                      <span className="text-green-400 font-bold text-sm">
                        {formatCurrency(o.presupuesto)}
                      </span>
                    )}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="mt-3 pt-3 border-t border-gray-700/60 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Falla reportada</p>
                    <p className="text-gray-300 text-sm leading-relaxed">{o.falla}</p>
                  </div>
                  {o.trabajo && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Trabajo realizado</p>
                      <p className="text-gray-300 text-sm leading-relaxed">{o.trabajo}</p>
                    </div>
                  )}
                  {o.estadoFinal && (
                    <p className="text-xs text-gray-500">Estado: <span className="text-gray-300">{o.estadoFinal}</span></p>
                  )}
                  {(o.photoUrls?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <Camera className="w-3 h-3" /> Fotos del ingreso ({o.photoUrls.length})
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {o.photoUrls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`Foto ${i + 1}`}
                              className="h-20 w-20 object-cover rounded-xl border border-gray-600 flex-shrink-0 hover:border-orange-400 transition-colors" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Modal ficha de cliente ──────────────────────────────────────

function ClienteModal({ cliente, onClose }: { cliente: AgendaCliente; onClose: () => void }) {
  const [items, setItems] = useState<HistorialReparacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    historialDb.getByCliente(cliente.id).then(data => {
      setItems(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [cliente.id]);

  const equipos = useMemo(() => {
    const map = new Map<string, { brand: string; model: string; type: string; count: number }>();
    items.forEach(o => {
      const key = `${o.brand}|${o.model}|${o.motorType}`;
      const e = map.get(key);
      if (e) e.count++; else map.set(key, { brand: o.brand, model: o.model, type: o.motorType, count: 1 });
    });
    return Array.from(map.values());
  }, [items]);

  const totalFacturado = items.reduce((s, o) => s + (o.presupuesto ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-900 w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl border border-gray-700 shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-300 font-black text-xl">
                {cliente.nombre.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">{cliente.nombre}</h2>
              <p className="text-gray-400 text-sm flex items-center gap-1">
                <Phone className="w-3 h-3" />
                <a href={`tel:${cliente.telefono}`} className="hover:text-orange-400 transition-colors">
                  {cliente.telefono}
                </a>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm p-2.5 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 gap-2 px-5 pt-4">
            <div className="card py-3 text-center">
              <p className="text-2xl font-black text-orange-400">{items.length}</p>
              <p className="text-xs text-gray-500">Visitas</p>
            </div>
            <div className="card py-3 text-center">
              <p className="text-2xl font-black text-green-400">{formatCurrency(totalFacturado)}</p>
              <p className="text-xs text-gray-500">Total facturado</p>
            </div>
          </div>
        )}

        {/* Equipos */}
        {equipos.length > 0 && (
          <div className="px-5 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Equipos registrados</p>
            <div className="flex flex-wrap gap-2">
              {equipos.map((eq, i) => (
                <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2">
                  <p className="text-white text-sm font-semibold">{eq.brand} {eq.model}</p>
                  <p className="text-gray-500 text-xs">{eq.type === "2T" ? "2 Tiempos" : "4 Tiempos"} · {eq.count} ingreso{eq.count !== 1 ? "s" : ""}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Línea de tiempo */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {items.length > 0 && (
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Historial permanente — {items.length} visita{items.length !== 1 ? "s" : ""}
                </p>
              )}
              <Timeline items={items} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal de Agenda ──────────────────────────────────

export default function AgendaPage() {
  const [clientes, setClientes] = useState<AgendaCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AgendaCliente | null>(null);

  const load = async () => {
    setLoading(true);
    try { setClientes(await agendaDb.getAll()); } catch {}
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const count = await agendaDb.syncFromOrders();
      await load();
      alert(count > 0 ? `✓ ${count} cliente${count !== 1 ? "s" : ""} sincronizado${count !== 1 ? "s" : ""} desde las órdenes.` : "✓ La agenda ya estaba al día.");
    } catch (e) { alert("Error al sincronizar: " + e); }
    setSyncing(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clientes;
    return clientes.filter(c =>
      c.nombre.toLowerCase().includes(q) || c.telefono.includes(q)
    );
  }, [clientes, search]);

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar a ${nombre} de la agenda?\nSus órdenes no se borran.`)) return;
    await agendaDb.delete(id);
    await load();
  };

  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 sm:pb-8 space-y-5">

        {/* Título */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 rounded-xl p-2.5">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Agenda de Clientes</h1>
            <p className="text-gray-400 text-sm">
              {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} · Identificados por teléfono
            </p>
          </div>
          <button onClick={handleSync} disabled={syncing}
            className="ml-auto btn-secondary btn-sm rounded-xl flex items-center gap-2"
            title="Sincronizar desde órdenes existentes">
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-orange-400" : "text-gray-400"}`} />
            <span className="hidden sm:inline text-xs">Sincronizar</span>
          </button>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            className="input pl-11 text-base"
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex flex-col items-center py-20">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-400">Cargando agenda...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-16">
            <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 font-semibold">
              {search ? "No se encontraron clientes" : "La agenda está vacía"}
            </p>
            <p className="text-gray-600 text-sm mt-1">
              {search
                ? "Probá con otro nombre o número"
                : "Los clientes se agregan automáticamente al crear órdenes"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {search && (
              <p className="text-gray-500 text-xs px-1">
                {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para &quot;{search}&quot;
              </p>
            )}
            {filtered.map(c => (
              <div key={c.id}
                className="card flex items-center justify-between gap-3 cursor-pointer hover:border-blue-500/50 active:scale-[0.99] transition-all"
                onClick={() => setSelected(c)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-300 font-black text-lg">
                      {c.nombre.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-bold truncate">{c.nombre}</p>
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{c.telefono}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(c.id, c.nombre); }}
                    className="p-2.5 rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                    title="Eliminar de la agenda"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selected && <ClienteModal cliente={selected} onClose={() => setSelected(null)} />}
      <BottomNav />
    </>
  );
}
