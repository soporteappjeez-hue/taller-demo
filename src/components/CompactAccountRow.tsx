"use client";

import { MessageCircle, MessageSquare, Truck, Package, Pencil, Check, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useMeliAccountData } from "@/hooks/useMeliAccountData";
import ReputationBadge from "@/components/ReputationBadge";
import MetricsBar from "@/components/MetricsBar";
import UrgentMetrics from "@/components/UrgentMetrics";

interface Reputation {
  level_id: string | null;
  power_seller_status: string | null;
  transactions_total: number;
  transactions_completed: number;
  ratings_positive: number;
  ratings_negative: number;
  ratings_neutral: number;
  delayed_handling_time: number;
  claims: number;
  cancellations: number;
  immediate_payment: boolean;
}

interface AccountDash {
  account: string;
  meli_user_id: string;
  unanswered_questions: number;
  pending_messages: number;
  ready_to_ship: number;
  total_items: number;
  today_orders: number;
  today_sales_amount: number;
  claims_count: number;
  measurement_date: string;
  metrics_period: string;
  reputation: Reputation;
  roman_index: string;
  display_name: string;
  error?: string;
}

interface Props {
  data: AccountDash;
  isOpen: boolean;
  onToggle: (id: string) => void;
  editingNick: string | null;
  editNickVal: string;
  setEditingNick: (v: string | null) => void;
  setEditNickVal: (v: string) => void;
  handleRenameAccount: (meliUserId: string, newName: string) => void;
}

function RepoBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-[10px] text-gray-500">Sin datos</span>;

  const LEVEL_COLORS: Record<string, string> = {
    "1_red": "#ef4444",
    "2_orange": "#FF5722",
    "3_yellow": "#FFE600",
    "4_light_green": "#7CFC00",
    "5_green": "#39FF14",
  };
  const LEVEL_LABELS: Record<string, string> = {
    "1_red": "Rojo",
    "2_orange": "Naranja",
    "3_yellow": "Amarillo",
    "4_light_green": "Verde claro",
    "5_green": "Verde",
  };

  const color = LEVEL_COLORS[level] ?? "#6B7280";
  const label = LEVEL_LABELS[level] ?? level;

  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap"
      style={{ background: color + "22", color, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  );
}

