"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FlexZona, FLEX_LOCALIDADES } from "@/lib/types";
import { flexDb } from "@/lib/db";
import {
  X, Camera, Search, ChevronRight,
  CheckCircle2, Loader2, Save, DollarSign, TrendingUp, Package,
  AlertTriangle, Trash2,
} from "lucide-react";

const MAX = 50;

const ZONA_COLORS: Record<FlexZona, string> = {
  cercana: "bg-green-500/20 text-green-300 border-green-500/40",
  media:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  lejana:  "bg-red-500/20 text-red-300 border-red-500/40",
};
const ZONA_LABELS: Record<FlexZona, string> = { cercana: "Cercana", media: "Media", lejana: "Lejana" };
const fmt = (n: number) => "$" + n.toLocaleString("es-AR");

function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// AudioContext compartido — debe crearse desde un gesto del usuario
let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx || _audioCtx.state === "closed") {
      _audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    return _audioCtx;
  } catch (_) { return null; }
}

// Beep simple: un tono corto y agudo (funciona en iOS y Android)
function beep() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.18);
  } catch (_) {}
}

// Beep error: dos tonos graves cortos
function beepError() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    [0, 0.22].forEach(offset => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 330;
      gain.gain.setValueAtTime(0.35, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.15);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t + offset); osc.stop(t + offset + 0.15);
    });
  } catch (_) {}
}

// ─── Base de datos oficial ML Flex ───────────────────────────────────────────
const CP_MAP: Record<string, string> = {
  "1804": "Ezeiza",
  "1842": "Esteban Echeverría",
  "1759": "La Matanza Sur", "1761": "La Matanza Sur",
  "1870": "Avellaneda",
  "1824": "Lanús",
  "1832": "Lomas de Zamora",
  "1878": "Quilmes",
  "1880": "Berazategui", "1884": "Berazategui",
  "1888": "Florencio Varela",
  "1846": "Alte. Brown",
  "1650": "San Martín",
  "1675": "Tres de Febrero",
  "1708": "Morón",
  "1686": "Hurlingham",
  "1714": "Ituzaingó",
  "1663": "San Miguel",
  "1642": "San Isidro",
  "1602": "Vicente López",
  "1644": "San Fernando",
  "1648": "Tigre",
  "1613": "Malvinas Argentinas",
  "1665": "José C. Paz",
  "1722": "Merlo",
  "1744": "Moreno",
  "1629": "Pilar",
  "1625": "Escobar",
  "1900": "La Plata Centro",
  "1925": "Ensenada",
  "1923": "Berisso",
  "6700": "Luján",
  "1748": "Gral. Rodríguez",
  "1727": "Marcos Paz",
  "1806": "Cañuelas",
  "1865": "San Vicente",
  "1862": "Guernica",
  "2804": "Campana",
  "2800": "Zárate",
};

// Detectar localidad por CP — CABA por rango 1000-1499
// Prioridad ABSOLUTA sobre detección por nombre de texto.
function detectCPFromText(text: string): string | null {
  // Normalizar: quitar espacios entre dígitos que el OCR a veces inserta (ej: "1 8 0 4" → "1804")
  const normalized = text.replace(/(\d)\s+(\d)/g, "$1$2")
                         .replace(/(\d)\s+(\d)/g, "$1$2"); // segunda pasada por si hay 3+ espacios

  const patterns = [
    /CP[:\s.]*(\d{4,5})/i,
    /C\.P\.[:\s]*(\d{4,5})/i,
    /\bCP(\d{4,5})\b/i,
    /\b(\d{4,5})\b/g,
  ];

  for (const pattern of patterns) {
    if (pattern.flags.includes("g")) {
      const re = new RegExp(pattern.source, pattern.flags);
      let match = re.exec(normalized);
      while (match !== null) {
        const num = match[1].length === 5 ? match[1].slice(0, 4) : match[1]; // tomar primeros 4 dígitos
        const cp = parseInt(num, 10);
        if (cp >= 1000 && cp <= 1499) return "CABA";
        const loc = CP_MAP[num];
        if (loc) return loc;
        match = re.exec(normalized);
      }
    } else {
      const match = normalized.match(pattern);
      if (match) {
        const num = match[1].length === 5 ? match[1].slice(0, 4) : match[1];
        const cp = parseInt(num, 10);
        if (cp >= 1000 && cp <= 1499) return "CABA";
        const loc = CP_MAP[num];
        if (loc) return loc;
      }
    }
  }
  return null;
}

