"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, BarChart2, Users, Truck, ShoppingCart } from "lucide-react";

interface Props {
  notificationCount?: number;
  onOpenNotifications?: () => void;
}

export default function BottomNav({ notificationCount = 0, onOpenNotifications }: Props) {
  const pathname = usePathname();

  const tabs = [
    { href: "/taller", label: "Taller", icon: LayoutDashboard },
    { href: "/inventario", label: "Inventario", icon: Package },
    { href: "/ventas", label: "Vender", icon: ShoppingCart },
    { href: "/flex", label: "Flex", icon: Truck },
    { href: "/estadisticas", label: "Stats", icon: BarChart2 },
  ];

  return (
    <nav
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10"
      style={{
        background: "rgba(18,18,18,0.96)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 -4px 30px rgba(0,0,0,0.60)",
      }}
    >
      <div className="flex items-stretch" style={{ height: "60px", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors"
            >
              <Icon
                className={`w-5 h-5 transition-all ${active ? "stroke-[2.5]" : ""}`}
                style={active ? { color: "#00E5FF", filter: "drop-shadow(0 0 6px rgba(0,229,255,0.70))" } : { color: "#6B7280" }}
              />
              <span
                className="text-[10px] font-semibold"
                style={active ? { color: "#00E5FF" } : { color: "#6B7280" }}
              >
                {label}
              </span>
              {active && (
                <span
                  className="absolute bottom-0 w-10 h-[3px] rounded-full"
                  style={{ background: "#00E5FF", boxShadow: "0 0 8px rgba(0,229,255,0.80)" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
