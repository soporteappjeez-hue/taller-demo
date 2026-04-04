"use client";

import { useState } from "react";
import {
  X,
  MessageCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Package,
  DollarSign,
  Phone,
  Send,
  History,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import {
  PendingNotification,
  SentNotification,
  NotificationType,
  NOTIFICATION_TEMPLATES,
} from "@/lib/notifications";
import { formatDatetime, buildWhatsAppUrl } from "@/lib/utils";
import { WorkOrder } from "@/lib/types";

// ─── Icon map ─────────────────────────────────────────────────

const TYPE_ICONS: Record<NotificationType, React.ElementType> = {
  budget_ready:    DollarSign,
  repair_complete: CheckCircle,
  no_response:     Phone,
  overdue_pickup:  AlertTriangle,
  waiting_parts:   Package,
  custom:          MessageCircle,
};

const TYPE_COLORS: Record<NotificationType, string> = {
  budget_ready:    "text-blue-400 bg-blue-900/40 border-blue-700",
  repair_complete: "text-green-400 bg-green-900/40 border-green-700",
  no_response:     "text-yellow-400 bg-yellow-900/40 border-yellow-700",
  overdue_pickup:  "text-red-400 bg-red-900/40 border-red-700",
  waiting_parts:   "text-orange-400 bg-orange-900/40 border-orange-700",
  custom:          "text-gray-400 bg-gray-800 border-gray-700",
};

// ─── Custom message editor ────────────────────────────────────

function MessageEditor({
  notification,
  onSend,
  onClose,
}: {
  notification: PendingNotification;
  onSend: (msg: string) => void;
  onClose: () => void;
}) {
  const [msg, setMsg] = useState(
    notification.template.buildMessage(notification.order)
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-gray-900 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-green-600 rounded-xl p-2">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Editar mensaje</h3>
              <p className="text-gray-400 text-xs">{notification.order.clientName} · {notification.order.clientPhone}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm p-2.5 rounded-xl">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <textarea
            className="input resize-none min-h-[180px] text-sm leading-relaxed"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
          />
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <a
              href={buildWhatsAppUrl(notification.order.clientPhone, msg)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { onSend(msg); onClose(); }}
              className="btn btn-whatsapp flex-1"
            >
              <Send className="w-4 h-4" />
              Enviar por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────

interface NotificationsPanelProps {
  pending: PendingNotification[];
  sentLog: SentNotification[];
  onSend: (notification: PendingNotification, msg?: string) => void;
  onClearLog: () => void;
  onClose: () => void;
}

export default function NotificationsPanel({
  pending,
  sentLog,
  onSend,
  onClearLog,
  onClose,
}: NotificationsPanelProps) {
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [editing, setEditing] = useState<PendingNotification | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const unsent = pending.filter((p) => !p.alreadySent);
  const sent   = pending.filter((p) => p.alreadySent);

  // Group pending by order
  const byOrder = pending.reduce<Record<string, PendingNotification[]>>((acc, p) => {
    const key = p.order.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const handleSendDirect = (n: PendingNotification) => {
    const msg = n.template.buildMessage(n.order);
    window.open(buildWhatsAppUrl(n.order.clientPhone, msg), "_blank");
    onSend(n, msg);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-gray-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl border border-gray-700
                        max-h-[92vh] flex flex-col shadow-2xl">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-green-600 rounded-xl p-2 relative">
                <MessageCircle className="w-5 h-5 text-white" />
                {unsent.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-black
                                   rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unsent.length}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Notificaciones WhatsApp</h2>
                <p className="text-xs text-gray-500">
                  {unsent.length} pendiente{unsent.length !== 1 ? "s" : ""} · {sent.length} ya enviada{sent.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost btn-sm p-2.5 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700 flex-shrink-0">
            <button
              onClick={() => setTab("pending")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors
                ${tab === "pending" ? "text-white border-b-2 border-green-500" : "text-gray-500 hover:text-gray-300"}`}
            >
              <Send className="w-4 h-4" />
              Pendientes
              {unsent.length > 0 && (
                <span className="bg-red-500 text-white text-xs font-black px-1.5 py-0.5 rounded-full">
                  {unsent.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("history")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold transition-colors
                ${tab === "history" ? "text-white border-b-2 border-green-500" : "text-gray-500 hover:text-gray-300"}`}
            >
              <History className="w-4 h-4" />
              Historial ({sentLog.length})
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">

            {/* ── PENDING TAB ── */}
            {tab === "pending" && (
              <>
                {pending.length === 0 ? (
                  <div className="flex flex-col items-center py-14 text-center">
                    <CheckCircle className="w-12 h-12 text-green-600 mb-4" />
                    <p className="text-gray-300 font-bold text-lg">Todo al día</p>
                    <p className="text-gray-500 text-sm mt-1">No hay notificaciones pendientes</p>
                  </div>
                ) : (
                  Object.entries(byOrder).map(([orderId, notifications]) => {
                    const order = notifications[0].order;
                    const isOpen = expandedOrder === orderId;
                    const hasUnsent = notifications.some((n) => !n.alreadySent);

                    return (
                      <div
                        key={orderId}
                        className={`rounded-2xl border overflow-hidden
                          ${hasUnsent ? "border-gray-600 bg-gray-800/60" : "border-gray-700 bg-gray-900/60"}`}
                      >
                        {/* Order header row */}
                        <button
                          onClick={() => setExpandedOrder(isOpen ? null : orderId)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="bg-green-600/20 rounded-xl p-2 flex-shrink-0">
                              <MessageCircle className="w-4 h-4 text-green-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-white font-bold text-sm truncate">{order.clientName}</p>
                              <p className="text-gray-400 text-xs">{order.brand} {order.model} · {order.clientPhone}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            {hasUnsent && (
                              <span className="text-xs font-bold text-red-400 bg-red-900/40 border border-red-700 px-2 py-0.5 rounded-full">
                                {notifications.filter((n) => !n.alreadySent).length} pendiente{notifications.filter((n) => !n.alreadySent).length !== 1 ? "s" : ""}
                              </span>
                            )}
                            {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                          </div>
                        </button>

                        {/* Expanded notifications */}
                        {isOpen && (
                          <div className="border-t border-gray-700/60 divide-y divide-gray-700/40">
                            {notifications.map((n) => {
                              const Icon = TYPE_ICONS[n.template.type];
                              return (
                                <div key={n.template.type} className="px-4 py-3 flex items-start gap-3">
                                  <div className={`rounded-xl p-2 border flex-shrink-0 ${TYPE_COLORS[n.template.type]}`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-semibold">{n.template.label}</p>
                                    {n.alreadySent && n.sentAt && (
                                      <p className="text-gray-500 text-xs mt-0.5">
                                        <CheckCircle className="inline w-3 h-3 text-green-500 mr-1" />
                                        Enviado: {formatDatetime(n.sentAt)}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                      onClick={() => setEditing(n)}
                                      className="btn btn-sm btn-ghost px-2.5 rounded-xl border border-gray-700 text-xs"
                                      title="Editar mensaje"
                                    >
                                      Editar
                                    </button>
                                    <a
                                      href={buildWhatsAppUrl(n.order.clientPhone, n.template.buildMessage(n.order))}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => onSend(n, n.template.buildMessage(n.order))}
                                      className={`btn btn-sm px-3 rounded-xl
                                        ${n.alreadySent
                                          ? "bg-gray-700 text-gray-300 border border-gray-600 hover:bg-green-900/40 hover:text-green-400"
                                          : "bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-900/30"
                                        }`}
                                    >
                                      <Send className="w-3.5 h-3.5" />
                                      {n.alreadySent ? "Reenviar" : "Enviar"}
                                    </a>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}

            {/* ── HISTORY TAB ── */}
            {tab === "history" && (
              <>
                {sentLog.length === 0 ? (
                  <div className="flex flex-col items-center py-14 text-center">
                    <History className="w-12 h-12 text-gray-700 mb-4" />
                    <p className="text-gray-400 font-semibold">Sin historial todavía</p>
                    <p className="text-gray-600 text-sm mt-1">Los mensajes enviados aparecerán aquí</p>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { if (confirm("¿Borrar todo el historial?")) onClearLog(); }}
                      className="btn btn-sm btn-ghost text-red-400 border border-gray-700 px-3 rounded-xl ml-auto flex"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Borrar historial
                    </button>
                    {sentLog.map((s) => {
                      const Icon = TYPE_ICONS[s.type] ?? MessageCircle;
                      const template = NOTIFICATION_TEMPLATES.find((t) => t.type === s.type);
                      return (
                        <div key={s.id} className="card flex items-start gap-3">
                          <div className={`rounded-xl p-2 border flex-shrink-0 ${TYPE_COLORS[s.type] ?? TYPE_COLORS.custom}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-white text-sm font-semibold">{s.clientName}</p>
                              <span className="text-gray-500 text-xs">{s.clientPhone}</span>
                            </div>
                            <p className="text-gray-400 text-xs mt-0.5">{template?.label ?? s.type}</p>
                            <p className="text-gray-600 text-xs mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDatetime(s.sentAt)}
                            </p>
                          </div>
                          <a
                            href={buildWhatsAppUrl(s.clientPhone, s.message)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm px-3 rounded-xl bg-green-900/30 text-green-400 border border-green-800 flex-shrink-0"
                            title="Reenviar"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <MessageEditor
          notification={editing}
          onSend={(msg) => onSend(editing, msg)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