export default function CompactAccountRow({
  data,
  isOpen,
  onToggle,
  editingNick,
  editNickVal,
  setEditingNick,
  setEditNickVal,
  handleRenameAccount,
}: Props) {
  const urgentTotal = (data.unanswered_questions ?? 0) + (data.ready_to_ship ?? 0) + (data.pending_messages ?? 0);

  // Cargar datos en tiempo real si la cuenta está abierta
  const { data: meliData, loading: dataLoading, error: dataError } = useMeliAccountData(
    isOpen ? data.meli_user_id : null
  );

  return (
    <div
      className="rounded-lg overflow-hidden mb-2"
      style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Header Row - 60px */}
      <button
        onClick={() => onToggle(data.meli_user_id)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
        style={{ background: "linear-gradient(90deg,#1F1F1F,#1a1a1a)", height: "60px" }}
      >
        {/* Left: Logo + Name + Rep */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {/* Logo */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#FFE600,#FF9800)" }}
          >
            📦
          </div>

          {/* Account Info */}
          <div className="flex-1 min-w-0">
            {/* Name + Edit */}
            <div className="flex items-center gap-1 mb-0.5">
              {data.roman_index && (
                <span
                  className="text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: "#FFE600", color: "#121212" }}
                >
                  {data.roman_index}
                </span>
              )}
              {editingNick === data.meli_user_id ? (
                <div className="flex items-center gap-0.5">
                  <input
                    value={editNickVal}
                    onChange={e => setEditNickVal(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleRenameAccount(data.meli_user_id, editNickVal)}
                    className="font-bold text-white text-xs bg-transparent border-b border-yellow-400 outline-none w-24"
                    autoFocus
                  />
                  <button
                    onClick={() => handleRenameAccount(data.meli_user_id, editNickVal)}
                    className="p-0.5 rounded hover:bg-white/10"
                  >
                    <Check className="w-3 h-3 text-green-400" />
                  </button>
                  <button
                    onClick={() => setEditingNick(null)}
                    className="p-0.5 rounded hover:bg-white/10"
                  >
                    <XCircle className="w-3 h-3 text-gray-500" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <p className="font-bold text-white text-xs">@{data.account}</p>
                  <button
                    onClick={() => {
                      setEditingNick(data.meli_user_id);
                      setEditNickVal(data.account);
                    }}
                    className="p-0.5 rounded hover:bg-white/10 flex-shrink-0"
                  >
                    <Pencil className="w-2.5 h-2.5 text-gray-500" />
                  </button>
                </div>
              )}
            </div>

            {/* Rep + Items */}
            <div className="flex items-center gap-2 text-[10px]">
              <RepoBadge level={data.reputation?.level_id ?? null} />
              <span style={{ color: "#6B7280" }}>{data.total_items ?? 0} pub.</span>
            </div>
          </div>
        </div>

        {/* Right: Urgent Badge + Expand Icon */}
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          {urgentTotal > 0 && (
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black text-black animate-pulse flex-shrink-0"
              style={{ background: "#FF5722" }}
            >
              {urgentTotal}
            </span>
          )}
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )}
        </div>
      </button>

      {/* Expandable Content */}
      {isOpen && (
        <div
          className="px-4 py-3 space-y-3 border-t"
          style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0a0a0a" }}
        >
          {data.error && (
            <div className="p-2 rounded text-xs" style={{ background: "#ef444422", color: "#ef4444" }}>
              Error: {data.error}
            </div>
          )}

          {/* Reputación en tiempo real */}
          {dataLoading && (
            <div className="p-2 text-xs text-gray-400 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
              Cargando datos de reputación...
            </div>
          )}

          {dataError && (
            <div className="p-2 rounded text-xs" style={{ background: "#ef444422", color: "#ef4444" }}>
              Error cargando datos: {dataError}
            </div>
          )}

          {meliData && (
            <>
              {/* Sección 1: Reputación - Nivel + Badge de Poder Vendedor */}
              {meliData.reputation && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6B7280" }}>
                    Reputación
                  </p>
                  <ReputationBadge
                    levelId={meliData.reputation.level_id}
                    levelName={meliData.reputation.level_name}
                    powerSellerStatus={meliData.reputation.power_seller_status}
                  />
                </div>
              )}

              {/* Sección 2: Métricas de Reputación (Reclamos, Canceladas, Demora Envíos) */}
              {meliData.reputation && (
                <MetricsBar
                  claims={meliData.reputation.claims ?? 0}
                  cancellations={meliData.reputation.cancellations ?? 0}
                  delayedHandlingTime={meliData.reputation.delayed_handling_time ?? 0}
                  measurementPeriod={data.metrics_period || "Últimos 60 días"}
                />
              )}

              {/* Sección 3: Pendientes Urgentes - 4 Cards Clicables */}
              <UrgentMetrics
                questions={data.unanswered_questions ?? 0}
                messages={data.pending_messages ?? 0}
                shipments={data.ready_to_ship ?? 0}
                claims={data.claims_count ?? 0}
              />

              {/* Sección 4: Resumen de Stock - 3 Cards */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <MetricCard
                  label="Activas"
                  value={meliData.stats?.total_active_items ?? 0}
                  color="#39FF14"
                />
                <MetricCard
                  label="Bajo Stock"
                  value={meliData.stats?.items_low_stock ?? 0}
                  color="#FFE600"
                />
                <MetricCard
                  label="Sin Stock"
                  value={meliData.stats?.items_out_of_stock ?? 0}
                  color="#EF4444"
                />
              </div>

              {/* Sección 5: Acciones Rápidas - Botones */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95"
                  style={{ background: "#FF5722", border: "none" }}
                >
                  Ver Preguntas
                </button>
                <button
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95"
                  style={{ background: "#EF4444", border: "none" }}
                >
                  Ver Reclamos
                </button>
                <button
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95"
                  style={{ background: "#00E5FF", border: "none", color: "#000" }}
                >
                  Imprimir Envíos
                </button>
                <button
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95"
                  style={{ background: "#9C27B0", border: "none" }}
                >
                  Sincronizar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="rounded p-2 flex flex-col gap-1"
      style={{
        background: value > 0 ? color + "15" : "#1F1F1F",
        border: `1px solid ${value > 0 ? color + "33" : "rgba(255,255,255,0.07)"}`,
      }}
    >
      {icon && (
        <div className="flex items-center gap-1" style={{ color }}>
          {icon}
          <span className="text-[9px] font-semibold text-gray-400">{label}</span>
        </div>
      )}
      {!icon && <span className="text-[9px] font-semibold text-gray-400">{label}</span>}
      <p className="text-xs font-black" style={{ color: value > 0 ? color : "#6B7280" }}>
        {value}
      </p>
    </div>
  );
}
