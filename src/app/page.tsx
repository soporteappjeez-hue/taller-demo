"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Wrench, Package, ShoppingCart, Truck,
  BarChart2, Users, ArrowRight, Zap, Shield, Smartphone,
  CheckCircle, AlertCircle, Settings, ChevronRight,
} from "lucide-react";

/* ── Feature modules ── */
const FEATURES = [
  {
    href: "/ventas",
    icon: ShoppingCart,
    color: "#39FF14",
    glow: "rgba(57,255,20,0.22)",
    border: "rgba(57,255,20,0.45)",
    title: "Vender",
    desc: "Registrá ventas con múltiples productos, elegí método de pago y consultá los movimientos del día.",
    tags: ["Multi-producto", "5 métodos de pago", "Movimientos diarios"],
  },
  {
    href: "/flex",
    icon: Truck,
    color: "#00E5FF",
    glow: "rgba(0,229,255,0.22)",
    border: "rgba(0,229,255,0.45)",
    title: "Flex Logística",
    desc: "Escáner OCR + QR para cargar envíos de Mercado Libre. Detección automática de zona y precio por CP.",
    tags: ["OCR / QR", "Zonas automáticas", "Anti-duplicados"],
  },
  {
    href: "/taller",
    icon: Wrench,
    color: "#FF5722",
    glow: "rgba(255,87,34,0.30)",
    border: "rgba(255,87,34,0.45)",
    title: "Taller",
    desc: "Gestión completa de órdenes de trabajo. Registrá equipos, seguí el estado de reparaciones y alertas de retiro.",
    tags: ["Órdenes activas", "Historial", "Alertas 90 días"],
  },
  {
    href: "/inventario",
    icon: Package,
    color: "#FDB71A",
    glow: "rgba(253,183,26,0.25)",
    border: "rgba(253,183,26,0.45)",
    title: "Inventario",
    desc: "Control de stock de repuestos en tiempo real. Alertas de stock bajo y pedidos pendientes automáticos.",
    tags: ["Stock bajo", "Pedidos", "Categorías"],
  },
  {
    href: "/estadisticas",
    icon: BarChart2,
    color: "#A855F7",
    glow: "rgba(168,85,247,0.22)",
    border: "rgba(168,85,247,0.45)",
    title: "Estadísticas",
    desc: "Dashboard con métricas de ventas, facturación, motores más reparados y rendimiento del taller.",
    tags: ["Gráficos", "Filtros por fecha", "Exportar Excel/PDF"],
  },
  {
    href: "/agenda",
    icon: Users,
    color: "#F59E0B",
    glow: "rgba(245,158,11,0.22)",
    border: "rgba(245,158,11,0.45)",
    title: "Agenda",
    desc: "Ficha de clientes con historial de reparaciones y compras. Identificá a tus mejores clientes.",
    tags: ["Historial", "Clientes frecuentes", "WhatsApp"],
  },
];

const HIGHLIGHTS = [
  { icon: Smartphone, text: "100% optimizada para celular" },
  { icon: Zap,        text: "Datos en tiempo real con Supabase" },
  { icon: Shield,     text: "Anti-duplicados y validación OCR" },
];

