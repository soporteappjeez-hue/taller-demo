"use client";

import Link from "next/link";
import { MessageCircle, MessageSquare, Truck, Package } from "lucide-react";
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

export default function AccountDetailsPanel({ data }: Props) {
  // Cargar datos en tiempo real (siempre, no conditionally)
  const { data: meliData, loading: dataLoading, error: dataError } = useMeliAccountData(data.meli_user_id);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {/* Header - Información de la cuenta seleccionada */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0f0f0f" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#FFE600,#FF9800)" }}
          >
            📦
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              {data.roman_index && (
                <span
                  className="text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: "#FFE600", color: "#121212" }}
                >
                  {data.roman_index}
                </span>
              )}
              <p className="font-bold text-white text-xs">@{data.account}</p>
            </div>
            <p className="text-[10px] mt-1" style={{ color: "#6B7280" }}>
              {data.total_items ?? 0} publicaciones
            </p>
          </div>
        </div>
      </div>

      {/* Content - 5 Secciones */}
      <div className="px-4 py-3 space-y-3" style={{ background: "#0a0a0a" }}>
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

            {/* Sección 5: POST-VENTA UNIFICADA - Reclamos, Mediaciones, Demoras */}
            {meliData?.reputation && (
              <div
                className="rounded-lg p-3 space-y-2"
                style={{ background: "#EF444410", border: "1px solid #EF444422" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#EF4444" }}>
                  📊 Post-Venta (Últimos 60 días)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {/* Reclamos */}
                  <div
                    className="rounded p-2 text-center"
                    style={{ background: "#EF444415", border: "1px solid #EF444422" }}
                  >
                    <p className="text-[10px]" style={{ color: "#6B7280" }}>
                      Reclamos
                    </p>
                    <p className="text-sm font-black" style={{ color: "#EF4444" }}>
                      {meliData.reputation.claims ? (meliData.reputation.claims * 100).toFixed(2) : "0"}%
                    </p>
                    <p className="text-[8px]" style={{ color: "#6B7280" }}>
                      {data.claims_count ?? 0} abiertos
                    </p>
                  </div>

                  {/* Mediaciones */}
                  <div
                    className="rounded p-2 text-center"
                    style={{ background: "#FF572215", border: "1px solid #FF572222" }}
                  >
                    <p className="text-[10px]" style={{ color: "#6B7280" }}>
                      Mediaciones
                    </p>
                    <p className="text-sm font-black" style={{ color: "#FF5722" }}>
                      {meliData.reputation.cancellations ? (meliData.reputation.cancellations * 100).toFixed(2) : "0"}%
                    </p>
                    <p className="text-[8px]" style={{ color: "#6B7280" }}>
                      En análisis
                    </p>
                  </div>

                  {/* Demoras en Despacho */}
                  <div
                    className="rounded p-2 text-center"
                    style={{ background: "#FFE60015", border: "1px solid #FFE60022" }}
                  >
                    <p className="text-[10px]" style={{ color: "#6B7280" }}>
                      Demoras
                    </p>
                    <p className="text-sm font-black" style={{ color: "#FFE600" }}>
                      {meliData.reputation.delayed_handling_time ? (meliData.reputation.delayed_handling_time * 100).toFixed(2) : "0"}%
                    </p>
                    <p className="text-[8px]" style={{ color: "#6B7280" }}>
                      En envío
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sección 6: Acciones Rápidas - Botones */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              {/* Ver Preguntas - Link a Mensajería interna */}
              <Link
                href="/appjeez/mensajes"
                className="rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95 text-center"
                style={{ background: "#FF5722", border: "none", textDecoration: "none" }}
              >
                Ver Preguntas
              </Link>

              {/* Post Venta / Gestionar Reclamos - Link a página unificada */}
              <Link
                href={`/appjeez/post-venta?account=${data.account}`}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95 text-center"
                style={{ background: "#EF4444", border: "none", textDecoration: "none" }}
              >
                Gestionar Reclamos
              </Link>

              {/* Imprimir Envíos - Link a Etiquetas interna */}
              <Link
                href="/appjeez/etiquetas"
                className="rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95 text-center"
                style={{ background: "#00E5FF", border: "none", color: "#000", textDecoration: "none" }}
              >
                Imprimir Envíos
              </Link>

              {/* Sincronizar - Link al menu de sincronización */}
              <Link
                href="/appjeez/sincronizar"
                className="rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all hover:scale-105 active:scale-95 text-center"
                style={{ background: "#9C27B0", border: "none", textDecoration: "none" }}
              >
                Sincronizar
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
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
      <span className="text-[9px] font-semibold text-gray-400">{label}</span>
      <p className="text-xs font-black" style={{ color: value > 0 ? color : "#6B7280" }}>
        {value}
      </p>
    </div>
  );
}
