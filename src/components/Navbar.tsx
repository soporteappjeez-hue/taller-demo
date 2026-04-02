"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Package, LayoutDashboard, AlertTriangle,
  MessageCircle, BarChart2, Users, Truck, ShoppingCart,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

interface NavbarProps {
  overdueCount?: number;
  lowStockCount?: number;
  notificationCount?: number;
  onOpenNotifications?: () => void;
}

export default function Navbar({
  overdueCount = 0,
  lowStockCount = 0,
  notificationCount = 0,
  onOpenNotifications,
}: NavbarProps) {
  const pathname = usePathname();

  const links = [
    { href: "/taller",       label: "Taller",       icon: LayoutDashboard, badge: overdueCount,  badgeColor: "bg-red-500" },
    { href: "/ventas",       label: "Vender",       icon: ShoppingCart,    badge: 0,             badgeColor: "" },
    { href: "/estadisticas", label: "Estadísticas", icon: BarChart2,       badge: 0,             badgeColor: "" },
    { href: "/agenda",       label: "Agenda",       icon: Users,           badge: 0,             badgeColor: "" },
  ];

  return (
    <header className="bg-[#FDB71A] border-b border-[#E09A00] sticky top-0 z-50 shadow-lg">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">

          {/* Logo — clic lleva al inicio */}
          <Link href="/" className="flex items-center h-full py-1">
            <Image
              src="/logo-maqjeez.png"
              alt="MAQJEEZ"
              width={130}
              height={44}
              className="object-contain h-full w-auto"
              priority
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {links.map(({ href, label, icon: Icon, badge, badgeColor }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  style={active ? {
                    background: "rgba(30,58,138,0.92)",
                    boxShadow: "0 0 14px 2px rgba(0,229,255,0.35)",
                    border: "1px solid rgba(0,229,255,0.50)",
                  } : {}}
                  className={`relative flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm transition-all
                    ${active
                      ? "text-white"
                      : "text-[#1E3A8A] hover:bg-[#E09A00]/40"}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                  {badge > 0 && (
                    <span className={`absolute -top-1 -right-1 ${badgeColor} text-white text-[10px]
                      font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1`}>
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-sm transition-colors
                  ${notificationCount > 0
                    ? "text-green-800 bg-green-200/40 hover:bg-green-200/60"
                    : "text-[#1E3A8A] hover:bg-[#E09A00]/40"}`}
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-600 text-white text-[10px]
                    font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {notificationCount}
                  </span>
                )}
              </button>
            )}

            <ThemeToggle />
          </nav>

          {/* Mobile: iconos rápidos */}
          <div className="sm:hidden flex items-center gap-2">
            {onOpenNotifications && notificationCount > 0 && (
              <button
                onClick={onOpenNotifications}
                className="relative p-2 rounded-xl bg-green-200/40 text-green-800"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 bg-green-600 text-white text-[9px]
                  font-black rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                  {notificationCount}
                </span>
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Alerta equipos vencidos */}
      {overdueCount > 0 && (
        <div className="bg-red-700/20 border-t border-red-500/40 px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center gap-2 text-red-800 text-sm font-semibold">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {overdueCount} equipo{overdueCount > 1 ? "s" : ""} con más de 90 días esperando retiro
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