function detectLocalidadFromText(text: string): string | null {
  const upper = text.toUpperCase().replace(/\n/g, " ").replace(/\s+/g, " ");

  // 1. CP tiene PRIORIDAD ABSOLUTA — más confiable que el texto
  const byCP = detectCPFromText(upper);
  if (byCP) return byCP;

  // 2. Aliases con prioridad explícita (sin sort por longitud que cause colisiones)
  //    EZEIZA va PRIMERO para que no sea pisado por ENSENADA
  const aliases: [RegExp, string][] = [
    [/\bEZEIZA\b/, "Ezeiza"],
    [/\bFLORENCIO\s+VARELA\b/, "Florencio Varela"],
    [/\bFLORENCIO\b/, "Florencio Varela"],
    [/\bTRES\s+DE\s+FEBRERO\b/, "Tres de Febrero"],
    [/\bMARCOS\s+PAZ\b/, "Marcos Paz"],
    [/\bJOSE\s+C\.?\s*PAZ\b/, "José C. Paz"],
    [/\bALTE\.?\s*BROWN\b/, "Alte. Brown"],
    [/\bALMIRANTE\s+BROWN\b/, "Alte. Brown"],
    [/\bGRAL\.?\s*RODRIGUEZ\b/, "Gral. Rodríguez"],
    [/\bGENERAL\s+RODRIGUEZ\b/, "Gral. Rodríguez"],
    [/\bLOMAS\s+DE\s+ZAMORA\b/, "Lomas de Zamora"],
    [/\bSAN\s+MARTIN\b/, "San Martín"],
    [/\bSAN\s+ISIDRO\b/, "San Isidro"],
    [/\bSAN\s+FERNANDO\b/, "San Fernando"],
    [/\bSAN\s+MIGUEL\b/, "San Miguel"],
    [/\bSAN\s+VICENTE\b/, "San Vicente"],
    [/\bVICENTE\s+LOPEZ\b/, "Vicente López"],
    [/\bLA\s+PLATA\b/, "La Plata Centro"],
    [/\bITUZAINGO\b/, "Ituzaingó"],
    [/\bMORON\b/, "Morón"],
    [/\bLUJAN\b/, "Luján"],
    [/\bZARATE\b/, "Zárate"],
    [/\bCANUELAS\b/, "Cañuelas"],
    [/\bENSENADA\b/, "Ensenada"],    // ENSENADA va DESPUÉS de EZEIZA
    [/\bBERISSO\b/, "Berisso"],
    [/\bQUILMES\b/, "Quilmes"],
    [/\bLANUS\b/, "Lanús"],
    [/\bAVELLANEDA\b/, "Avellaneda"],
    [/\bBERAZATEGUI\b/, "Berazategui"],
    [/\bTIGRE\b/, "Tigre"],
    [/\bPILAR\b/, "Pilar"],
    [/\bCAMPANA\b/, "Campana"],
    [/\bGARIN\b/, "Garín"],
    [/\bNORDELTA\b/, "Nordelta"],
    [/\bESCOBAR\b/, "Escobar"],
    [/\bHURLINGHAM\b/, "Hurlingham"],
    [/\bMERLO\b/, "Merlo"],
    [/\bMORENU\b/, "Moreno"],
    [/\bMORELO\b/, "Moreno"],
    [/\bMORENO\b/, "Moreno"],
    [/\bGUERNICA\b/, "Guernica"],
    [/\bMALVINAS\b/, "Malvinas Argentinas"],
    [/\bCABA\b/, "CABA"],
    [/\bBUENOS\s+AIRES\b/, "CABA"],
  ];

  for (const [regex, localidad] of aliases) {
    if (regex.test(upper)) return localidad;
  }

  return null;
}