/* ── Medallón con laureles SVG ── */
function MedalBadge({ id, children }: { id: string; children: React.ReactNode }) {
  const gradId = `gl${id}`;
  const leaves = [0,14,28,42,56,70,84];
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" fill="none">
        {leaves.map((a, i) => (
          <ellipse key={`L${i}`}
            cx={50 - 32 * Math.cos((195 + a) * Math.PI / 180)}
            cy={50 - 32 * Math.sin((195 + a) * Math.PI / 180)}
            rx="6" ry="3.2"
            transform={`rotate(${195 + a + 90} ${50 - 32 * Math.cos((195 + a) * Math.PI / 180)} ${50 - 32 * Math.sin((195 + a) * Math.PI / 180)})`}
            fill={`url(#${gradId})`}
          />
        ))}
        {leaves.map((a, i) => (
          <ellipse key={`R${i}`}
            cx={50 + 32 * Math.cos((195 + a) * Math.PI / 180)}
            cy={50 - 32 * Math.sin((195 + a) * Math.PI / 180)}
            rx="6" ry="3.2"
            transform={`rotate(${-(195 + a) + 90} ${50 + 32 * Math.cos((195 + a) * Math.PI / 180)} ${50 - 32 * Math.sin((195 + a) * Math.PI / 180)})`}
            fill={`url(#${gradId})`}
          />
        ))}
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFD700"/>
            <stop offset="100%" stopColor="#7a5800"/>
          </linearGradient>
        </defs>
      </svg>
      <div className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center"
        style={{
          background: "radial-gradient(circle at 35% 35%, #c8960c 0%, #7a5800 60%, #3d2c00 100%)",
          border: "2.5px solid #FFD700",
          boxShadow: "0 0 14px rgba(255,215,0,0.50), inset 0 2px 3px rgba(255,255,255,0.12)",
        }}>
        {children}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [meliStatus, setMeliStatus] = useState<"loading"|"connected"|"disconnected">("loading");
  const [meliNickname, setMeliNickname] = useState("");

  useEffect(() => {
    fetch("/api/meli-accounts")
      .then(r => r.json())
      .then(data => {
        const active = Array.isArray(data) && data.find((a: {status: string; nickname: string}) => a.status === "active");
        if (active) { setMeliStatus("connected"); setMeliNickname(active.nickname); }
        else setMeliStatus("disconnected");
      })
      .catch(() => setMeliStatus("disconnected"));
  }, []);
  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #0a0a0a 0%, #121212 50%, #0f1a2e 100%)" }}
    >
      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-16 pb-10 overflow-hidden">
        {/* Glow fondo */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px] opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(ellipse, #FDB71A 0%, transparent 70%)" }}
        />

        {/* Logo */}
        <div className="relative z-10 mb-6">
          <Image
            src="/appjeez-logo.jpg"
            alt="AppJeez"
            width={160}
            height={160}
            className="object-contain mx-auto rounded-2xl"
            priority
          />
        </div>

        <p className="relative z-10 font-bold text-base sm:text-lg mb-2" style={{ color: "#C9A84C" }}>
          Gestión de Cuentas y Ventas Masivas
        </p>
        <p className="relative z-10 text-gray-400 text-sm sm:text-base max-w-lg mb-8">
          Conectá todas tus cuentas de Mercado Libre en un solo panel. Mensajería unificada, publicaciones, órdenes del día, envíos y reputación — todo en tiempo real.
        </p>

        {/* ── CTA dinámico ── */}
        <div className="relative z-10 flex flex-col items-center gap-3 w-full max-w-sm">
          {meliStatus === "connected" ? (
            <Link
              href="/appjeez"
              className="group w-full inline-flex items-center gap-0 rounded-xl overflow-hidden transition-all hover:scale-105"
              style={{ boxShadow: "0 4px 24px rgba(180,134,11,0.5)" }}
            >
              {/* Icono izquierdo */}
              <div className="flex items-center justify-center w-16 h-16 flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #b8860b 0%, #8B6914 100%)" }}>
                <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
                  <ellipse cx="24" cy="24" rx="22" ry="22" fill="#C9A84C" opacity="0.3"/>
                  <path d="M14 28c2-4 6-8 10-8s8 4 10 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M18 22c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="20" cy="30" r="2" fill="#fff"/>
                  <circle cx="28" cy="30" r="2" fill="#fff"/>
                  <path d="M20 30c0 2 1 3 4 3s4-1 4-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              {/* Texto */}
              <div className="flex-1 flex flex-col items-center justify-center px-4 py-3"
                style={{ background: "linear-gradient(135deg, #C9A84C 0%, #b8860b 100%)" }}>
                <span className="font-black text-sm tracking-wide" style={{ color: "#121212" }}>
                  MERCADO LIBRE —
                </span>
                <span className="font-bold text-sm" style={{ color: "#121212" }}>
                  Ingresar al Panel
                </span>
              </div>
              {/* Flecha derecha */}
              <div className="flex items-center justify-center w-12 h-16 flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #b8860b 0%, #8B6914 100%)" }}>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" style={{ color: "#fff" }} />
              </div>
            </Link>
          ) : meliStatus === "disconnected" ? (
            <Link
              href="/configuracion/meli"
              className="group w-full inline-flex items-center gap-0 rounded-xl overflow-hidden transition-all hover:scale-105"
              style={{ boxShadow: "0 4px 24px rgba(180,134,11,0.5)" }}
            >
              <div className="flex items-center justify-center w-16 h-16 flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #b8860b 0%, #8B6914 100%)" }}>
                <svg viewBox="0 0 48 48" width="36" height="36" fill="none">
                  <path d="M14 28c2-4 6-8 10-8s8 4 10 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                  <circle cx="20" cy="30" r="2" fill="#fff"/>
                  <circle cx="28" cy="30" r="2" fill="#fff"/>
                </svg>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center px-4 py-3"
                style={{ background: "linear-gradient(135deg, #C9A84C 0%, #b8860b 100%)" }}>
                <span className="font-black text-sm tracking-wide" style={{ color: "#121212" }}>MERCADO LIBRE —</span>
                <span className="font-bold text-sm" style={{ color: "#121212" }}>Conectar cuenta</span>
              </div>
              <div className="flex items-center justify-center w-12 h-16 flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #b8860b 0%, #8B6914 100%)" }}>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" style={{ color: "#fff" }} />
              </div>
            </Link>
          ) : (
            <div className="w-full h-16 rounded-xl bg-white/5 animate-pulse" />
          )}
        </div>

        {/* ── Panel de Autoridad / Social Proof ── */}
        <div className="relative z-10 mt-8 w-full max-w-2xl rounded-2xl overflow-hidden"
          style={{
            border: "1px solid rgba(184,134,11,0.40)",
            boxShadow: "0 0 40px rgba(255,215,0,0.10)",
          }}>
          <Image
            src="/badges-autoridad.png"
            alt="MercadoLíder Platinum · 30 Años de Experiencia · 100% Calificaciones Positivas"
            width={1200}
            height={300}
            className="w-full h-auto"
            priority
          />
        </div>

        {/* Highlights */}
        <div className="relative z-10 flex flex-wrap justify-center gap-4 mt-6">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-sm text-gray-500">
              <Icon className="w-4 h-4 text-[#FDB71A]" />
              {text}
            </div>
          ))}
        </div>
      </section>


      {/* ── Feature Cards ── */}
      <section className="px-4 pb-12 max-w-4xl mx-auto">
        <h2 className="text-center text-xs font-bold text-gray-600 mb-6 uppercase tracking-widest">
          Módulos del sistema
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ href, icon: Icon, color, glow, border, title, desc, tags }) => (
            <Link
              key={href}
              href={href}
              className="group relative flex flex-col p-5 rounded-2xl transition-all duration-200 hover:-translate-y-1"
              style={{
                background: "rgba(31,31,31,0.85)",
                backdropFilter: "blur(12px)",
                border: `1px solid ${border}`,
                boxShadow: `0 0 20px ${glow}`,
              }}
            >
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at top left, ${glow} 0%, transparent 60%)` }}
              />

              <div className="relative z-10">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: color + "20", border: `1px solid ${border}` }}
                >
                  <Icon className="w-6 h-6" style={{ color }} />
                </div>

                <h3 className="text-lg font-black text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">{desc}</p>

                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: color + "15", border: `1px solid ${color}40`, color }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1 mt-4 text-xs font-semibold" style={{ color }}>
                  Abrir módulo
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Nosotros / Verdent Story ── */}
      <section className="px-4 pb-16 max-w-4xl mx-auto">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(31,31,31,0.70)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {/* Columna izquierda — imagen artística */}
            <div
              className="relative min-h-[240px] sm:min-h-[320px] overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #1a1200 0%, #0f1a2e 100%)",
              }}
            >
              {/* Cuaderno antiguo simulado */}
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="relative w-full max-w-xs">
                  {/* Cuaderno */}
                  <div
                    className="absolute left-0 top-4 w-[55%] h-[180px] rounded-lg p-4"
                    style={{
                      background: "linear-gradient(145deg, #c8b08a 0%, #a0855a 100%)",
                      boxShadow: "4px 4px 20px rgba(0,0,0,0.60)",
                      transform: "rotate(-4deg)",
                    }}
                  >
                    <div className="border-b border-amber-700/40 pb-1 mb-2">
                      <p className="text-[8px] font-bold text-amber-900 uppercase tracking-wider">Taller Maqjeez</p>
                    </div>
                    {[...Array(7)].map((_, i) => (
                      <div key={i} className="h-px bg-amber-700/30 mb-2.5" />
                    ))}
                    <div className="flex gap-2 mt-3 opacity-60">
                      <div className="w-8 h-8 rounded border border-amber-800/50 flex items-center justify-center">
                        <Wrench className="w-4 h-4 text-amber-800" />
                      </div>
                      <div className="w-8 h-8 rounded border border-amber-800/50 flex items-center justify-center">
                        <Package className="w-4 h-4 text-amber-800" />
                      </div>
                    </div>
                  </div>

                  {/* Pantalla de código */}
                  <div
                    className="absolute right-0 top-0 w-[55%] h-[180px] rounded-lg p-3"
                    style={{
                      background: "#0d1117",
                      border: "1px solid rgba(0,229,255,0.30)",
                      boxShadow: "0 0 20px rgba(0,229,255,0.15), 4px 4px 20px rgba(0,0,0,0.60)",
                      transform: "rotate(3deg)",
                    }}
                  >
                    <div className="flex gap-1 mb-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                    {[
                      { color: "#00E5FF", text: "const taller = " },
                      { color: "#39FF14", text: "  new Maqjeez();" },
                      { color: "#A855F7", text: "await supabase" },
                      { color: "#FDB71A", text: "  .from('ordenes')" },
                      { color: "#00E5FF", text: "  .select('*');" },
                    ].map((line, i) => (
                      <p key={i} className="text-[8px] font-mono" style={{ color: line.color }}>
                        {line.text}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Año overlay */}
              <div className="absolute bottom-4 left-4">
                <span
                  className="text-4xl font-black opacity-10"
                  style={{ color: "#FFD700" }}
                >1995</span>
              </div>
              <div className="absolute bottom-4 right-4">
                <span
                  className="text-4xl font-black opacity-10"
                  style={{ color: "#00E5FF" }}
                >2026</span>
              </div>
            </div>

            {/* Columna derecha — texto */}
            <div className="p-8 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-1 h-12 rounded-full"
                  style={{ background: "linear-gradient(to bottom, #FFD700, #FF5722)" }}
                />
                <div>
                  <p className="text-xs text-yellow-500 font-bold uppercase tracking-widest">Nuestra Historia</p>
                  <h3 className="text-xl font-black text-white leading-tight">
                    De los cuadernos de hace<br />
                    <span style={{ color: "#FFD700" }}>30 años</span> a la IA y Supabase
                  </h3>
                </div>
              </div>

              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                Maqjeez nació en el mostrador del taller, de la necesidad de eficiencia. Más de tres décadas atendiendo desmalezadoras, motosierras y motoherramientas de todo tipo nos dieron una visión única del negocio.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Hoy, somos un equipo de expertos mecánicos impulsados por <span className="text-[#00E5FF] font-semibold">Verdent IA</span>, combinando el conocimiento del taller con tecnología de punta para que cada orden, cada venta y cada envío Flex sea perfecto.
              </p>

              <div className="flex flex-wrap gap-3">
                {[
                  { label: "+30", sub: "años de taller" },
                  { label: "5★",  sub: "calificaciones ML" },
                  { label: "IA",  sub: "Verdent powered" },
                ].map(({ label, sub }) => (
                  <div
                    key={sub}
                    className="flex flex-col items-center px-4 py-2 rounded-xl"
                    style={{
                      background: "rgba(255,215,0,0.07)",
                      border: "1px solid rgba(184,134,11,0.30)",
                    }}
                  >
                    <p
                      className="text-xl font-black"
                      style={{ color: "#FFD700", textShadow: "0 0 8px rgba(255,215,0,0.40)" }}
                    >{label}</p>
                    <p className="text-[10px] text-yellow-700 font-semibold">{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-6 text-center">
        <p className="text-gray-700 text-xs">
          MAQJEEZ Repuestos · Sistema de Gestión v2.0 · 2026 · Powered by Verdent IA
        </p>
      </footer>
    </div>
  );
}
