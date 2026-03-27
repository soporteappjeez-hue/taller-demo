"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft, Search, DollarSign, RefreshCw, AlertTriangle,
  XCircle, Tag, ShieldAlert, Eye, Percent, Plus, TrendingUp,
  Square, Play, Ban,
} from "lucide-react";

type AdjustmentType = "percentage" | "fixed_floor" | "fixed_add";

interface PriceResult {
  account: string;
  item_id: string;
  title: string;
  old_price: number;
  new_price: number;
  status: "updated" | "skipped" | "excluded" | "error" | "catalog_warning" | "promo_blocked";
  reason?: string;
  variations_updated?: number;
}

interface SseProgress {
  type: "progress";
  current: number; total: number;
  item_id: string; title: string;
  status: string; account: string;
  old_price?: number; new_price?: number;
  excluded_by?: string;
}
interface SseDone {
  type: "done" | "stopped";
  results: PriceResult[];
  summary: {
    total_items_scanned: number; cache_hits_skipped: number;
    matched: number; updated: number; skipped: number; excluded: number; errors: number; stopped: boolean;
  };
  adjustment_type: AdjustmentType;
  adjustment_value: number;
  dry_run: boolean;
}

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  updated:         { color: "#39FF14", label: "ACTUALIZADO" },
  catalog_warning: { color: "#FFE600", label: "CATÁLOGO" },
  skipped:         { color: "#4B5563", label: "OMITIDO" },
  excluded:        { color: "#F97316", label: "EXCLUIDO" },
  error:           { color: "#EF4444", label: "ERROR" },
  promo_blocked:   { color: "#A855F7", label: "EN PROMO" },
};

const ADJ_TYPES: Array<{
  value: AdjustmentType; label: string; desc: string;
  icon: React.ReactNode; color: string; placeholder: string; prefix: string;
}> = [
  { value: "fixed_floor", label: "Precio Piso",  desc: "Solo sube si está por debajo",
    icon: <TrendingUp className="w-4 h-4" />, color: "#39FF14", placeholder: "15000", prefix: "$" },
  { value: "percentage",  label: "Porcentaje",    desc: "Multiplica el precio actual",
    icon: <Percent className="w-4 h-4" />,   color: "#FFE600", placeholder: "10",    prefix: "%" },
  { value: "fixed_add",   label: "Suma Fija",     desc: "Agrega un monto exacto",
    icon: <Plus className="w-4 h-4" />,      color: "#00E5FF", placeholder: "500",   prefix: "$+" },
];

