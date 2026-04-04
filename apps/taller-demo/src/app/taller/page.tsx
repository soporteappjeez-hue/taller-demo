"use client";

import { useState } from "react";
import {
  Plus, Wrench, AlertTriangle, Package, CheckSquare, Clock,
  FileSpreadsheet, FileText, CheckCircle, MessageCircle, Trophy, Medal,
} from "lucide-react";
import { WorkOrder, MOTOR_TYPE_LABELS } from "@/lib/types";
import { useOrders } from "@/hooks/useOrders";
import { useInventory } from "@/hooks/useInventory";
import { useNotifications } from "@/hooks/useNotifications";
import { generateId } from "@/lib/utils";
import { exportOrdersToExcel } from "@/lib/exportExcel";
import { exportOrdersReportPDF } from "@/lib/exportPDF";
import { clearSentLog } from "@/lib/notifications";
import { agendaDb, historialDb } from "@/lib/db";
import Navbar from "@/components/Navbar";
import FiltersBar from "@/components/FiltersBar";
import OrderCard from "@/components/OrderCard";
import OrderForm from "@/components/OrderForm";
import NotificationsPanel from "@/components/NotificationsPanel";
import TemplateManager from "@/components/TemplateManager";
import BottomNav from "@/components/BottomNav";

/* ── Tarjeta de estado con glow neón ── */
function StatCard({
  label,
  value,
  icon: Icon,
  cardClass,
  iconColor,
  valueColor,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  cardClass: string;
  iconColor: string;
  valueColor: string;
}) {
  return (
    <div className={cardClass}>
      <div className="flex items-center gap-3">
        <Icon className={`w-7 h-7 flex-shrink-0 ${iconColor}`} />
        <div>
          <p className={`text-3xl font-black leading-tight ${valueColor}`}>{value}</p>
          <p className="text-xs text-gray-400 font-semibold mt-0.5">{label}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Badge de fase de fidelización ── */
function FaseBadge({ compras }: { compras: number }) {
  if (compras >= 50) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border border-yellow-400/60 text-gold" style={{ background: "rgba(255,215,0,0.12)", textShadow: "0 0 6px rgba(255,215,0,0.7)" }}>
      <Trophy className="w-3 h-3" /> ORO
    </span>
  );
  if (compras >= 10) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border border-gray-300/60 text-gray-200" style={{ background: "rgba(200,200,200,0.12)" }}>
      <Medal className="w-3 h-3" /> PLATA
    </span>
  );
  if (compras >= 3) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border border-orange-400/60 text-orange-400" style={{ background: "rgba(255,87,34,0.12)" }}>
      <Medal className="w-3 h-3" /> BRONCE
    </span>
  );
  return null;
}

