"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, User, Mail, Lock, Eye, EyeOff, CheckCircle, 
  AlertCircle, Save, LogOut, Shield, KeyRound
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Estados para cambiar email
  const [newEmail, setNewEmail] = useState("");
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState("");
  const [showPasswordForEmail, setShowPasswordForEmail] = useState(false);

  // Estados para cambiar contraseña
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Estados para recuperar cuenta
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
      setLoading(false);
    };
    getUser();
  }, [router]);

  // Cambiar Email
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      // Primero re-autenticar con contraseña actual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPasswordForEmail,
      });

      if (signInError) {
        setMessage({ type: "error", text: "Contraseña actual incorrecta" });
        setSaving(false);
        return;
      }

      // Actualizar email
      const { error } = await supabase.auth.updateUser({ email: newEmail });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({ type: "success", text: "Email actualizado. Revisa tu nuevo correo para confirmar." });
        setNewEmail("");
        setCurrentPasswordForEmail("");
        // Actualizar usuario local
        setUser({ ...user, email: newEmail });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error al actualizar email" });
    }

    setSaving(false);
  };

  // Cambiar Contraseña
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (newPassword !== confirmNewPassword) {
      setMessage({ type: "error", text: "Las contraseñas nuevas no coinciden" });
      setSaving(false);
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres" });
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({ type: "success", text: "Contraseña actualizada correctamente" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error al actualizar contraseña" });
    }

    setSaving(false);
  };

  // Recuperar Contraseña / Cuenta
  const handlePasswordRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setRecoverySent(true);
        setMessage({ type: "success", text: `Email de recuperación enviado a ${recoveryEmail}` });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Error al enviar email de recuperación" });
    }

    setSaving(false);
  };

  // Cerrar Sesión
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-12">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/appjeez" 
              className="p-2 rounded-lg hover:bg-white/10 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold">Configurar Perfil</h1>
          </div>
          
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Mensaje de éxito/error */}
        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-3 ${
            message.type === "success" 
              ? "bg-green-500/10 border border-green-500/20 text-green-400" 
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}>
            {message.type === "success" ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <p>{message.text}</p>
          </div>
        )}

        {/* Info del Usuario */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-[#FFE600] flex items-center justify-center">
              <User className="w-8 h-8 text-[#003087]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{user?.user_metadata?.full_name || "Usuario"}</h2>
              <p className="text-gray-400">{user?.email}</p>
              <p className="text-xs text-gray-500 mt-1">Usuario desde: {new Date(user?.created_at).toLocaleDateString("es-AR")}</p>
            </div>
          </div>
        </section>

        {/* Cambiar Email */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#FFE600]" />
            Cambiar Email (Gmail)
          </h3>
          
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Nuevo Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nuevo@email.com"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FFE600]"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Contraseña Actual (para confirmar)</label>
              <div className="relative">
                <input
                  type={showPasswordForEmail ? "text" : "password"}
                  value={currentPasswordForEmail}
                  onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FFE600]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordForEmail(!showPasswordForEmail)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  {showPasswordForEmail ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-[#FFE600] text-[#003087] rounded-xl font-semibold hover:bg-[#ffd700] transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Guardando..." : "Actualizar Email"}
            </button>
          </form>
        </section>

        {/* Cambiar Contraseña */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#FFE600]" />
            Cambiar Contraseña
          </h3>
          
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Contraseña Actual</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FFE600]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Nueva Contraseña</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FFE600]"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Confirmar Nueva Contraseña</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FFE600]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-[#FFE600] text-[#003087] rounded-xl font-semibold hover:bg-[#ffd700] transition disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              {saving ? "Guardando..." : "Actualizar Contraseña"}
            </button>
          </form>
        </section>

        {/* Recuperar Cuenta / Contraseña */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#FFE600]" />
            Recuperar Cuenta
          </h3>
          
          <p className="text-gray-400 mb-4">
            ¿Olvidaste tu contraseña? Ingresa tu email y te enviaremos un enlace para restablecerla.
          </p>

          {recoverySent ? (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">Email enviado</span>
              </div>
              <p className="text-sm">Revisa tu bandeja de entrada y sigue las instrucciones para recuperar tu cuenta.</p>
            </div>
          ) : (
            <form onSubmit={handlePasswordRecovery} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Email de recuperación</label>
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FFE600]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                {saving ? "Enviando..." : "Enviar Email de Recuperación"}
              </button>
            </form>
          )}
        </section>

        {/* Enlaces útiles */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-4">Enlaces Útiles</h3>
          
          <div className="space-y-2">
            <Link 
              href="/configuracion/meli" 
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition"
            >
              <Settings className="w-5 h-5 text-[#FFE600]" />
              <div>
                <p className="font-medium">Configurar Cuentas MeLi</p>
                <p className="text-sm text-gray-500">Vincula o desvincula cuentas de Mercado Libre</p>
              </div>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
