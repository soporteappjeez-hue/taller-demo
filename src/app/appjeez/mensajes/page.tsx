"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, MessageCircle, Send, Clock,
  CheckCircle2, AlertCircle, Store, ChevronDown, ChevronUp,
  Search, Package,
} from "lucide-react";

interface Question {
  id: string;
  meli_question_id: number;
  meli_account_id: string;
  item_id: string;
  item_title: string;
  buyer_id: number;
  buyer_nickname: string;
  question_text: string;
  status: string;
  date_created: string;
  answer_text: string | null;
  meli_accounts: { nickname: string } | null;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function QuestionCard({
  q,
  onAnswered,
}: {
  q: Question;
  onAnswered: (id: number) => void;
}) {
  const [open, setOpen]       = useState(false);
  const [text, setText]       = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const templates = [
    "¡Hola! Sí, el producto está disponible. ¿Tenés alguna consulta adicional?",
    "El envío es por Mercado Envíos y llega en 24-72hs hábiles.",
    "Sí, contamos con stock disponible. Podés comprarlo con total confianza.",
    "El producto es original de fábrica. Cualquier consulta estamos a disposición.",
  ];

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true); setError(null);
    try {
      const res = await fetch("/api/meli-answer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question_id: q.meli_question_id, answer_text: text }),
      });
      const data = await res.json();
      if (data.status === "ok") {
        onAnswered(q.meli_question_id);
      } else {
        setError(data.code ?? "Error al enviar");
      }
    } catch {
      setError("Error de red");
    } finally {
      setSending(false);
    }
  }

  const account = q.meli_accounts?.nickname ?? "—";

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <button onClick={() => setOpen(o => !o)} className="w-full text-left p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Account + item */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: "#FFE60018", color: "#FFE600" }}
              >
                @{account}
              </span>
              <span className="text-[10px] text-gray-500 flex items-center gap-1 truncate">
                <Package className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{q.item_title || q.item_id}</span>
              </span>
            </div>

            {/* Pregunta */}
            <p className="text-sm text-white font-medium leading-snug line-clamp-2">
              {q.question_text}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="text-[10px]" style={{ color: "#6B7280" }}>
              {timeAgo(q.date_created)}
            </span>
            {open
              ? <ChevronUp  className="w-4 h-4 text-gray-500" />
              : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {/* Pregunta completa */}
          <div className="pt-3 p-3 rounded-xl" style={{ background: "#121212" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>Pregunta completa:</p>
            <p className="text-sm text-white">{q.question_text}</p>
          </div>

          {/* Plantillas rápidas */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "#6B7280" }}>
              Respuestas rápidas
            </p>
            <div className="flex flex-col gap-1.5">
              {templates.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setText(t)}
                  className="text-left text-xs px-3 py-2 rounded-xl transition-opacity hover:opacity-80"
                  style={{ background: "#00E5FF12", color: "#00E5FF", border: "1px solid #00E5FF22" }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <textarea
            rows={3}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Escribí tu respuesta..."
            className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 outline-none resize-none"
            style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}
          />

          {error && (
            <p className="text-xs" style={{ color: "#ef4444" }}>Error: {error}</p>
          )}

          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-black disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: "#FFE600" }}
          >
            {sending
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Enviando...</>
              : <><Send className="w-4 h-4" /> Responder</>}
          </button>
        </div>
      )}
    </div>
  );
}

function MensajesInner() {
  const [questions, setQuestions]   = useState<Question[]>([]);
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [lastSync, setLastSync]     = useState<Date | null>(null);

  const load = useCallback(async (sync = false) => {
    if (sync) setSyncing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meli-questions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setQuestions(await res.json());
      setLastSync(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false); setSyncing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const handleAnswered = (id: number) => {
    setQuestions(qs => qs.filter(q => q.meli_question_id !== id));
  };

  const filtered = questions.filter(q =>
    q.question_text.toLowerCase().includes(search.toLowerCase()) ||
    (q.item_title ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (q.meli_accounts?.nickname ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen pb-24" style={{ background: "#121212" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b"
        style={{
          background: "rgba(18,18,18,0.97)",
          backdropFilter: "blur(16px)",
          borderColor: "rgba(255,255,255,0.07)",
        }}
      >
        <div className="flex items-center gap-3">
          <Link href="/appjeez" className="p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="font-black text-white text-base flex items-center gap-2">
              <MessageCircle className="w-5 h-5" style={{ color: "#FF5722" }} />
              Mensajería Unificada
            </h1>
            <p className="text-[10px]" style={{ color: "#6B7280" }}>
              {lastSync ? `Sincronizado ${lastSync.toLocaleTimeString("es-AR")}` : "Cargando..."}
            </p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={syncing || loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
          style={{ background: "#1F1F1F", color: "#FF5722", border: "1px solid #FF572244" }}
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sync..." : "Sincronizar"}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* Counter */}
        {!loading && (
          <div
            className="rounded-2xl p-4 mb-4 flex items-center gap-4"
            style={{
              background: questions.length > 0 ? "#FF572218" : "#1F1F1F",
              border: `1px solid ${questions.length > 0 ? "#FF572244" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl"
              style={{ background: questions.length > 0 ? "#FF5722" : "#2a2a2a", color: "#fff" }}
            >
              {questions.length}
            </div>
            <div>
              <p className="font-black text-white">
                {questions.length === 0
                  ? "Sin preguntas pendientes"
                  : `Pregunta${questions.length > 1 ? "s" : ""} sin responder`}
              </p>
              <p className="text-xs" style={{ color: "#6B7280" }}>
                {questions.length > 0
                  ? "Respondelas rápido para mejorar tu reputación"
                  : "¡Al día con todas tus cuentas!"}
              </p>
            </div>
          </div>
        )}

        {/* Search */}
        {!loading && questions.length > 0 && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por producto, pregunta o cuenta..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 outline-none"
              style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl p-4 mb-4 text-center" style={{ background: "#ef444418", border: "1px solid #ef444440" }}>
            <AlertCircle className="w-7 h-7 mx-auto mb-1" style={{ color: "#ef4444" }} />
            <p className="text-sm text-white font-semibold">{error}</p>
            <button onClick={() => load()} className="mt-2 px-4 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white">
              Reintentar
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: "#1F1F1F" }}>
                <div className="h-3 rounded w-24 mb-2" style={{ background: "#2a2a2a" }} />
                <div className="h-4 rounded w-3/4 mb-1" style={{ background: "#2a2a2a" }} />
                <div className="h-4 rounded w-1/2"    style={{ background: "#2a2a2a" }} />
              </div>
            ))}
          </div>
        )}

        {/* Questions */}
        {!loading && (
          <div className="space-y-3">
            {filtered.length === 0 && !error && (
              <div className="rounded-2xl p-10 text-center" style={{ background: "#1F1F1F" }}>
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: "#39FF14" }} />
                <p className="text-white font-bold">
                  {search ? "Sin resultados" : "Todo respondido"}
                </p>
              </div>
            )}
            {filtered.map(q => (
              <QuestionCard key={q.id} q={q} onAnswered={handleAnswered} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function MensajesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#121212" }}>
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "#FF5722" }} />
      </div>
    }>
      <MensajesInner />
    </Suspense>
  );
}