export default function DashboardPage() {
  const {
    orders,
    filtered,
    filters,
    setFilters,
    create,
    update,
    remove,
    overdueCount,
    loading,
  } = useOrders();
  const { lowStockCount } = useInventory();
  const { pending, sentLog, markSent, unsentCount, refresh: refreshNotifications } =
    useNotifications(orders);

  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), type === "error" ? 8000 : 3500);
  };

  const handleSave = async (order: WorkOrder) => {
    try {
      if (editingOrder) {
        await update(order.id, order);
        agendaDb.upsertByPhone(order.clientName, order.clientPhone).then(async () => {
          const clientes = await agendaDb.getAll();
          const cliente = clientes.find(c => c.telefono === order.clientPhone.trim());
          if (cliente) historialDb.upsert(cliente.id, order).catch(() => {});
        }).catch(() => {});
        showToast("Orden actualizada con éxito");
      } else {
        const newOrder = { ...order, id: generateId(), entryDate: new Date().toISOString() };
        await create(newOrder);
        agendaDb.upsertByPhone(newOrder.clientName, newOrder.clientPhone).then(async () => {
          const clientes = await agendaDb.getAll();
          const cliente = clientes.find(c => c.telefono === newOrder.clientPhone.trim());
          if (cliente) historialDb.upsert(cliente.id, newOrder).catch(() => {});
        }).catch(() => {});
        showToast("¡Orden guardada con éxito!");
      }
      setShowForm(false);
      setEditingOrder(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Error: ${msg}`, "error");
    }
  };

  const handleEdit = (order: WorkOrder) => {
    setEditingOrder(order);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingOrder(null);
  };

  const activeOrders       = orders.filter((o) => o.status !== "entregado");
  const readyOrders        = orders.filter((o) => o.status === "listo_para_retiro");
  const inRepairOrders     = orders.filter((o) => o.status === "en_reparacion");
  const waitingPartsOrders = orders.filter((o) => o.status === "esperando_repuesto");

  return (
    <>
      <Navbar
        overdueCount={overdueCount}
        lowStockCount={lowStockCount}
        notificationCount={unsentCount}
        onOpenNotifications={() => setShowNotifications(true)}
      />

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 sm:pb-6 space-y-6">

        {/* ── Tarjetas de estado neón ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Activas"
            value={activeOrders.length}
            icon={Wrench}
            cardClass="card-neon-orange"
            iconColor="text-orange-neon"
            valueColor="text-orange-neon"
          />
          <StatCard
            label="En Reparación"
            value={inRepairOrders.length}
            icon={Clock}
            cardClass="card-neon-cyan"
            iconColor="text-cyan"
            valueColor="text-cyan"
          />
          <StatCard
            label="Listas para Retiro"
            value={readyOrders.length}
            icon={CheckSquare}
            cardClass="card-neon-green"
            iconColor="text-neon"
            valueColor="text-neon"
          />
          <StatCard
            label="Esp. Repuesto"
            value={waitingPartsOrders.length}
            icon={Package}
            cardClass="card-neon-gold"
            iconColor="text-gold"
            valueColor="text-gold"
          />
        </div>

        {/* ── Alerta 90 días ── */}
        {overdueCount > 0 && (
          <div className="card-alert flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-300 font-bold text-base">
                {overdueCount} equipo{overdueCount > 1 ? "s" : ""} con más de 90 días esperando retiro
              </p>
              <p className="text-red-400/70 text-sm mt-0.5">
                Contactá al cliente para coordinar la devolución o el abandono del equipo.
              </p>
              <button
                onClick={() => setFilters({ ...filters, overdueOnly: true })}
                className="mt-2 text-sm text-red-300 underline underline-offset-2 hover:text-red-200"
              >
                Ver solo esas órdenes →
              </button>
            </div>
          </div>
        )}

        {/* ── Filtros + Exportar + Plantillas ── */}
        <div className="space-y-3">
          <FiltersBar
            filters={filters}
            onChange={setFilters}
            totalCount={orders.length}
            filteredCount={filtered.length}
          />
          <div className="flex flex-wrap gap-2">
            {filtered.length > 0 && (
              <>
                <button
                  onClick={() => exportOrdersToExcel(filtered)}
                  className="btn-secondary flex-1 sm:flex-none"
                >
                  <FileSpreadsheet className="w-5 h-5 text-green-400" />
                  Excel
                  <span className="text-gray-500 text-sm font-normal">({filtered.length})</span>
                </button>
                <button
                  onClick={() => {
                    const label =
                      filters.motorType !== "all" ? (MOTOR_TYPE_LABELS[filters.motorType] ?? filters.motorType)
                      : filters.status !== "all" ? `Estado: ${filters.status}`
                      : filters.overdueOnly ? "Más de 90 días"
                      : "Todas las órdenes";
                    exportOrdersReportPDF(filtered, label);
                  }}
                  className="btn-secondary flex-1 sm:flex-none"
                >
                  <FileText className="w-5 h-5 text-red-400" />
                  PDF
                  <span className="text-gray-500 text-sm font-normal">({filtered.length})</span>
                </button>
              </>
            )}
            <button
              onClick={() => setShowTemplates(true)}
              className="btn-secondary flex-1 sm:flex-none"
            >
              <MessageCircle className="w-5 h-5 text-green-400" />
              <span className="hidden sm:inline">Plantillas WA</span>
              <span className="sm:hidden">Plantillas</span>
            </button>
          </div>
        </div>

        {/* ── Lista de órdenes ── */}
        <div className="space-y-3">
          {loading ? (
            <div className="card flex flex-col items-center py-16 text-center">
              <div className="w-10 h-10 border-4 border-[#FF5722] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-400 font-semibold">Cargando órdenes...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,87,34,0.12)", border: "2px solid rgba(255,87,34,0.40)" }}>
                <Wrench className="w-8 h-8 text-orange-neon" />
              </div>
              <div>
                <p className="text-gray-300 font-bold text-lg">
                  {orders.length === 0
                    ? "No hay órdenes de trabajo todavía"
                    : "No se encontraron órdenes con esos filtros"}
                </p>
                <p className="text-gray-600 text-sm mt-1">
                  {orders.length === 0
                    ? "Tocá el botón naranja para ingresar tu primer equipo"
                    : "Probá ajustar los filtros"}
                </p>
              </div>
            </div>
          ) : (
            filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onEdit={handleEdit}
                onDelete={remove}
              />
            ))
          )}
        </div>
      </main>

      {/* ── FAB — Nueva orden (Naranja AppJeez con glow) ── */}
      <button
        onClick={() => { setEditingOrder(null); setShowForm(true); }}
        className="fixed bottom-[88px] sm:bottom-6 right-4 sm:right-6
                   btn-primary rounded-2xl
                   h-14 w-14 sm:h-auto sm:w-auto sm:px-6 z-40"
        aria-label="Nueva orden"
      >
        <Plus className="w-6 h-6 flex-shrink-0" />
        <span className="hidden sm:inline text-base font-bold">Nueva Orden</span>
      </button>

      {showForm && (
        <OrderForm
          initial={editingOrder ?? undefined}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}

      {showNotifications && (
        <NotificationsPanel
          pending={pending}
          sentLog={sentLog}
          onSend={(n, msg) => markSent(n, msg)}
          onClearLog={() => { clearSentLog(); refreshNotifications(); }}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {showTemplates && (
        <TemplateManager onClose={() => setShowTemplates(false)} />
      )}

      <BottomNav
        notificationCount={unsentCount}
        onOpenNotifications={() => setShowNotifications(true)}
      />

      {toast && (
        <div
          className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3
            px-5 py-3.5 rounded-2xl shadow-2xl text-white font-semibold text-sm
            ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}
        >
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {toast.msg}
        </div>
      )}
    </>
  );
}
