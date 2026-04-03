"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User, Mail, Lock, Building, Save, ArrowLeft,
  CheckCircle, AlertCircle, Eye, EyeOff, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function UsuarioConfigPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Datos personales
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Cambio de email
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  // Cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  // Posición ante ARCA
  const [arcaPosition, setArcaPosition] = useState("");
  const [cuit, setCuit] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);
      setFullName(session.user.user_metadata?.full_name || "");
      setPhone(session.user.user_metadata?.phone || "");
      setArcaPosition(session.user.user_metadata?.arca_position || "");
      setCuit(session.user.user_metadata?.cuit || "");
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleSavePersonal = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          phone: phone,
          arca_position: arcaPosition,
          cuit: cuit,
        }
      });

      if (error) throw error;
      setMessage({ type: "success", text: "Datos actualizados correctamente" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error al actualizar datos" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !emailPassword) {
      setMessage({ type: "error", text: "Complete todos los campos para cambiar el email" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Primero verificar la contraseña actual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: emailPassword,
      });

      if (signInError) throw new Error("Contraseña incorrecta");

      // Cambiar email
      const { error } = await supabase.auth.updateUser({ email: newEmail });

      if (error) throw error;
      setMessage({ type: "success", text: "Se envió un email de confirmación a " + newEmail });
      setNewEmail("");
      setEmailPassword("");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error al cambiar email" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: "error", text: "Complete todos los campos para cambiar la contraseña" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas nuevas no coinciden" });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      setMessage({ type: "success", text: "Contraseña actualizada correctamente" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Error al cambiar contraseña" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#121212" }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#FFE600]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#121212" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 px-4 py-3 flex items-center gap-4 border-b"
        style={{ background: "rgba(24,24,24,0.97)", backdropFilter: "blur(16px)", borderColor: "rgba(255,255,255,0.06)" }}>
        <Link href="/" className="p-2 rounded-xl hover:bg-white/5">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <h1 className="font-bold text-white text-lg">Configuración de Usuario</h1>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6 pb-24">
        {/* Mensaje */}
        {message && (
          <div
            className="rounded-xl p-4 flex items-center gap-3"
            style={{
              background: message.type === "success" ? "#39FF1418" : "#ef444418",
              border: message.type === "success" ? "1px solid #39FF1440" : "1px solid #ef444440"
            }}
          >
            {message.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            )}
            <span className={message.type === "success" ? "text-green-400" : "text-red-400"}>
              {message.text}
            </span>
          </div>
        )}

        {/* Email actual */}
        <div className="rounded-2xl p-4" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3 mb-2">
            <Mail className="w-5 h-5 text-[#FFE600]" />
            <span className="text-sm text-gray-400">Email actual</span>
          </div>
          <p className="text-white font-semibold">{user?.email}</p>
        </div>

        {/* Datos Personales */}
        <section className="rounded-2xl p-5" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h2 className="font-bold text-white flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-[#FFE600]" />
            Datos Personales
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nombre completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-white"
                style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}
                placeholder="Tu nombre"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Teléfono</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-white"
                style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}
                placeholder="+54 11 1234-5678"
              />
            </div>

            <button
              onClick={handleSavePersonal}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all hover:scale-105"
              style={{ background: "#FFE600", color: "#003087" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Cambios
            </button>
          </div>
        </section>

        {/* Cambiar Email */}
        <section className="rounded-2xl p-5" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h2 className="font-bold text-white flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-[#00E5FF]" />
            Cambiar Email
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nuevo email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-white"
                style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}
                placeholder="nuevo@email.com"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Contraseña actual (para verificar)</label>
              <input
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-white"
                style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}
                placeholder="••••••••"
              />
            </div>

            <button
              onClick={handleChangeEmail}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all hover:opacity-80"
              style={{ background: "#00E5FF", color: "#003087" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Cambiar Email
            </button>
          </div>
        </section>

        {/* Cambiar Contraseña */}
        <section className="rounded-2xl p-5" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h2 className="font-bold text-white flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-[#39FF14]" />
            Cambiar Contraseña
          </h2>

          <div className="space-y-4">
            <div className="relative">
              <label className="text-xs text-gray-400 mb-1 block">Contraseña actual</label>
              <input
                type={showPasswords ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-white pr-10"
                style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}
                placeholder="••••••••"
              />
            </div>

            <div className="relative">
              <label className="text-xs text-gray-400 mb-1 block">Nueva contraseña</label>
              <input
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-white"
                style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}
                placeholder="••••••••"
              />
            </div>

            <div className="relative">
              <label className="text-xs text-gray-400 mb-1 block">Confirmar nueva contraseña</label>
              <input
                type={showPasswords ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-white"
                style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPasswords(!showPasswords)}
                className="flex items-center gap-2 text-xs text-gray-400 hover:text-white"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showPasswords ? "Ocultar contraseñas" : "Mostrar contraseñas"}
              </button>
            </div>

            <button
              onClick={handleChangePassword}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all hover:opacity-80"
              style={{ background: "#39FF14", color: "#003087" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Cambiar Contraseña
            </button>
          </div>
        </section>

        {/* Posición ante ARCA */}
        <section className="rounded-2xl p-5" style={{ background: "#1F1F1F", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h2 className="font-bold text-white flex items-center gap-2 mb-4">
            <Building className="w-5 h-5 text-[#FF9800]" />
            Posición ante ARCA
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">CUIT</label>
              <input
                type="text"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-white"
                style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}
                placeholder="20-12345678-9"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Posición fiscal</label>
              <select
                value={arcaPosition}
                onChange={(e) => setArcaPosition(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-white"
                style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <option value="">Seleccionar...</option>
                <option value="RI">Responsable Inscripto</option>
                <option value="MONOTRIBUTO">Monotributista</option>
                <option value="EXENTO">Exento</option>
                <option value="CF">Consumidor Final</option>
                <option value="EXT">Exterior</option>
              </select>
            </div>

            <button
              onClick={handleSavePersonal}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all hover:opacity-80"
              style={{ background: "#FF9800", color: "#003087" }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar Datos Fiscales
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