function PreciosInner() {
  const [keyword, setKeyword]           = useState("");
  const [excludeWords, setExcludeWords] = useState("");
  const [adjType, setAdjType]           = useState<AdjustmentType>("fixed_floor");
  const [adjValue, setAdjValue]         = useState("");
  const [dryRun, setDryRun]             = useState(false);
  const [accounts, setAccounts]         = useState<Array<{ meli_user_id: string; nickname: string }>>([]);
  const [selectedAcc, setSelectedAcc]   = useState("all");

  const [running, setRunning]           = useState(false);
  const [stopped, setStopped]           = useState(false);
  const [progress, setProgress]         = useState<SseProgress | null>(null);
  const [currentAcc, setCurrentAcc]     = useState("");
  const [totalInAcc, setTotalInAcc]     = useState(0);
  const [results, setResults]           = useState<PriceResult[]>([]);
  const [summary, setSummary]           = useState<SseDone["summary"] | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [clearCache, setClearCache]     = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/meli-accounts")
      .then(r => r.json())
      .then(d => setAccounts(Array.isArray(d) ? d : (d.accounts ?? [])))
      .catch(() => {});
  }, []);

  const activeCfg = ADJ_TYPES.find(t => t.value === adjType)!;

  const previewFormula = () => {
    const v = Number(adjValue);
    if (!v) return null;
    const sample = 10000;
    const r = adjType === "percentage" ? sample * (1 + v / 100) : adjType === "fixed_add" ? sample + v : v;
    return `Ej: $${sample.toLocaleString("es-AR")} → $${Math.round(r).toLocaleString("es-AR")}`;
  };

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setStopped(true);
  }, []);

  const run = useCallback(async (dry: boolean) => {
    if (!keyword.trim() || !adjValue) return;
    setRunning(true); setStopped(false);
    setError(null); setResults([]); setSummary(null); setProgress(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const payload: Record<string, unknown> = {
        keyword: keyword.trim(),
        exclude_words: excludeWords,
        adjustment_type: adjType,
        adjustment_value: Number(adjValue),
        dry_run: dry,
        clear_cache: clearCache,
      };
      if (selectedAcc !== "all") payload.account_ids = [selectedAcc];

      const res = await fetch("/api/meli-price-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf      = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const dataLine = line.replace(/^data:\s*/, "").trim();
          if (!dataLine) continue;
          try {
            const ev = JSON.parse(dataLine) as { type: string } & Record<string, unknown>;
            if (ev.type === "progress") {
              setProgress(ev as unknown as SseProgress);
            } else if (ev.type === "account_start") {
              setCurrentAcc(ev.account as string);
            } else if (ev.type === "account_total") {
              setTotalInAcc(ev.total as number);
            } else if (ev.type === "done" || ev.type === "stopped") {
              const final = ev as unknown as SseDone;
              setResults(final.results ?? []);
              setSummary(final.summary);
              if (ev.type === "stopped") setStopped(true);
            } else if (ev.type === "error") {
              setError(ev.message as string);
            }
          } catch { /* malformed line */ }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }, [keyword, excludeWords, adjType, adjValue, selectedAcc]);

  const progressPct = progress && totalInAcc > 0
    ? Math.round((progress.current / totalInAcc) * 100)
    : 0;

  const formula = previewFormula();

  return (
    <main className="min-h-screen pb-24" style={{ background: "#121212" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3 border-b"
        style={{ background: "rgba(18,18,18,0.97)", backdropFilter: "blur(16px)", borderColor: "rgba(255,255,255,0.07)" }}>
        <Link href="/appjeez" className="p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div>
          <h1 className="font-black text-white text-base flex items-center gap-2">
            <DollarSign className="w-5 h-5" style={{ color: "#39FF14" }} /> Actualizar Precios
          </h1>
          <p className="text-[10px]" style={{ color: "#6B7280" }}>Ajuste masivo por palabra clave</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">

        {/* Formulario */}
        <div className="rounded-2xl p-4 space-y-4"
          style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>

          {/* Palabra clave */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-1.5 block">Palabra clave en el título</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#6B7280" }} />
              <input value={keyword} onChange={e => setKeyword(e.target.value)}
                placeholder='Ej: "Cardan", "Kit Cadena"'
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }} />
            </div>
            <p className="text-[10px] mt-1" style={{ color: "#6B7280" }}>Sin distinción de mayúsculas, tildes ni espacios</p>
          </div>

          {/* Palabras excluyentes */}
          <div>
            <label className="text-xs font-bold mb-1.5 flex items-center gap-1.5"
              style={{ color: "#F97316" }}>
              <Ban className="w-3.5 h-3.5" /> Palabras excluyentes (opcional)
            </label>
            <input value={excludeWords} onChange={e => setExcludeWords(e.target.value)}
              placeholder='Ej: "usado, roto, servicio, cruceta"  (separadas por coma)'
              className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
              style={{ background: "#121212", border: "1px solid #F9741633" }} />
            <p className="text-[10px] mt-1" style={{ color: "#6B7280" }}>
              Si el título contiene alguna de estas palabras, la publicación se omite aunque coincida con la clave
            </p>
          </div>

          {/* Limpiar caché */}
          <button onClick={() => setClearCache(v => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
            style={{ background: clearCache ? "#EF444418" : "#121212", border: `1px solid ${clearCache ? "#EF444455" : "rgba(255,255,255,0.08)"}` }}>
            <div className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border"
              style={{ background: clearCache ? "#EF4444" : "transparent", borderColor: clearCache ? "#EF4444" : "#4B5563" }}>
              {clearCache && <span className="text-white text-[10px] font-black">✓</span>}
            </div>
            <div className="text-left">
              <p className="text-xs font-black" style={{ color: clearCache ? "#EF4444" : "#9CA3AF" }}>Limpiar caché de esta keyword</p>
              <p className="text-[10px]" style={{ color: "#6B7280" }}>Vuelve a revisar TODAS las publicaciones, incluso las ya escaneadas</p>
            </div>
          </button>

          {/* Tipo de ajuste */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block">Tipo de ajuste</label>
            <div className="grid grid-cols-3 gap-2">
              {ADJ_TYPES.map(t => (
                <button key={t.value} onClick={() => setAdjType(t.value)}
                  className="p-3 rounded-xl text-center transition-all border"
                  style={adjType === t.value
                    ? { background: `${t.color}18`, borderColor: t.color, color: t.color }
                    : { background: "#121212", borderColor: "rgba(255,255,255,0.08)", color: "#6B7280" }}>
                  <div className="flex justify-center mb-1">{t.icon}</div>
                  <p className="text-[11px] font-black">{t.label}</p>
                  <p className="text-[9px] mt-0.5 leading-tight">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Valor */}
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "#6B7280" }}>Valor del ajuste</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black"
                style={{ color: activeCfg.color }}>{activeCfg.prefix}</span>
              <input type="number" min="0" step="any"
                value={adjValue} onChange={e => setAdjValue(e.target.value)}
                placeholder={activeCfg.placeholder}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: "#121212", border: `1px solid ${activeCfg.color}44` }} />
            </div>
            {formula && <p className="text-[10px] mt-1 font-bold" style={{ color: activeCfg.color }}>{formula}</p>}
          </div>

          {/* Cuentas */}
          <div>
            <label className="text-xs font-bold text-gray-400 mb-2 block">Cuentas</label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelectedAcc("all")}
                className="px-3 py-1.5 rounded-xl text-xs font-black transition-all border"
                style={selectedAcc === "all"
                  ? { background: "#FFE600", color: "#121212", borderColor: "#FFE600" }
                  : { background: "transparent", color: "#9CA3AF", borderColor: "rgba(255,255,255,0.15)" }}>
                ★ Todas
              </button>
              {accounts.map(a => (
                <button key={a.meli_user_id} onClick={() => setSelectedAcc(String(a.meli_user_id))}
                  className="px-3 py-1.5 rounded-xl text-xs font-black transition-all border"
                  style={selectedAcc === String(a.meli_user_id)
                    ? { background: "#39FF14", color: "#121212", borderColor: "#39FF14" }
                    : { background: "transparent", color: "#9CA3AF", borderColor: "rgba(255,255,255,0.15)" }}>
                  {a.nickname}
                </button>
              ))}
            </div>
          </div>

          {/* Info tipo */}
          <div className="rounded-xl p-3 flex items-start gap-2"
            style={{ background: `${activeCfg.color}10`, border: `1px solid ${activeCfg.color}25` }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: activeCfg.color }} />
            <p className="text-xs" style={{ color: activeCfg.color }}>
              {adjType === "fixed_floor" && "Solo actualiza publicaciones cuyo precio sea MENOR al valor ingresado."}
              {adjType === "percentage"  && "Multiplica el precio de TODAS las coincidencias (incluye variaciones)."}
              {adjType === "fixed_add"   && "Suma el monto exacto al precio de TODAS las coincidencias."}
            </p>
          </div>

          {/* Botones Start/Stop */}
          {!running ? (
            <div className="flex gap-2">
              <button onClick={() => run(true)}
                disabled={!keyword.trim() || !adjValue}
                className="flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: "#1a1a1a", color: "#FFE600", border: "1px solid #FFE60033" }}>
                <Eye className="w-4 h-4" /> Vista previa
              </button>
              <button onClick={() => run(false)}
                disabled={!keyword.trim() || !adjValue}
                className="flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: activeCfg.color, color: "#121212" }}>
                <Play className="w-4 h-4" /> Aplicar cambios
              </button>
            </div>
          ) : (
            <button onClick={handleStop}
              className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all animate-pulse"
              style={{ background: "#EF4444", color: "white" }}>
              <Square className="w-4 h-4" /> DETENER PROCESO
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "#ef444418", border: "1px solid #ef444440" }}>
            <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#ef4444" }} />
            <p className="text-sm text-white">{error}</p>
          </div>
        )}

        {/* Progreso en tiempo real */}
        {running && (
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" style={{ color: "#39FF14" }} />
                {currentAcc ? `Procesando: ${currentAcc}` : "Iniciando..."}
              </p>
              {totalInAcc > 0 && (
                <span className="text-xs font-bold" style={{ color: "#6B7280" }}>
                  {progress?.current ?? 0}/{totalInAcc}
                </span>
              )}
            </div>

            {/* Barra de progreso */}
            {totalInAcc > 0 && (
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "#2A2A2A" }}>
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%`, background: activeCfg.color }} />
              </div>
            )}

            {/* Ítem actual */}
            {progress && (
              <div className="rounded-xl px-3 py-2" style={{ background: "#121212" }}>
                <div className="flex items-center gap-2 mb-1">
                  {progress.status === "excluded"
                    ? <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: "#F9741625", color: "#F97316" }}>EXCLUIDO</span>
                    : progress.status === "updating" || progress.status === "would_update"
                      ? <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: "#39FF1422", color: "#39FF14" }}>COINCIDE</span>
                      : <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: "#1a1a1a", color: "#4B5563" }}>SIN COINCIDENCIA</span>}
                  {progress.excluded_by && (
                    <span className="text-[10px]" style={{ color: "#F97316" }}>por: &quot;{progress.excluded_by}&quot;</span>
                  )}
                </div>
                <p className="text-xs text-white line-clamp-1">{progress.title}</p>
                {progress.old_price != null && progress.new_price != null && (
                  <p className="text-[10px] mt-0.5 font-bold" style={{ color: activeCfg.color }}>
                    ${progress.old_price.toLocaleString("es-AR")} → ${progress.new_price.toLocaleString("es-AR")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Resumen final */}
        {summary && !running && (
          <>
            {(summary.stopped || stopped) && (
              <div className="rounded-xl px-4 py-3 flex items-center gap-2"
                style={{ background: "#EF444418", border: "1px solid #EF444430" }}>
                <Square className="w-4 h-4" style={{ color: "#EF4444" }} />
                <p className="text-sm font-black" style={{ color: "#EF4444" }}>
                  Proceso detenido — {summary.updated} actualizados hasta el momento
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Actualizados", val: summary.updated,  color: "#39FF14" },
                { label: "Excluidos",    val: summary.excluded, color: "#F97316" },
                { label: "Omitidos",     val: summary.skipped,  color: "#6B7280" },
                { label: "Errores",      val: summary.errors,   color: "#EF4444" },
              ].map(s => (
                <div key={s.label} className="rounded-2xl p-3 text-center"
                  style={{ background: "#1F1F1F", border: `1px solid ${s.color}22` }}>
                  <p className="text-2xl font-black" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[10px] font-bold text-white">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Lista resultados */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <p className="text-sm font-bold text-white">{results.length} publicaciones con &quot;{keyword}&quot;</p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {results.map((r, i) => {
                  const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.error;
                  const diff = r.new_price - r.old_price;
                  return (
                    <div key={`${r.item_id}-${i}`}
                      className="px-4 py-3 space-y-1 border-b last:border-0"
                      style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                          style={{ background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}44` }}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "#FFE60018", color: "#FFE600" }}>{r.account}</span>
                        {r.variations_updated != null && r.variations_updated > 0 && (
                          <span className="text-[10px] text-gray-500">
                            <Tag className="w-3 h-3 inline mr-0.5" />{r.variations_updated} vars
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white line-clamp-1">{r.title}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span style={{ color: "#6B7280" }}>${r.old_price.toLocaleString("es-AR")}</span>
                        {r.status !== "skipped" && r.status !== "excluded" && (
                          <>
                            <span style={{ color: "#6B7280" }}>→</span>
                            <span className="font-black" style={{ color: "#39FF14" }}>
                              ${r.new_price.toLocaleString("es-AR")}
                            </span>
                            {diff !== 0 && (
                              <span className="text-[10px] font-bold" style={{ color: diff > 0 ? "#39FF14" : "#ef4444" }}>
                                ({diff > 0 ? "+" : ""}{diff.toLocaleString("es-AR")})
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {r.reason && (
                        <p className="text-[10px] flex items-center gap-1"
                          style={{ color: r.status === "catalog_warning" ? "#FFE600" : r.status === "excluded" ? "#F97316" : "#6B7280" }}>
                          {r.status === "catalog_warning" && <ShieldAlert className="w-3 h-3" />}
                          {r.status === "excluded" && <Ban className="w-3 h-3" />}
                          {r.reason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function PreciosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#121212" }}>
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "#39FF14" }} />
      </div>
    }>
      <PreciosInner />
    </Suspense>
  );
}
