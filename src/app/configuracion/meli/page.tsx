"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle, XCircle, RefreshCw, ExternalLink,
  ShieldCheck, Zap, ArrowLeft, User, Clock,
} from "lucide-react";

// v2 - usa API route con service_role
// ── Tipos ──────────────────────────────────────────────────────
interface MeliAccount {
  id: string;
  meli_user_id: string;
  nickname: string;
  expires_at: string;
  status: string;
  created_at: string;
}

// ── Constantes ─────────────────────────────────────────────────
const MELI_AUTH_URL =
  "https://auth.mercadolibre.com.ar/authorization" +
  `?response_type=code` +
  `&client_id=${process.env.NEXT_PUBLIC_MELI_APP_ID ?? ""}` +
  `&redirect_uri=https://ajhmajaclimccrkehsyy.supabase.co/functions/v1/appjeez-meli-callback`;

// ── Helpers ────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} días`;
}

function expiresIn(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)} min`;
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} días`;
}

// ── Componente interno (usa useSearchParams) ───────────────────
function ConfigMeliContent() {
  const params = useSearchParams();
  const status  = params.get("status");
  const userId  = params.get("user_id");
  const message = params.get("message");

  const [accounts, setAccounts]   = useState<MeliAccount[]>([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Cargar cuentas conectadas ──────────────────────────────
  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meli-accounts");
      const data = await res.json();
      if (Array.isArray(data)) setAccounts(data as MeliAccount[]);
    } catch { /* silencioso */ }
    setLoading(false);
  };

  useEffect(() => {
    loadAccounts();
    if (status === "success") showToast(`Cuenta MeLi conectada correctamente (ID: ${userId})`);
    if (status === "error")   showToast(`Error al conectar: ${message ?? "desconocido"}`, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Revocar cuenta ─────────────────────────────────────────
  const handleRevoke = async (id: string, nickname: string) => {
    if (!confirm(`¿Desconectar la cuenta @${nickname}? Deberás volver a autorizar.`)) return;
    const res = await fetch("/api/meli-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "revoked" }),
    });
    if (!res.ok) { showToast("Error al revocar", false); return; }
    showToast(`@${nickname} desconectada`);
    loadAccounts();
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: "#121212" }}>

      {/* Header */}
      <div className="sticky top-0 z-30 px-4 py-4 flex items-center gap-3 border-b border-white/10"
        style={{ background: "rgba(18,18,18,0.95)", backdropFilter: "blur(12px)" }}>
        <Link href="/taller" className="p-2 rounded-xl hover:bg-white/10 text-gray-400">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-base font-black text-white">Configuración MeLi</h1>
          <p className="text-xs text-gray-500">Cuentas de Mercado Libre conectadas</p>
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">

        {/* Banner resultado OAuth */}
        {status === "success" && (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-green-500/30"
            style={{ background: "rgba(57,255,20,0.08)" }}>
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-400">¡Cuenta conectada exitosamente!</p>
              <p className="text-xs text-gray-400 mt-0.5">ID de usuario MeLi: {userId}</p>
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/30"
            style={{ background: "rgba(255,50,50,0.08)" }}>
            <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-400">Error al conectar</p>
              <p className="text-xs text-gray-400 mt-0.5">{message ?? "Intentá de nuevo"}</p>
            </div>
          </div>
        )}

        {/* Botón conectar nueva cuenta */}
        <div className="rounded-2xl border border-white/10 p-5 space-y-4"
          style={{ background: "#1a1a1a" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFE600] flex items-center justify-center flex-shrink-0">
              <span className="text-[#003087] font-black text-[9px] leading-tight text-center">
                mercado<br/>libre
              </span>
            </div>
            <div>
              <p className="text-sm font-black text-white">Conectar Cuenta MeLi</p>
              <p className="text-xs text-gray-500">OAuth 2.0 seguro · Tokens encriptados AES-256</p>
            </div>
          </div>

          <a
            href={MELI_AUTH_URL}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white transition-all"
            style={{ background: "#FFE600", color: "#003087", boxShadow: "0 0 20px rgba(255,230,0,0.30)" }}
          >
            <ExternalLink className="w-4 h-4" />
            Autorizar con Mercado Libre
          </a>

          <div className="flex items-center gap-4 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
              Conexión cifrada
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              Renovación automática
            </div>
          </div>
        </div>

        {/* Lista de cuentas conectadas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-black text-white">Cuentas Conectadas</p>
            <button onClick={loadAccounts}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-600 text-sm">Cargando...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-10 rounded-2xl border border-white/5"
              style={{ background: "#1a1a1a" }}>
              <User className="w-10 h-10 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm font-semibold">Sin cuentas conectadas</p>
              <p className="text-gray-600 text-xs mt-1">Autorizá tu cuenta MeLi arriba</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map(acc => {
                const active  = acc.status === "active";
                const expired = acc.status === "expired";
                return (
                  <div key={acc.id}
                    className="rounded-2xl border p-4 space-y-3"
                    style={{
                      background: "#1a1a1a",
                      borderColor: active ? "rgba(57,255,20,0.20)" : "rgba(255,80,80,0.20)",
                    }}>

                    {/* Cabecera */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#FFE600] flex items-center justify-center flex-shrink-0">
                        <span className="text-[#003087] font-black text-[7px]">ML</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white truncate">
                          @{acc.nickname || acc.meli_user_id}
                        </p>
                        <p className="text-xs text-gray-500">ID: {acc.meli_user_id}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        active  ? "text-green-400 bg-green-500/15" :
                        expired ? "text-red-400 bg-red-500/15" :
                                  "text-gray-400 bg-gray-500/15"
                      }`}>
                        {active ? "Activa" : expired ? "Expirada" : "Revocada"}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Token expira en: <span className={`ml-1 font-semibold ${active ? "text-green-400" : "text-red-400"}`}>
                          {expiresIn(acc.expires_at)}
                        </span>
                      </div>
                      <span>Conectada {timeAgo(acc.created_at)}</span>
                    </div>

                    {/* Acciones */}
                    {active && (
                      <button
                        onClick={() => handleRevoke(acc.id, acc.nickname)}
                        className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Desconectar cuenta
                      </button>
                    )}
                    {(expired || acc.status === "revoked") && (
                      <a href={MELI_AUTH_URL}
                        className="text-xs text-yellow-400 hover:text-yellow-300 font-semibold flex items-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5" /> Reconectar
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info de seguridad */}
        <div className="rounded-2xl border border-white/5 p-4"
          style={{ background: "#161616" }}>
          <p className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> Seguridad
          </p>
          <ul className="space-y-1 text-xs text-gray-600">
            <li>• Los tokens se encriptan con AES-256-GCM antes de guardarse</li>
            <li>• Las claves secretas nunca tocan el frontend</li>
            <li>• La renovación es automática (cada 50 min)</li>
            <li>• Callback URL: ajhmajaclimccrkehsyy.supabase.co</li>
          </ul>
        </div>

      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl ${toast.ok ? "bg-green-700" : "bg-red-700"}`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Página exportada con Suspense boundary ─────────────────────
export default function ConfigMeliPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#121212" }}>
        <p className="text-gray-500 text-sm">Cargando...</p>
      </div>
    }>
      <ConfigMeliContent />
    </Suspense>
  );
}
