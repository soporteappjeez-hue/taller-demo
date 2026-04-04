"use client";

import { Package, AlertTriangle } from "lucide-react";

interface Item {
  id: string;
  title: string;
  status: string;
  available_quantity: number;
  total_quantity: number;
  price: number;
  currency_id: string;
}

interface Stats {
  total_active_items: number;
  items_low_stock: number;
  items_out_of_stock: number;
}

interface Props {
  items: Item[];
  stats: Stats;
}

/**
 * Tabla de publicaciones activas con información de stock en tiempo real
 * Muestra indicadores visuales de disponibilidad
 */
export default function ItemsTable({ items, stats }: Props) {
  // Validar que items sea un array válido
  const validItems = Array.isArray(items) ? items.filter(item => item && typeof item === 'object') : [];
  const validStats = stats || { total_active_items: 0, items_low_stock: 0, items_out_of_stock: 0 };
  /**
   * Determinar indicador de stock
   */
  const getStockIndicator = (availableQty: number) => {
    if (availableQty === 0) {
      return { icon: "🔴", label: "Sin stock", color: "#ef4444" };
    }
    if (availableQty <= 10) {
      return { icon: "🟡", label: "Stock bajo", color: "#FFE600" };
    }
    return { icon: "🟢", label: "En stock", color: "#39FF14" };
  };

  /**
   * Formatear precio
   */
  const formatPrice = (price: number, currencyId: string) => {
    if (currencyId === "ARS") {
      return `$${Math.round(price).toLocaleString("es-AR")}`;
    }
    return `${currencyId} ${price.toFixed(0)}`;
  };

  return (
    <div className="space-y-3">
      {/* Resumen de stock */}
      <div className="grid grid-cols-3 gap-2">
        <div
          className="rounded-lg p-2 text-center border"
          style={{
            background: "#39FF1415",
            borderColor: "#39FF1433",
            color: "#39FF14",
          }}
        >
          <p className="text-xs font-bold">{validStats.total_active_items}</p>
          <p className="text-[10px]">Activas</p>
        </div>
        <div
          className="rounded-lg p-2 text-center border"
          style={{
            background: "#FFE60015",
            borderColor: "#FFE60033",
            color: "#FFE600",
          }}
        >
          <p className="text-xs font-bold">{validStats.items_low_stock}</p>
          <p className="text-[10px]">Bajo Stock</p>
        </div>
        <div
          className="rounded-lg p-2 text-center border"
          style={{
            background: "#ef444415",
            borderColor: "#ef444433",
            color: "#ef4444",
          }}
        >
          <p className="text-xs font-bold">{validStats.items_out_of_stock}</p>
          <p className="text-[10px]">Sin Stock</p>
        </div>
      </div>

      {/* Tabla de items */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <th className="text-left p-2 font-bold text-gray-400">Título</th>
              <th className="text-center p-2 font-bold text-gray-400">Stock</th>
              <th className="text-right p-2 font-bold text-gray-400">Precio</th>
            </tr>
          </thead>
          <tbody>
            {validItems && validItems.map((item) => {
              if (!item || typeof item !== 'object') return null;
              
              const stockInfo = getStockIndicator(item.available_quantity ?? 0);
              return (
                <tr
                  key={item.id || Math.random()}
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    background:
                      (item.available_quantity ?? 0) === 0
                        ? "rgba(239, 68, 68, 0.05)"
                        : (item.available_quantity ?? 0) <= 10
                          ? "rgba(255, 230, 0, 0.05)"
                          : "transparent",
                  }}
                >
                  {/* Título */}
                  <td className="p-2">
                    <p
                      className="truncate text-gray-300"
                      title={item.title || "Sin título"}
                    >
                      {(item.title || "Sin título").substring(0, 30)}...
                    </p>
                  </td>

                  {/* Stock con indicador */}
                  <td className="p-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span>{stockInfo.icon}</span>
                      <span
                        style={{ color: stockInfo.color }}
                        className="font-semibold"
                      >
                        {item.available_quantity ?? 0}
                      </span>
                    </div>
                  </td>

                  {/* Precio */}
                  <td className="p-2 text-right text-gray-400">
                    {formatPrice(item.price ?? 0, item.currency_id ?? "ARS")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {validItems.length === 0 && (
          <div className="text-center py-4 text-gray-500 text-xs">
            No hay publicaciones activas
          </div>
        )}
      </div>
    </div>
  );
}
