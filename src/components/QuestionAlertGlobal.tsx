"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, BellOff, Volume2, ChevronDown } from "lucide-react";
import { ALERT_MODES, type AlertMode, ALERT_MODE_STORAGE_KEY } from "@/lib/alertModes";

/**
 * Global question-alert component.
 * Persists alert preference in localStorage so it survives navigation.
 * Mounts once in the appjeez layout and polls every 5 min via Web Worker.
 * Supports unified alert modes: discreto, taller, urgente
 */
export default function QuestionAlertGlobal() {
  const [enabled, setEnabled] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [alertMode, setAlertMode] = useState<AlertMode>("taller");
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  const enabledRef = useRef(false);
  const workerRef = useRef<Worker | null>(null);
  const alertedIdsRef = useRef<Set<number>>(new Set());
  const initialLoadDone = useRef(false);
  const loadRef = useRef<(() => Promise<void>) | null>(null);

  // Restore persisted preference on mount
  useEffect(() => {
    const stored = localStorage.getItem("maqjeez_alerts_enabled");
    if (stored === "true") setEnabled(true);

    const storedMode = localStorage.getItem(ALERT_MODE_STORAGE_KEY) as AlertMode | null;
    if (storedMode && Object.keys(ALERT_MODES).includes(storedMode)) {
      setAlertMode(storedMode);
    }

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Keep ref in sync
  useEffect(() => {
    enabledRef.current = enabled;
    localStorage.setItem("maqjeez_alerts_enabled", String(enabled));
  }, [enabled]);

  // Sync alert mode with localStorage
  useEffect(() => {
    localStorage.setItem(ALERT_MODE_STORAGE_KEY, alertMode);
  }, [alertMode]);

  // Función para reproducir sonido de alerta según el modo
  const playAlertSound = useCallback((mode: AlertMode) => {
    try {
      // Detener cualquier audio anterior si existe
      const currentAudio = (window as any).currentAlertAudio;
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      const audioPath = `/sounds/alerta-${mode}.mp3`;
      const audio = new Audio(audioPath);
      audio.volume = 1.0; // Volumen máximo para todos los modos
      
      // Guardar referencia global
      (window as any).currentAlertAudio = audio;

      audio.play().catch((e) => {
        console.error("Error al reproducir audio. Ruta intentada:", audio.src);
        console.error("Detalle del error:", e);
        console.error("Estado del audio:", {
          readyState: audio.readyState,
          networkState: audio.networkState,
          error: audio.error,
        });
      });
    } catch (error) {
      console.error("Error en playAlertSound:", error);
    }
  }, []);

  // Función para mostrar notificación de cambio de modo
  const showModeNotification = useCallback((mode: AlertMode) => {
    const config = ALERT_MODES[mode];
    setToast(`${config.icon} Modo ${config.label} activado - Prueba de sonido realizada`);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const pollQuestions = useCallback(async () => {
    try {
      const res = await fetch("/api/meli-questions");
      if (!res.ok) return;
      const data: Array<{ meli_question_id: number; meli_accounts?: { nickname?: string } }> = await res.json();

      const seen = new Set<number>();
      const unique = data.filter(q => {
        if (seen.has(q.meli_question_id)) return false;
        seen.add(q.meli_question_id);
        return true;
      });

      if (!initialLoadDone.current) {
        unique.forEach(q => alertedIdsRef.current.add(q.meli_question_id));
        initialLoadDone.current = true;
        return;
      }

      let newQuestions = 0;
      const newAccounts: string[] = [];
      for (const q of unique) {
        if (!alertedIdsRef.current.has(q.meli_question_id)) {
          alertedIdsRef.current.add(q.meli_question_id);
          newQuestions++;
          const accName = q.meli_accounts?.nickname ?? "Cuenta";
          if (!newAccounts.includes(accName)) newAccounts.push(accName);
        }
      }

      if (newQuestions > 0) {
        setNewCount(prev => prev + newQuestions);
        playAlertSound(alertMode);
        const modeConfig = ALERT_MODES[alertMode];
        setToast(`${newQuestions} pregunta${newQuestions > 1 ? "s" : ""} nueva${newQuestions > 1 ? "s" : ""} de ${newAccounts.join(", ")}`);
        setTimeout(() => setToast(null), modeConfig.duration);
      }
    } catch { /* silent */ }
  }, [playAlertSound, alertMode]);

  useEffect(() => { loadRef.current = pollQuestions; }, [pollQuestions]);

  // Worker + initial poll
  useEffect(() => {
    pollQuestions();

    if (typeof Worker !== "undefined") {
      const worker = new Worker("/question-worker.js");
      workerRef.current = worker;
      worker.onmessage = () => loadRef.current?.();
      worker.postMessage("start");
      return () => {
        worker.postMessage("stop");
        worker.terminate();
      };
    } else {
      const interval = setInterval(() => loadRef.current?.(), 300_000);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnable = () => {
    if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
      Notification.requestPermission().catch(() => {});
    }
    setEnabled(true);
  };

  const handleDisable = () => setEnabled(false);

  return (
    <>
      {/* Floating alert controls — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
        {toast && (
          <div className={`${ALERT_MODES[alertMode].style} ${ALERT_MODES[alertMode].animation} text-white p-5 rounded-xl shadow-2xl flex items-center gap-4 border-2 border-white`}>
            <span className="text-3xl">{ALERT_MODES[alertMode].icon}</span>
            <div>
              <p className="font-black uppercase tracking-wider">¡Nueva Pregunta en Sistema!</p>
              <p className="text-lg font-medium">{toast}</p>
            </div>
          </div>
        )}

        {newCount > 0 && (
          <div className="relative">
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black"
              style={{ background: "#ef4444" }}>
              {newCount > 99 ? "99+" : newCount}
            </span>
          </div>
        )}

        {enabled ? (
          <div className="flex items-center gap-1">
            {/* Mode selector dropdown */}
            <div className="relative">
              <button onClick={() => setShowModeDropdown(!showModeDropdown)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.1)" }}
                title={`Modo actual: ${ALERT_MODES[alertMode].label}`}>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {showModeDropdown && (
                <div className="absolute bottom-full right-0 mb-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-[60] min-w-max">
                  {(Object.keys(ALERT_MODES) as AlertMode[]).map((mode) => (
                    <div
                      key={mode}
                      className={`flex items-center justify-between px-3 py-2 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                        alertMode === mode ? "bg-blue-600" : "hover:bg-gray-800"
                      }`}
                    >
                      <button
                        onClick={() => {
                          setAlertMode(mode);
                          playAlertSound(mode);
                          showModeNotification(mode);
                          setShowModeDropdown(false);
                        }}
                        className={`flex-1 text-left flex items-center gap-2 text-sm transition-colors ${
                          alertMode === mode ? "text-white font-bold" : "text-gray-300"
                        }`}
                      >
                        <span className="text-lg">{ALERT_MODES[mode].icon}</span>
                        {ALERT_MODES[mode].label}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playAlertSound(mode);
                        }}
                        className={`ml-2 px-2 py-1 rounded text-sm transition-all ${
                          alertMode === mode
                            ? "bg-white text-blue-600 hover:bg-gray-100"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                        title="Reproducir prueba de sonido"
                      >
                        ▶️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleDisable}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg"
              style={{ background: "#39FF14", border: "2px solid #39FF1460" }}
              title="Alertas activadas — clic para desactivar">
              <Bell className="w-5 h-5 text-black" />
            </button>
          </div>
        ) : (
          <button onClick={handleEnable}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg"
            style={{ background: "#1F1F1F", border: "2px solid rgba(255,255,255,0.15)" }}
            title="Activar alertas sonoras">
            <BellOff className="w-5 h-5 text-gray-500" />
          </button>
        )}
      </div>
    </>
  );
}
