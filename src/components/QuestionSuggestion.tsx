"use client";

import { useEffect, useState } from "react";
import { searchKnowledgeBase, incrementUsageCount, type KnowledgeItem } from "@/lib/knowledgeBase";
import { Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  preguntaTexto: string;
  onUseSuggestion: (texto: string) => void;
}

export default function QuestionSuggestion({ preguntaTexto, onUseSuggestion }: Props) {
  const [sugerencia, setSugerencia] = useState<KnowledgeItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (preguntaTexto && preguntaTexto.trim().length > 0) {
      searchSuggestion();
    }
  }, [preguntaTexto]);

  const searchSuggestion = async () => {
    setLoading(true);
    try {
      const result = await searchKnowledgeBase(preguntaTexto);
      setSugerencia(result);
    } catch (error) {
      console.error("Error buscando sugerencia:", error);
      setSugerencia(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUseSuggestion = async () => {
    if (!sugerencia) return;

    // Llenar textarea con la respuesta sugerida
    onUseSuggestion(sugerencia.respuesta_exitosa);

    // Incrementar contador de uso
    await incrementUsageCount(sugerencia.id);

    // Toast de feedback
    console.log("✅ Sugerencia aplicada:", sugerencia.id);
  };

  // No mostrar nada si no hay sugerencia
  if (!sugerencia) return null;

  return (
    <div
      className="rounded-lg border overflow-hidden transition-all"
      style={{
        background: "rgba(59, 130, 246, 0.08)",
        borderColor: "rgba(59, 130, 246, 0.3)",
      }}
    >
      {/* Header colapsable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-900/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-blue-400" />
          <p className="text-sm font-bold text-blue-300">💡 Sugerencia del historial</p>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-blue-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-blue-400" />
        )}
      </button>

      {/* Contenido expandible */}
      {expanded && (
        <div className="px-4 py-3 border-t space-y-3" style={{ borderColor: "rgba(59, 130, 246, 0.2)" }}>
          {/* Pregunta original para contexto */}
          <div className="text-xs text-gray-400">
            <p className="font-semibold mb-1">Pregunta anterior similar:</p>
            <p className="italic">{sugerencia.pregunta_original.substring(0, 100)}...</p>
          </div>

          {/* Respuesta sugerida */}
          <div>
            <p className="text-xs font-semibold text-gray-300 mb-2">Respuesta sugerida:</p>
            <p className="text-sm text-gray-200 leading-relaxed bg-gray-900/30 p-2 rounded border border-gray-700">
              {sugerencia.respuesta_exitosa.substring(0, 300)}
              {sugerencia.respuesta_exitosa.length > 300 ? "..." : ""}
            </p>
          </div>

          {/* Stats */}
          <div className="text-xs text-gray-400 flex items-center gap-3">
            <span>Usado {sugerencia.uso_count} veces</span>
            {sugerencia.tags.length > 0 && (
              <span className="flex items-center gap-1">
                Tags: {sugerencia.tags.slice(0, 2).join(", ")}
              </span>
            )}
          </div>

          {/* Botón de uso */}
          <button
            onClick={handleUseSuggestion}
            className="w-full px-3 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            ✓ Usar esta respuesta
          </button>
        </div>
      )}
    </div>
  );
}
