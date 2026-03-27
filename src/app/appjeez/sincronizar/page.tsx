"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Copy, CheckCircle2, AlertCircle,
  AlertTriangle, ChevronDown, ChevronUp, Zap, Package,
  SkipForward, XCircle, Store, Search, Bell, BellOff,
  Square, Play, RotateCcw,
} from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

interface MeliItemPreview {
  id:                 string;
  title:              string;
  price:              number;
  currency_id:        string;
  available_quantity: number;
  sold_quantity:      number;
  thumbnail:          string | null;
  status:             string;
  permalink:          string;
  category_id?:       string;
  category_name?:     string;
}
interface AccountInfo { id: string; nickname: string; total: number; }
interface CompareData {
  origin:         AccountInfo;
  dest:           AccountInfo;
  can_clone:      MeliItemPreview[];
  already_exists: MeliItemPreview[];
  filter_applied: { category_ids: string[]; count: number } | null;
  summary:        { origin_total: number; dest_total: number; can_clone: number; already_exists: number };
}
interface Account { id: string; nickname: string; meli_user_id: string; }
interface CategoryOption { id: string; name: string; count: number; }
interface ErrorEntry {
  item_id:      string;
  title:        string;
  reason_code:  string;
  reason_human: string;
  suggestion:   string;
}
interface SyncSummary { cloned: number; skipped: number; errors: number; }

