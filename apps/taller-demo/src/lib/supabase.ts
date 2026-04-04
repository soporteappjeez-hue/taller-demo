import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

console.log("[Supabase Init]", {
  url: url ? "✓ URL configured" : "✗ URL missing",
  key: key ? "✓ Key configured" : "✗ Key missing",
});

export const supabase: SupabaseClient = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder-key",
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// 🔌 Nota: Realtime usa polling en producción (fallback automático)
// Los errores de WebSocket se deben a que RLS no está configurado en Supabase
// Para habilitar Realtime: configurar RLS en tablas meli_printed_labels y etiquetas_history
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log("[Supabase] Client initialized. Using polling for data sync.");
}
