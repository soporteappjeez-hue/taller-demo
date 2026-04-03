"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Obtener la sesión actual (Supabase ya procesó el callback)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("[AuthCallback] Error al obtener sesión:", sessionError);
          setError(sessionError.message);
          setTimeout(() => router.push("/login?error=auth_failed"), 2000);
          return;
        }

        if (session) {
          console.log("[AuthCallback] Usuario autenticado:", session.user.email);
          // Usuario autenticado exitosamente - redirigir al dashboard
          router.push("/appjeez");
        } else {
          // No hay sesión, intentar intercambiar el código de la URL
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const queryParams = new URLSearchParams(window.location.search);
          
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          const errorDescription = queryParams.get("error_description");
          
          if (errorDescription) {
            console.error("[AuthCallback] Error de OAuth:", errorDescription);
            setError(errorDescription);
            setTimeout(() => router.push("/login?error=" + encodeURIComponent(errorDescription)), 2000);
            return;
          }
          
          if (accessToken && refreshToken) {
            // Establecer la sesión manualmente
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (setSessionError) {
              console.error("[AuthCallback] Error al establecer sesión:", setSessionError);
              setError(setSessionError.message);
              setTimeout(() => router.push("/login?error=session_failed"), 2000);
              return;
            }
            
            console.log("[AuthCallback] Sesión establecida correctamente");
            router.push("/appjeez");
          } else {
            console.error("[AuthCallback] No hay tokens ni sesión");
            setError("No se pudo completar la autenticación");
            setTimeout(() => router.push("/login?error=no_session"), 2000);
          }
        }
      } catch (err) {
        console.error("[AuthCallback] Error inesperado:", err);
        setError("Error inesperado en la autenticación");
        setTimeout(() => router.push("/login?error=unknown"), 2000);
      }
    };

    handleAuthCallback();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-2xl">✕</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Error de Autenticación</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <p className="text-gray-500 text-sm">Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-[#FFE600] animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Completando autenticación...</p>
        <p className="text-gray-500 text-sm mt-2">Por favor espera</p>
      </div>
    </div>
  );
}