function downloadErrorCSV(errors: ErrorEntry[]) {
  if (!errors.length) return;
  const header = "ID Original,Título,Motivo,Sugerencia\n";
  const rows = errors.map(e =>
    `"${e.item_id}","${(e.title ?? "").replace(/"/g, '""')}","${e.reason_human}","${e.suggestion}"`
  ).join("\n");
  const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `errores-sync-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function ItemRow({
  item, selected, onToggle,
}: { item: MeliItemPreview; selected: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
      style={{
        background: selected ? "#FFE60012" : "#121212",
        border:     selected ? "1px solid #FFE60044" : "1px solid rgba(255,255,255,0.05)",
      }}>
      <div
        className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-all"
        style={{ borderColor: selected ? "#FFE600" : "#4B5563", background: selected ? "#FFE600" : "transparent" }}>
        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-black" />}
      </div>
      {item.thumbnail
        ? <img src={item.thumbnail} alt="" className="w-10 h-10 rounded-lg object-contain flex-shrink-0" style={{ background: "#1a1a1a" }} />
        : <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#1a1a1a" }}>
            <Package className="w-4 h-4 text-gray-600" />
          </div>
      }
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white font-medium line-clamp-1">{item.title}</p>
        <p className="text-[10px] mt-0.5" style={{ color: "#6B7280" }}>
          {fmt(item.price)} · Stock: {item.available_quantity} · Vendidos: {item.sold_quantity}
        </p>
        {item.category_name && (
          <p className="text-[10px] mt-0.5 font-semibold" style={{ color: "#FFE600" }}>
            {item.category_name}
          </p>
        )}
      </div>
    </div>
  );
}

function SyncInner() {
  const [accounts,    setAccounts]    = useState<Account[]>([]);
  const [originId,    setOriginId]    = useState("");
  const [destId,      setDestId]      = useState("");
  const [comparing,   setComparing]   = useState(false);
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [search,      setSearch]      = useState("");

  // ---- Category filter ----
  const [categories,        setCategories]        = useState<CategoryOption[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedCats,      setSelectedCats]      = useState<Set<string>>(new Set());
  const [showCatFilter,     setShowCatFilter]     = useState(false);

  // ---- Auto-sync SSE state ----
  const [autoSyncing,  setAutoSyncing]  = useState(false);
  const [stopping,     setStopping]     = useState(false);
  const [autoLog,      setAutoLog]      = useState<string[]>([]);
  const [syncMode,     setSyncMode]     = useState<"all" | "new_only">("all");
  const [jobId,        setJobId]        = useState<string | null>(null);
  const [autoSummary,  setAutoSummary]  = useState<SyncSummary | null>(null);
  const [errorReport,  setErrorReport]  = useState<ErrorEntry[]>([]);
  const [resumeJobId,  setResumeJobId]  = useState<string | null>(null);
  const [progress,     setProgress]     = useState<SyncSummary | null>(null);
  const [notifPerm,    setNotifPerm]    = useState<NotificationPermission>("default");
  const [openErrors,   setOpenErrors]   = useState(false);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Load accounts and check for paused job
  useEffect(() => {
    fetch("/api/meli-accounts")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setAccounts(d); })
      .catch(() => {});

    fetch("/api/meli-sync/auto-sync/resume")
      .then(r => r.json())
      .then(d => { if (d?.job?.id) setResumeJobId(d.job.id); })
      .catch(() => {});

    if (typeof Notification !== "undefined") setNotifPerm(Notification.permission);
  }, []);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [autoLog]);

  const addLog = (msg: string) => setAutoLog(prev => [...prev.slice(-199), msg]);

  // ---- Start SSE sync (auto or manual) ----
  const startSync = useCallback(async (options?: { resumeId?: string; itemIds?: string[] }) => {
    setAutoSyncing(true);
    setStopping(false);
    setAutoLog([]);
    setAutoSummary(null);
    setErrorReport([]);
    setProgress(null);

    const payload: Record<string, unknown> = { mode: syncMode };
    if (options?.resumeId) payload.resume_job_id = options.resumeId;
    if (originId && destId) { payload.origin_id = originId; payload.dest_id = destId; }
    if (options?.itemIds)   payload.item_ids = options.itemIds;

    try {
      const res = await fetch("/api/meli-sync/auto-sync", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });

      if (!res.ok || !res.body) {
        addLog(`Error al iniciar: HTTP ${res.status}`);
        setAutoSyncing(false);
        return;
      }

      const reader = res.body.getReader();
      readerRef.current = reader;
      const dec = new TextDecoder();
      let buffer = "";

      const processLine = (line: string) => {
        if (line.startsWith("event: ")) return; // handled via next data line
      };

      let currentEvent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const payload = JSON.parse(line.slice(6));
              handleSSEEvent(currentEvent, payload);
            } catch { processLine(line); }
            currentEvent = "";
          }
        }
      }
    } catch (e) {
      addLog(`Conexión interrumpida: ${(e as Error).message}`);
    } finally {
      setAutoSyncing(false);
      setStopping(false);
      readerRef.current = null;
    }
  }, [syncMode, originId, destId]);

  const handleSSEEvent = (event: string, data: Record<string, unknown>) => {
    switch (event) {
      case "jobId":
        setJobId(data.job_id as string);
        break;
      case "log":
        addLog(data.msg as string);
        break;
      case "progress":
        setProgress(data as unknown as SyncSummary);
        break;
      case "done": {
        const s = data.summary as SyncSummary;
        setAutoSummary(s);
        setErrorReport((data.errors as ErrorEntry[]) ?? []);
        setResumeJobId(null);
        setJobId(null);
        // Browser notification if tab is hidden
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
          new Notification("Sincronización finalizada — Appjeez", {
            body: `${s.cloned} clonadas · ${s.skipped} omitidas · ${s.errors} errores`,
            icon: "/icon-192.png",
          });
        }
        break;
      }
      case "stopped": {
        const s = data.summary as SyncSummary;
        setAutoSummary(s);
        setResumeJobId(data.job_id as string);
        addLog("⏸ Proceso detenido. Podés retomarlo desde donde quedó.");
        break;
      }
      case "error":
        addLog(`❌ Error: ${data.message}`);
        break;
    }
  };

  // ---- Stop ----
  const stopSync = useCallback(async () => {
    if (!jobId) return;
    setStopping(true);
    addLog("Enviando señal de detención...");
    await fetch("/api/meli-sync/auto-sync/stop", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ job_id: jobId }),
    }).catch(() => {});
  }, [jobId]);

  // ---- Notifications ----
  const requestNotifPermission = async () => {
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

  // ---- Manual compare/clone (existing) ----
  const loadCategories = useCallback((accId: string) => {
    if (!accId) { setCategories([]); setSelectedCats(new Set()); return; }
    setLoadingCategories(true);
    fetch(`/api/meli-sync/categories?account_id=${accId}`)
      .then(r => r.json())
      .then((d: CategoryOption[]) => {
        if (Array.isArray(d)) {
          setCategories(d);
          setSelectedCats(new Set(d.map(c => c.id))); // all selected by default
          setShowCatFilter(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCategories(false));
  }, []);

  const handleCompare = useCallback(async () => {
    if (!originId || !destId || originId === destId) return;
    setComparing(true); setCompareData(null); setCompareError(null);
    setSelected(new Set());
    try {
      const catParam = selectedCats.size > 0 && selectedCats.size < categories.length
        ? `&category_ids=${Array.from(selectedCats).join(",")}`
        : "";
      const res = await fetch(`/api/meli-sync/compare?origin_id=${originId}&dest_id=${destId}${catParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCompareData(await res.json());
    } catch (e) { setCompareError((e as Error).message); }
    finally { setComparing(false); }
  }, [originId, destId, selectedCats, categories.length]);

  const toggleItem = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const selectAll   = () => setSelected(new Set(filtered.map(i => i.id)));
  const deselectAll = () => setSelected(new Set());

  const filtered = (compareData?.can_clone ?? []).filter(i =>
    i.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleClone = useCallback((_itemIds: string[]) => { /* unified into startSync */ }, []);

  const [openAlready, setOpenAlready] = useState(false);

  return (
    <main className="min-h-screen pb-24" style={{ background: "#121212" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b"
        style={{ background: "rgba(18,18,18,0.97)", backdropFilter: "blur(16px)", borderColor: "rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <Link href="/appjeez" className="p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="font-black text-white text-base flex items-center gap-2">
              <Copy className="w-5 h-5" style={{ color: "#FFE600" }} /> Sincronizar Cuentas
            </h1>
            <p className="text-[10px]" style={{ color: "#6B7280" }}>Clona publicaciones entre tus cuentas MeLi</p>
          </div>
        </div>
        {/* Notification toggle */}
        <button
          onClick={requestNotifPermission}
          className="p-2 rounded-lg"
          style={{ background: notifPerm === "granted" ? "#22c55e18" : "rgba(255,255,255,0.05)" }}
          title={notifPerm === "granted" ? "Notificaciones activas" : "Activar notificaciones"}>
          {notifPerm === "granted"
            ? <Bell className="w-4 h-4" style={{ color: "#22c55e" }} />
            : <BellOff className="w-4 h-4 text-gray-500" />}
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">

        {/* ===================== SYNC AUTOMÁTICO ===================== */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5" style={{ color: "#39FF14" }} />
            <div className="flex-1">
              <p className="text-sm font-black text-white">Sincronización Automática</p>
              <p className="text-[10px]" style={{ color: "#6B7280" }}>
                Detecta la cuenta con más publicaciones y clona a todas las demás
              </p>
            </div>
          </div>

          {/* Modo selector */}
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "#6B7280" }}>MODO</label>
            <select
              value={syncMode}
              onChange={e => setSyncMode(e.target.value as "all" | "new_only")}
              disabled={autoSyncing}
              className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white"
              style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}>
              <option value="all">Sincronización completa</option>
              <option value="new_only">Solo publicaciones nuevas (más rápido)</option>
            </select>
          </div>

          {/* Botón Start/Stop dinámico */}
          {!autoSyncing ? (
            <div className="space-y-2">
              <button
                onClick={() => startSync()}
                disabled={accounts.length < 2}
                className="w-full py-3 rounded-xl font-black text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: "#39FF14", color: "#121212" }}>
                <Play className="w-4 h-4" />
                Sincronizar Todas las Cuentas ({accounts.length})
              </button>

              {/* Botón Retomar (si hay job pausado) */}
              {resumeJobId && (
                <button
                  onClick={() => startSync({ resumeId: resumeJobId ?? undefined })}
                  className="w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2"
                  style={{ background: "#FFE600", color: "#121212" }}>
                  <RotateCcw className="w-4 h-4" />
                  Retomar donde quedó
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={stopSync}
              disabled={stopping}
              className="w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2"
              style={{ background: stopping ? "#4B5563" : "#ef4444", color: "white" }}>
              {stopping
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Deteniendo...</>
                : <><Square className="w-4 h-4" /> DETENER PROCESO</>}
            </button>
          )}

          {/* Progreso en tiempo real */}
          {autoSyncing && progress && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Clonadas",  val: progress.cloned,  color: "#39FF14" },
                { label: "Omitidas",  val: progress.skipped, color: "#FF9800" },
                { label: "Errores",   val: progress.errors,  color: "#ef4444" },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "#121212", border: `1px solid ${s.color}22` }}>
                  <p className="text-xl font-black" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[10px] font-bold" style={{ color: "#6B7280" }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Log console */}
          {autoLog.length > 0 && (
            <div className="rounded-xl p-3 max-h-60 overflow-y-auto space-y-1" style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.05)" }}>
              {autoLog.map((line, i) => (
                <p key={i} className="text-[11px] font-mono" style={{
                  color: line.startsWith("===")   ? "#FFE600"
                       : line.startsWith("❌")    ? "#ef4444"
                       : line.startsWith("⚠️")   ? "#FF9800"
                       : line.startsWith("✓")     ? "#39FF14"
                       : line.startsWith("⏸")    ? "#60a5fa"
                       : line.includes("clonadas") ? "#39FF14"
                       : "#9CA3AF",
                }}>{line}</p>
              ))}
              <div ref={logEndRef} />
            </div>
          )}

          {/* Resumen final */}
          {autoSummary && !autoSyncing && (
            <div className="rounded-xl p-4" style={{ background: "#121212", border: "1px solid #39FF1433" }}>
              <p className="text-xs font-black text-white mb-3">Resultado final</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Clonadas",  val: autoSummary.cloned,  color: "#39FF14" },
                  { label: "Omitidas",  val: autoSummary.skipped, color: "#FF9800" },
                  { label: "Errores",   val: autoSummary.errors,  color: "#ef4444" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-2xl font-black" style={{ color: s.color }}>{s.val}</p>
                    <p className="text-[10px]" style={{ color: "#6B7280" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ===================== TABLA DE ERRORES ===================== */}
        {errorReport.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: "#1F1F1F", border: "1px solid #ef444422" }}>
            <button
              onClick={() => setOpenErrors(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4" style={{ color: "#ef4444" }} />
                <span className="text-sm font-bold text-white">
                  {errorReport.length} errores de clonación
                </span>
              </div>
              {openErrors ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {openErrors && (
              <div className="px-4 pb-4 space-y-3 max-h-96 overflow-y-auto">
                {errorReport.map((err, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-xs text-white font-semibold line-clamp-1 mb-1">{err.title || err.item_id}</p>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "#ef444420", color: "#ef4444" }}>
                        {err.reason_human}
                      </span>
                    </div>
                    <p className="text-[10px]" style={{ color: "#9CA3AF" }}>{err.suggestion}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================== SELECTOR DE CUENTAS (manual) ===================== */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-sm font-black text-white">Comparar Manualmente</p>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold mb-1.5 block" style={{ color: "#6B7280" }}>CUENTA ORIGEN (de donde se copian)</label>
              <select
                value={originId}
                onChange={e => {
                    const v = e.target.value;
                    setOriginId(v); setCompareData(null);
                    loadCategories(v);
                  }}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white"
                style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}>
                <option value="">— Seleccionar cuenta origen —</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id} disabled={a.id === destId}>{a.nickname}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full" style={{ background: "#FFE60018", border: "1px solid #FFE60033" }}>
                <Copy className="w-3.5 h-3.5" style={{ color: "#FFE600" }} />
                <span className="text-xs font-bold" style={{ color: "#FFE600" }}>copia hacia</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold mb-1.5 block" style={{ color: "#6B7280" }}>CUENTA DESTINO (donde se publican)</label>
              <select
                value={destId}
                onChange={e => { setDestId(e.target.value); setCompareData(null); }}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white"
                style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}>
                <option value="">— Seleccionar cuenta destino —</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id} disabled={a.id === originId}>{a.nickname}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category filter */}
          {originId && (
            <div className="rounded-xl overflow-hidden" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.07)" }}>
              <button
                onClick={() => setShowCatFilter(s => !s)}
                className="w-full flex items-center justify-between px-3 py-2.5">
                <span className="text-xs font-bold" style={{ color: "#6B7280" }}>
                  FILTRAR POR CATEGORÍA (opcional)
                  {selectedCats.size < categories.length && selectedCats.size > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px]"
                      style={{ background: "#FFE60020", color: "#FFE600" }}>
                      {selectedCats.size}/{categories.length} selec.
                    </span>
                  )}
                </span>
                {loadingCategories
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: "#6B7280" }} />
                  : showCatFilter
                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                    : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                }
              </button>
              {showCatFilter && categories.length > 0 && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => setSelectedCats(new Set(categories.map(c => c.id)))}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg"
                      style={{ background: "#FFE60018", color: "#FFE600" }}>Todas</button>
                    <button onClick={() => setSelectedCats(new Set())}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg"
                      style={{ background: "#1a1a1a", color: "#6B7280" }}>Ninguna</button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {categories.map(cat => (
                      <label key={cat.id}
                        className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all"
                        style={{
                          background: selectedCats.has(cat.id) ? "#FFE60008" : "transparent",
                          border: `1px solid ${selectedCats.has(cat.id) ? "#FFE60030" : "rgba(255,255,255,0.04)"}`,
                        }}>
                        <div
                          className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition-all"
                          style={{
                            borderColor: selectedCats.has(cat.id) ? "#FFE600" : "#4B5563",
                            background:  selectedCats.has(cat.id) ? "#FFE600" : "transparent",
                          }}>
                          {selectedCats.has(cat.id) && <CheckCircle2 className="w-2.5 h-2.5 text-black" />}
                        </div>
                        <input type="checkbox" className="hidden"
                          checked={selectedCats.has(cat.id)}
                          onChange={() => setSelectedCats(prev => {
                            const next = new Set(prev);
                            next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
                            return next;
                          })} />
                        <span className="flex-1 text-xs text-white">{cat.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: "#1F1F1F", color: "#9CA3AF" }}>
                          {cat.count}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {showCatFilter && categories.length === 0 && !loadingCategories && (
                <p className="px-3 pb-3 text-xs" style={{ color: "#6B7280" }}>No se encontraron categorías.</p>
              )}
            </div>
          )}

          <button
            onClick={handleCompare}
            disabled={!originId || !destId || originId === destId || comparing}
            className="w-full py-3 rounded-xl font-black text-sm transition-all disabled:opacity-40"
            style={{ background: "#FFE600", color: "#121212" }}>
            {comparing
              ? <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Analizando publicaciones...</span>
              : selectedCats.size < categories.length && selectedCats.size > 0
                ? `Analizar — ${selectedCats.size} categoría(s) seleccionada(s)`
                : "Analizar y Comparar"}
          </button>
        </div>

        {/* Error */}
        {compareError && (
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: "#ef444418", border: "1px solid #ef444440" }}>
            <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#ef4444" }} />
            <p className="text-sm text-white">{compareError}</p>
          </div>
        )}

        {/* Resultado del análisis */}
        {compareData && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4 text-center" style={{ background: "#39FF1410", border: "1px solid #39FF1430" }}>
                <p className="text-3xl font-black" style={{ color: "#39FF14" }}>{compareData.summary.can_clone}</p>
                <p className="text-xs font-bold text-white mt-1">Pueden clonarse</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#6B7280" }}>No existen en destino</p>
              </div>
              <div className="rounded-2xl p-4 text-center" style={{ background: "#FF980010", border: "1px solid #FF980030" }}>
                <p className="text-3xl font-black" style={{ color: "#FF9800" }}>{compareData.summary.already_exists}</p>
                <p className="text-xs font-bold text-white mt-1">Ya existen</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#6B7280" }}>Título duplicado detectado</p>
              </div>
            </div>

            <div className="flex gap-3">
              {[compareData.origin, compareData.dest].map((acc, i) => (
                <div key={acc.id} className="flex-1 rounded-xl p-3 flex items-center gap-2"
                  style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Store className="w-4 h-4 flex-shrink-0" style={{ color: i === 0 ? "#00E5FF" : "#FFE600" }} />
                  <div>
                    <p className="text-xs font-bold text-white">{acc.nickname}</p>
                    <p className="text-[10px]" style={{ color: "#6B7280" }}>{acc.total} publicaciones</p>
                  </div>
                </div>
              ))}
            </div>

            {compareData.can_clone.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <p className="text-sm font-black text-white">Publicaciones a clonar</p>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "#FFE60018", color: "#FFE600" }}>Todas</button>
                    <button onClick={deselectAll} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "#1a1a1a", color: "#6B7280" }}>Ninguna</button>
                  </div>
                </div>

                <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#6B7280" }} />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar publicación..."
                      className="w-full pl-8 pr-3 py-2 rounded-lg text-xs text-white outline-none"
                      style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                  </div>
                </div>

                <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                  {filtered.map(item => (
                    <ItemRow key={item.id} item={item} selected={selected.has(item.id)} onToggle={() => toggleItem(item.id)} />
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-center py-4 text-xs" style={{ color: "#6B7280" }}>Sin resultados para &quot;{search}&quot;</p>
                  )}
                </div>

                <div className="p-4 border-t space-y-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <button
                    onClick={() => startSync({ itemIds: Array.from(selected) })}
                    disabled={selected.size === 0 || autoSyncing}
                    className="w-full py-3 rounded-xl font-black text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: "#39FF14", color: "#121212" }}>
                    {autoSyncing
                      ? <><RefreshCw className="w-4 h-4 animate-spin" /> Clonando...</>
                      : <><Copy className="w-4 h-4" /> Clonar seleccionadas ({selected.size})</>}
                  </button>
                  <button
                    onClick={() => startSync({ itemIds: compareData.can_clone.map(i => i.id) })}
                    disabled={autoSyncing}
                    className="w-full py-3 rounded-xl font-black text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: "#FFE600", color: "#121212" }}>
                    {autoSyncing
                      ? <><RefreshCw className="w-4 h-4 animate-spin" /> Clonando...</>
                      : <><Zap className="w-4 h-4" /> Sincronizar TODAS ({compareData.can_clone.length})</>}
                  </button>
                  {autoSyncing && (
                    <button
                      onClick={stopSync}
                      disabled={stopping}
                      className="w-full py-2.5 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2"
                      style={{ background: stopping ? "#4B5563" : "#ef4444", color: "white" }}>
                      {stopping ? <><RefreshCw className="w-4 h-4 animate-spin" /> Deteniendo...</> : <><Square className="w-4 h-4" /> DETENER</>}
                    </button>
                  )}
                </div>
              </div>
            )}

            {compareData.can_clone.length === 0 && (
              <div className="rounded-2xl p-8 text-center" style={{ background: "#1F1F1F" }}>
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: "#39FF14" }} />
                <p className="font-black text-white">Todo sincronizado</p>
                <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Todas las publicaciones de origen ya existen en destino</p>
              </div>
            )}

            {compareData.already_exists.length > 0 && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#1F1F1F", border: "1px solid #FF980022" }}>
                <button onClick={() => setOpenAlready(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" style={{ color: "#FF9800" }} />
                    <span className="text-sm font-bold text-white">
                      {compareData.already_exists.length} títulos ya existen en destino
                    </span>
                  </div>
                  {openAlready ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>
                {openAlready && (
                  <div className="px-4 pb-4 space-y-2 max-h-64 overflow-y-auto">
                    {compareData.already_exists.map(item => (
                      <div key={item.id} className="flex items-center gap-2 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                        <SkipForward className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#FF9800" }} />
                        {item.thumbnail && <img src={item.thumbnail} alt="" className="w-8 h-8 rounded-lg object-contain" style={{ background: "#121212" }} />}
                        <p className="text-xs text-white line-clamp-1">{item.title}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Botón limpiar comparación */}
        {compareData && autoSummary && !autoSyncing && (
          <button onClick={() => { setCompareData(null); setSelected(new Set()); setAutoSummary(null); setAutoLog([]); setErrorReport([]); }}
            className="w-full py-3 rounded-xl font-black text-sm"
            style={{ background: "#1F1F1F", color: "#FFE600", border: "1px solid #FFE60033" }}>
            Nueva Sincronización
          </button>
        )}
      </div>
    </main>
  );
}

export default function SincronizarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#121212" }}>
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "#FFE600" }} />
      </div>
    }>
      <SyncInner />
    </Suspense>
  );
}
