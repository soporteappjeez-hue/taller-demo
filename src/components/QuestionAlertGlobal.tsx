"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, BellOff, Volume2 } from "lucide-react";

/**
 * Global question-alert component.
 * Persists alert preference in localStorage so it survives navigation.
 * Mounts once in the appjeez layout and polls every 5 min via Web Worker.
 */
export default function QuestionAlertGlobal() {
  const [enabled, setEnabled] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const enabledRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const alertedIdsRef = useRef<Set<number>>(new Set());
  const initialLoadDone = useRef(false);
  const loadRef = useRef<(() => Promise<void>) | null>(null);

  // Restore persisted preference on mount
  useEffect(() => {
    const stored = localStorage.getItem("maqjeez_alerts_enabled");
    if (stored === "true") setEnabled(true);

    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdHuMk42Bfn6Dj5yWjIB7fIOQm5eSh3t2fImWmpOJf3t8iJabl46DfXuFk5qXj4R9fIOSmZWNhH19hZOZl4+EfX2Ek5mXj4R9fYWTmZePhH19hJOZl4+EfX2Fk5mXj4R9fYSTmZePhH19hZOZl4+EfX2Ek5mVjYR+fYWTmJWOhH59hZOYlY6Efn2Fk5iVjoR+fYWTl5SNhH59hZOXlI2Efn6Fk5eUjYR+foWTl5SNhH5+hZOXlI2Efn6Fk5eUjYR+foWTl5SNhH5+hZOXlI2Efn6Fk5aUjYR+foaTlpSNhH5+hpOWlI2Efn6Gk5aUjYR+foaTlpSNhH5+hpOWlI2Efn6Gk5aUjYR+foaTlpSNhH5+hpOWlI2Efn6GkpaUjYR+foaSg3xtZnF+i5OPh4F9gIuWlY6DfHyEkpmXjoN8fISSmZeOg3x8hJKZl46DfHyEkpmXjoN8fISSmZeOg3x8hJKZlo2Dfn6Gk5aUjYR+fg=="
    );
    audioRef.current.volume = 0.7;

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Keep ref in sync
  useEffect(() => {
    enabledRef.current = enabled;
    localStorage.setItem("maqjeez_alerts_enabled", String(enabled));
  }, [enabled]);

  const playAlert = useCallback(() => {
    if (!enabledRef.current) return;
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("MaqJeez — Nueva pregunta", {
        body: "Hay preguntas nuevas sin responder en MercadoLibre",
        icon: "/icon-192.png",
      });
    }
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
        playAlert();
        setToast(`${newQuestions} pregunta${newQuestions > 1 ? "s" : ""} nueva${newQuestions > 1 ? "s" : ""} de ${newAccounts.join(", ")}`);
        setTimeout(() => setToast(null), 5000);
      }
    } catch { /* silent */ }
  }, [playAlert]);

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
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current!.pause();
        audioRef.current!.currentTime = 0;
      }).catch(() => {});
    }
    if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
      Notification.requestPermission().catch(() => {});
    }
    setEnabled(true);
  };

  const handleDisable = () => setEnabled(false);

  const testSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  return (
    <>
      {/* Floating alert controls — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
        {toast && (
          <div className="rounded-xl px-4 py-2 text-sm font-bold text-black animate-pulse"
            style={{ background: "#FFE600" }}>
            {toast}
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
            <button onClick={testSound}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
              style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.1)" }}
              title="Probar sonido">
              <Volume2 className="w-4 h-4 text-gray-400" />
            </button>
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