// Extraer el ID de envío ML — número de 10-13 dígitos que no sea un CP (4 dígitos)
function extractEnvioId(rawText: string): string | null {
  // Normalizar espacios entre dígitos (OCR separa "4 6 7 1 9..." → "46719...")
  let text = rawText;
  let prev = "";
  while (prev !== text) {
    prev = text;
    text = text.replace(/(\d) (\d)/g, "$1$2");
  }

  // ÚNICA REGLA: capturar el número de 11 dígitos que aparece después de "Envío:"
  // Cubre: "Envío: 46719267146", "Envio:46719267146", "ENVIO 46719267146"
  const m = text.match(/[Ee][Nn][Vv][Ii\u00ED][Oo]\s*:?\s*(\d{11})/);
  if (m) return m[1];

  // Si no encontró "Envío" + 11 dígitos → no hay ID válido
  return null;
}

function calcPaquete(localidad: string, tarifas: Record<FlexZona, number>) {
  const loc = FLEX_LOCALIDADES.find(l => l.nombre === localidad);
  const zona: FlexZona = loc?.zona ?? "lejana";
  const precioML = tarifas[zona];
  return { zona, precioML, pagoFlete: Math.round(precioML * 0.8), ganancia: Math.round(precioML * 0.2) };
}

function preprocessCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const dst = document.createElement("canvas");
  dst.width = src.width; dst.height = src.height;
  const ctx = dst.getContext("2d")!;
  ctx.drawImage(src, 0, 0);
  const imgData = ctx.getImageData(0, 0, dst.width, dst.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const contrasted = Math.min(255, Math.max(0, ((gray - 50) / 170) * 255));
    d[i] = d[i + 1] = d[i + 2] = contrasted;
  }
  ctx.putImageData(imgData, 0, 0);
  return dst;
}

export interface PaqueteOCR {
  id: string;
  localidad: string;
  zona: FlexZona;
  precioML: number;
  pagoFlete: number;
  ganancia: number;
  fotoDataUrl: string;
  envioId: string | null;
  estado: "ok";
}

interface Props {
  tarifas: Record<FlexZona, number>;
  onFinish: (paquetes: PaqueteOCR[]) => void;
  onClose: () => void;
}

