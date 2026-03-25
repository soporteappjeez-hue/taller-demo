"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wrench, Package, LayoutDashboard, AlertTriangle, MessageCircle, BarChart2 } from "lucide-react";
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
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
      badge: overdueCount > 0 ? overdueCount : 0,
      badgeColor: "bg-red-500",
    },
    {
      href: "/inventario",
      label: "Inventario",
      icon: Package,
      badge: lowStockCount > 0 ? lowStockCount : 0,
      badgeColor: "bg-yellow-500",
    },
    {
      href: "/estadisticas",
      label: "Estadísticas",
      icon: BarChart2,
      badge: 0,
      badgeColor: "",
    },
  ];

  return (
    <header className="bg-gray-900 dark:bg-gray-900 border-b border-gray-700 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 rounded-xl p-2">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <span className="font-black text-orange-400 text-lg tracking-tight">MAQJEEZ</span>
              <p className="text-xs text-gray-500 -mt-0.5 hidden sm:block">Taller de Motovehículos</p>
            </div>
          </div>

          {/* Nav links + notification bell */}
          <nav className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon, badge, badgeColor }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`
                    relative flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-sm
                    transition-colors duration-150
                    ${active
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                  {badge > 0 && (
                    <span
                      className={`absolute -top-1 -right-1 ${badgeColor} text-white text-xs
                        font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1`}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* WhatsApp Notifications button */}
            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-sm
                  transition-colors duration-150
                  ${notificationCount > 0
                    ? "bg-green-700/30 text-green-400 hover:bg-green-700/50"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                  }`}
                title="Notificaciones WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">WhatsApp</span>
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs
                    font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                    {notificationCount}
                  </span>
                )}
              </button>
            )}

            {/* Theme toggle */}
            <ThemeToggle />
          </nav>
        </div>
      </div>

      {/* Alerta barra roja si hay vencidos */}
      {overdueCount > 0 && (
        <div className="bg-red-600/20 border-t border-red-600/40 px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center gap-2 text-red-400 text-sm font-semibold">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {overdueCount} equipo{overdueCount > 1 ? "s" : ""} lleva{overdueCount === 1 ? "" : "n"} más de 90 días esperando retiro
            </span>
          </div>
        </div>
      )}
    </header>
  );
}