export default function OCRScanner({ tarifas, onFinish, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const workerRef   = useRef<unknown>(null);
  const scanningRef = useRef(false);   // flag para el loop de análisis en tiempo real
  const lastScanRef = useRef(0);

  const [paquetes, setPaquetes]         = useState<PaqueteOCR[]>([]);
  const [camError, setCamError]         = useState("");
  const [capturing, setCapturing]       = useState(false);
  const [editIdx, setEditIdx]           = useState<number | null>(null);
  const [busqueda, setBusqueda]         = useState("");
  const [workerReady, setWorkerReady]   = useState(false);
  const [existingIds, setExistingIds]   = useState<Set<string>>(new Set());
  const [duplicateMsg, setDuplicateMsg] = useState<"" | "duplicado" | "sinid">("");

  // Estado del visor en tiempo real
  const [liveLocalidad, setLiveLocalidad] = useState<string | null>(null);
  const [liveEnvioId, setLiveEnvioId]     = useState<string | null>(null);
  const [liveScan, setLiveScan]           = useState<"scanning" | "found" | "notfound">("scanning");

  const localidadesFiltradas = busqueda.trim()
    ? FLEX_LOCALIDADES.filter(l => l.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : FLEX_LOCALIDADES;

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch (e: unknown) {
      setCamError("No se pudo acceder a la cámara: " + (e instanceof Error ? e.message : String(e)));
    }
  }, []);

  // Inicializar Tesseract
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createWorker } = await import("tesseract.js");
        const w = await createWorker("eng+spa", 1, {
          workerPath: "https://unpkg.com/tesseract.js@5.1.1/dist/worker.min.js",
          langPath:   "https://tessdata.projectnaptha.com/4.0.0_fast",
          corePath:   "https://unpkg.com/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js",
          logger: () => {},
        });
        if (!cancelled) {
          await (w as unknown as { setParameters: (p: Record<string, string>) => Promise<void> }).setParameters({
            tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 :.-/",
          });
          workerRef.current = w;
          setWorkerReady(true);
        }
      } catch (_) {
        if (!cancelled) setWorkerReady(true);
      }
    })();
    return () => { cancelled = true; (workerRef.current as { terminate?: () => void })?.terminate?.(); };
  }, []);

  useEffect(() => { startCamera(); return () => stopCamera(); }, [startCamera, stopCamera]);

  // Cargar IDs existentes en Supabase para anti-duplicados
  useEffect(() => {
    flexDb.getAll().then(envios => {
      const ids = new Set(envios.map(e => e.nroSeguimiento).filter(Boolean) as string[]);
      setExistingIds(ids);
    }).catch(() => {});
  }, []);

  // ─── Loop de análisis en tiempo real (cada 1.5s) ─────────────────────────
  useEffect(() => {
    if (!workerReady) return;
    scanningRef.current = true;

    const loop = async () => {
      if (!scanningRef.current) return;

      const now = Date.now();
      if (now - lastScanRef.current < 1500) {
        requestAnimationFrame(loop);
        return;
      }
      lastScanRef.current = now;

      const video  = videoRef.current;
      const canvas = canvasRef.current;
      const worker = workerRef.current as { recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string } }> } | null;

      if (!video || !canvas || !worker || video.readyState < 2) {
        requestAnimationFrame(loop);
        return;
      }

      // Captura frame reducido (640px) para velocidad
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width  = Math.round(video.videoWidth  * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const processed = preprocessCanvas(canvas);
        const { data: { text } } = await worker.recognize(processed);
        const loc    = detectLocalidadFromText(text);
        const envId  = extractEnvioId(text);

        if (!scanningRef.current) return;

        if (loc) {
          setLiveLocalidad(loc);
          setLiveEnvioId(envId);
          setLiveScan("found");
        } else {
          setLiveLocalidad(null);
          setLiveEnvioId(null);
          setLiveScan("notfound");
        }
      } catch (_) {
        if (scanningRef.current) setLiveScan("scanning");
      }

      if (scanningRef.current) requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
    return () => { scanningRef.current = false; };
  }, [workerReady]);

  // ─── Capturar — solo guarda si hay zona válida, ID obligatorio y no es duplicado ───────────
  const capturar = useCallback(async () => {
    if (capturing || paquetes.length >= MAX) return;
    if (!liveLocalidad) return;

    // ── ID de envío OBLIGATORIO ──
    if (!liveEnvioId) {
      navigator.vibrate?.([80, 50, 80]);
      setDuplicateMsg("sinid");
      setTimeout(() => setDuplicateMsg(""), 2500);
      beepError();
      return;
    }

    // ── Anti-duplicados por ID de envío ──
    const yaEnLista    = paquetes.some(p => p.envioId === liveEnvioId);
    const yaEnSupabase = existingIds.has(liveEnvioId);
    if (yaEnLista || yaEnSupabase) {
      navigator.vibrate?.([80, 50, 80]);
      setDuplicateMsg("duplicado");
      setTimeout(() => setDuplicateMsg(""), 2500);
      beepError();
      return;
    }

    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    setCapturing(true);
    navigator.vibrate?.(60);

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    const fotoDataUrl = canvas.toDataURL("image/jpeg", 0.8);

    const calc    = calcPaquete(liveLocalidad, tarifas);
    const nuevo: PaqueteOCR = {
      id:           generateId(),
      localidad:    liveLocalidad,
      zona:         calc.zona as FlexZona,
      precioML:     calc.precioML,
      pagoFlete:    calc.pagoFlete,
      ganancia:     calc.ganancia,
      fotoDataUrl,
      envioId:      liveEnvioId,
      estado:       "ok",
    };
    setPaquetes(prev => [...prev, nuevo]);
    beep();
    setCapturing(false);
  }, [capturing, paquetes, liveLocalidad, liveEnvioId, existingIds, tarifas]);

  const editarLocalidad = (idx: number, localidad: string) => {
    const calc = calcPaquete(localidad, tarifas);
    setPaquetes(prev => prev.map((p, i) => i === idx ? {
      ...p, localidad, zona: calc.zona as FlexZona,
      precioML: calc.precioML, pagoFlete: calc.pagoFlete, ganancia: calc.ganancia,
    } : p));
    setEditIdx(null); setBusqueda("");
  };

  const borrarPaquete = (id: string) => {
    setPaquetes(prev => prev.filter(p => p.id !== id));
  };

  const okCount       = paquetes.length;
  const totalML       = paquetes.reduce((s, p) => s + p.precioML, 0);
  const totalGanancia = paquetes.reduce((s, p) => s + p.ganancia, 0);
  const totalFlete    = paquetes.reduce((s, p) => s + p.pagoFlete, 0);

  // Color del marco según detección en tiempo real
  const frameColor = !workerReady
    ? "border-yellow-400"
    : liveScan === "found"
    ? "border-green-400"
    : liveScan === "notfound"
    ? "border-gray-500"
    : "border-yellow-400";

  const canCapture = workerReady && !!liveLocalidad && !capturing && paquetes.length < MAX;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/90 backdrop-blur-sm flex-shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-yellow-400" />
          <div>
            <p className="text-white font-bold text-sm">Escáner OCR</p>
            <p className="text-gray-400 text-xs">{paquetes.length}/{MAX} fotos · {okCount} guardadas</p>
          </div>
        </div>
        <div className="flex gap-2">
          {paquetes.length > 0 && (
            <button
              onClick={() => { stopCamera(); onFinish(paquetes); }}
              className="bg-yellow-500 text-black font-bold px-3 py-1.5 rounded-xl text-sm flex items-center gap-1"
            >
              <Save className="w-4 h-4" /> Guardar ({okCount})
            </button>
          )}
          <button onClick={() => { stopCamera(); onClose(); }} className="p-2 text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Cámara — altura mínima garantizada para que el botón quede centrado/abajo cómodamente */}
      <div className="relative overflow-hidden flex-shrink-0" style={{ height: "60vh", minHeight: "360px" }}>
        {camError ? (
          <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center text-center px-6">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
            <p className="text-red-300 text-sm">{camError}</p>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />

            {/* Toast error */}
            {duplicateMsg && (
              <div className="absolute top-16 inset-x-4 z-20 bg-red-600 rounded-2xl px-4 py-3 text-center shadow-2xl">
                {duplicateMsg === "sinid" ? (
                  <>
                    <p className="text-white font-black text-sm">Sin ID de envío</p>
                    <p className="text-red-200 text-xs mt-0.5">Apuntá mejor a la etiqueta — ID obligatorio</p>
                  </>
                ) : (
                  <>
                    <p className="text-white font-black text-sm">Paquete ya escaneado</p>
                    <p className="text-red-200 text-xs mt-0.5">ID duplicado — ignorado</p>
                  </>
                )}
              </div>
            )}

            {/* Marco de enfoque — color dinámico según detección */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingBottom: "130px" }}>
              <div className="relative" style={{ width: "88vw", maxWidth: "380px", height: "52vw", maxHeight: "230px" }}>
                {/* Borde completo semitransparente de fondo */}
                <div className={`absolute inset-0 rounded-lg border-2 transition-colors duration-300 ${frameColor}`} style={{ opacity: 0.35 }} />

                {/* Esquinas del marco — gruesas y bien visibles */}
                <div className={`absolute top-0 left-0 w-10 h-10 transition-colors duration-300 ${frameColor}`} style={{ borderWidth: "4px 0 0 4px", borderStyle: "solid", borderRadius: "4px 0 0 0" }} />
                <div className={`absolute top-0 right-0 w-10 h-10 transition-colors duration-300 ${frameColor}`} style={{ borderWidth: "4px 4px 0 0", borderStyle: "solid", borderRadius: "0 4px 0 0" }} />
                <div className={`absolute bottom-0 left-0 w-10 h-10 transition-colors duration-300 ${frameColor}`} style={{ borderWidth: "0 0 4px 4px", borderStyle: "solid", borderRadius: "0 0 0 4px" }} />
                <div className={`absolute bottom-0 right-0 w-10 h-10 transition-colors duration-300 ${frameColor}`} style={{ borderWidth: "0 4px 4px 0", borderStyle: "solid", borderRadius: "0 0 4px 0" }} />

                {/* Guía en la parte superior del recuadro */}
                <div className="absolute -top-7 inset-x-0 flex justify-center">
                  <span className="bg-black/70 text-white text-[11px] font-semibold px-3 py-1 rounded-full">
                    Centra: Envío + CP + QR dentro del recuadro
                  </span>
                </div>

                {/* Línea divisoria horizontal a 40% — separa zona "Envío ID" de zona "CP/QR" */}
                <div className={`absolute left-4 right-4 transition-colors duration-300 ${frameColor}`} style={{ top: "40%", height: "1px", opacity: 0.4, background: "currentColor" }} />

                {/* Etiquetas de zona dentro del marco */}
                <div className="absolute top-1.5 left-3 flex items-center gap-1 opacity-60">
                  <span className="text-white text-[9px] font-bold uppercase tracking-wider">Envío ID</span>
                </div>
                <div className="absolute left-3 flex items-center gap-1 opacity-60" style={{ top: "43%" }}>
                  <span className="text-white text-[9px] font-bold uppercase tracking-wider">CP + Localidad + QR</span>
                </div>

                {/* Mensaje de detección dentro del marco */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {liveScan === "found" && liveLocalidad ? (
                    <div className="bg-green-600/90 rounded-xl px-4 py-2 text-center shadow-xl">
                      <p className="text-white font-black text-lg leading-tight">{liveLocalidad}</p>
                      <p className="text-green-200 text-xs mt-0.5">
                        {ZONA_LABELS[FLEX_LOCALIDADES.find(l => l.nombre === liveLocalidad)?.zona ?? "lejana"]} · {fmt(calcPaquete(liveLocalidad, tarifas).precioML)}
                      </p>
                      {liveEnvioId ? (
                        <p className="text-green-300 text-[11px] mt-1 font-mono font-bold">Envío: {liveEnvioId}</p>
                      ) : (
                        <p className="text-yellow-300 text-[11px] mt-1 font-semibold">⚠ Buscando ID de envío...</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-black/60 rounded-xl px-3 py-1.5 flex items-center gap-2">
                      {!workerReady ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
                          <span className="text-yellow-300 text-xs font-semibold">Cargando OCR...</span>
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                          <span className="text-gray-300 text-xs">Buscando zona válida...</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contador arriba derecha */}
            <div className={`absolute top-3 right-3 rounded-xl px-3 py-1.5 text-center ${
              paquetes.length >= MAX ? "bg-red-600" : "bg-black/70"
            }`}>
              <p className="text-white font-black text-2xl leading-none">{paquetes.length}</p>
              <p className="text-gray-300 text-[10px]">/{MAX}</p>
            </div>

            {/* NO hay botón aquí — está fijo abajo en la pantalla */}
          </>
        )}
      </div>

      {/* ── BOTÓN CAPTURAR FIJO AL FONDO DE LA PANTALLA ── */}
      {!camError && (
        <div className="fixed bottom-0 inset-x-0 z-[70] flex flex-col items-center pb-8 pt-4 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)" }}>
          <p className={`text-xs font-semibold mb-3 transition-colors pointer-events-none ${canCapture ? "text-green-300" : "text-gray-500"}`}>
            {paquetes.length >= MAX
              ? "Límite alcanzado"
              : !workerReady
              ? "Cargando motor OCR..."
              : canCapture
              ? `✓ ${liveLocalidad} — tocá para guardar`
              : "Buscando zona válida..."}
          </p>
          <button
            onPointerDown={capturar}
            disabled={!canCapture}
            className="pointer-events-auto focus:outline-none"
          >
            <div className={`w-22 h-22 rounded-full border-4 flex items-center justify-center transition-all duration-200 shadow-2xl ${
              canCapture
                ? "border-green-400 bg-green-600/40 active:scale-90 active:bg-green-600/70"
                : "border-gray-600 bg-gray-800/60 opacity-40"
            }`} style={{ width: "80px", height: "80px" }}>
              {capturing ? (
                <Loader2 className="w-9 h-9 text-white animate-spin" />
              ) : (
                <Camera className={`w-10 h-10 ${canCapture ? "text-green-200" : "text-gray-600"}`} />
              )}
            </div>
          </button>
        </div>
      )}

      {/* Lista de paquetes — panel inferior, solo paquetes válidos */}
      {paquetes.length > 0 && (
        <div className="flex-shrink-0 bg-gray-950 overflow-y-auto" style={{ maxHeight: "40vh" }}>
          <div className="sticky top-0 bg-gray-900/95 border-b border-gray-700 px-4 py-2 flex justify-between z-10">
            <div className="flex gap-3 text-xs">
              {[
                { icon: <DollarSign className="w-3 h-3" />, label: "ML", value: fmt(totalML), color: "text-white" },
                { icon: <Package className="w-3 h-3" />, label: "Flete", value: fmt(totalFlete), color: "text-blue-300" },
                { icon: <TrendingUp className="w-3 h-3" />, label: "Gan.", value: fmt(totalGanancia), color: "text-green-300" },
              ].map(({ icon, label, value, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="text-gray-500">{icon}</span>
                  <span className="text-gray-400">{label}:</span>
                  <span className={`font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
            <span className="text-xs text-gray-500">{paquetes.length} paq.</span>
          </div>

          <div className="p-3 space-y-2">
            {[...paquetes].reverse().map((p, revIdx) => {
              const idx = paquetes.length - 1 - revIdx;
              return (
                <div key={p.id} className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
                  {editIdx === idx ? (
                    <div className="p-3 space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                        <input autoFocus type="text" placeholder="Buscar localidad..."
                          value={busqueda} onChange={e => setBusqueda(e.target.value)}
                          className="w-full bg-gray-700 text-white rounded-lg pl-8 pr-3 py-2 text-sm border border-yellow-400 outline-none"
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {localidadesFiltradas.map(loc => (
                          <button key={loc.nombre} onClick={() => editarLocalidad(idx, loc.nombre)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-left">
                            <span className="text-white text-sm">{loc.nombre}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${ZONA_COLORS[loc.zona]}`}>{ZONA_LABELS[loc.zona]}</span>
                          </button>
                        ))}
                      </div>
                      <button onClick={() => { setEditIdx(null); setBusqueda(""); }} className="text-xs text-gray-500">Cancelar</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.fotoDataUrl} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0 border border-gray-600" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-gray-500 text-xs font-bold">#{idx + 1}</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                          <span className="text-white text-sm font-semibold">{p.localidad}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${ZONA_COLORS[p.zona]}`}>{ZONA_LABELS[p.zona]}</span>
                        </div>
                        <p className="text-gray-500 text-[10px] mt-0.5">
                          ML: {fmt(p.precioML)} · Flete: {fmt(p.pagoFlete)} · Gan: <span className="text-green-300">{fmt(p.ganancia)}</span>
                        </p>
                        {p.envioId && (
                          <p className="text-gray-600 text-[10px] font-mono mt-0.5">ID: {p.envioId}</p>
                        )}
                      </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => borrarPaquete(p.id)}
                        className="w-9 h-9 rounded-full bg-red-500/20 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                        title="Borrar captura">
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => { setEditIdx(idx); setBusqueda(""); }}
                        className="p-1.5 rounded-lg bg-gray-700 text-gray-400 hover:text-yellow-300 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
