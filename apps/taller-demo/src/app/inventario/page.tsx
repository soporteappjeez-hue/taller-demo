"use client";

import { useState } from "react";
import {
  Package,
  ShoppingCart,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
} from "lucide-react";
import { StockItem, PartToOrder, PART_ORDER_STATUS_LABELS } from "@/lib/types";
import { generateId, formatDate } from "@/lib/utils";
import { useInventory } from "@/hooks/useInventory";
import { useOrders } from "@/hooks/useOrders";
import Navbar from "@/components/Navbar";
import StockForm from "@/components/inventory/StockForm";
import PartOrderForm from "@/components/inventory/PartOrderForm";

const PART_STATUS_COLORS: Record<PartToOrder["status"], string> = {
  pendiente: "bg-yellow-900/50 text-yellow-400 border-yellow-600",
  pedido: "bg-blue-900/50 text-blue-400 border-blue-600",
  recibido: "bg-green-900/50 text-green-400 border-green-600",
};

const PART_STATUS_ICONS: Record<PartToOrder["status"], React.ElementType> = {
  pendiente: Clock,
  pedido: ShoppingCart,
  recibido: CheckCircle,
};

export default function InventarioPage() {
  const {
    stock,
    partsToOrder,
    createStock,
    updateStock,
    deleteStock,
    createPart,
    updatePart,
    deletePart,
    lowStockCount,
  } = useInventory();

  const { overdueCount } = useOrders();

  const [tab, setTab] = useState<"stock" | "pedir">("stock");
  const [showStockForm, setShowStockForm] = useState(false);
  const [editingStock, setEditingStock] = useState<StockItem | null>(null);
  const [showPartForm, setShowPartForm] = useState(false);
  const [editingPart, setEditingPart] = useState<PartToOrder | null>(null);

  const handleSaveStock = (item: StockItem) => {
    if (editingStock) updateStock(item.id, item);
    else createStock({ ...item, id: generateId() });
    setShowStockForm(false);
    setEditingStock(null);
  };

  const handleSavePart = (part: PartToOrder) => {
    if (editingPart) updatePart(part.id, part);
    else createPart({ ...part, id: generateId(), createdAt: new Date().toISOString() });
    setShowPartForm(false);
    setEditingPart(null);
  };

  const handleDeleteStock = (id: string) => {
    if (confirm("¿Eliminar este repuesto del stock?")) deleteStock(id);
  };

  const handleDeletePart = (id: string) => {
    if (confirm("¿Eliminar este pedido?")) deletePart(id);
  };

  return (
    <>
      <Navbar overdueCount={overdueCount} lowStockCount={lowStockCount} />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-white">Inventario</h1>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border border-gray-700">
          <button
            onClick={() => setTab("stock")}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 font-bold text-sm transition-colors
              ${tab === "stock" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
          >
            <Package className="w-4 h-4" />
            Stock ({stock.length})
            {lowStockCount > 0 && (
              <span className="bg-yellow-500 text-black text-xs font-black px-1.5 py-0.5 rounded-full">
                {lowStockCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("pedir")}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 font-bold text-sm transition-colors
              ${tab === "pedir" ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
          >
            <ShoppingCart className="w-4 h-4" />
            A Pedir ({partsToOrder.filter((p) => p.status !== "recibido").length})
          </button>
        </div>

        {/* TAB: STOCK */}
        {tab === "stock" && (
          <div className="space-y-3">
            {lowStockCount > 0 && (
              <div className="card-alert flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-300 font-semibold text-sm">
                  {lowStockCount} repuesto{lowStockCount > 1 ? "s" : ""} con stock bajo o en cero
                </p>
              </div>
            )}

            {stock.length === 0 ? (
              <div className="card flex flex-col items-center py-14 text-center">
                <Package className="w-12 h-12 text-gray-700 mb-4" />
                <p className="text-gray-400 font-semibold">No hay repuestos en stock</p>
                <p className="text-gray-600 text-sm mt-1">Tocá el botón naranja para agregar</p>
              </div>
            ) : (
              stock.map((item) => {
                const lowStock = item.quantity <= item.minQuantity;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 transition-all
                      ${lowStock
                        ? "bg-yellow-950/40 border-yellow-600/60"
                        : "bg-gray-900 border-gray-700"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {lowStock && (
                            <span className="badge bg-yellow-900/50 text-yellow-400 border-yellow-600">
                              <AlertTriangle className="w-3 h-3" />
                              Stock bajo
                            </span>
                          )}
                        </div>
                        <h3 className="text-white font-bold text-base">{item.name}</h3>
                        <div className="flex flex-wrap gap-3 mt-1.5 text-sm">
                          <span className="text-gray-300 font-semibold">
                            Qty:{" "}
                            <span className={lowStock ? "text-yellow-400" : "text-green-400"}>
                              {item.quantity}
                            </span>
                            <span className="text-gray-600 font-normal">/{item.minQuantity} min</span>
                          </span>
                          {item.location && (
                            <span className="flex items-center gap-1 text-gray-400">
                              <MapPin className="w-3.5 h-3.5" />
                              {item.location}
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <p className="text-gray-500 text-xs mt-1">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => { setEditingStock(item); setShowStockForm(true); }}
                          className="btn btn-secondary btn-sm px-3 rounded-xl"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteStock(item.id)}
                          className="btn btn-sm px-3 rounded-xl bg-gray-800 text-gray-500 hover:text-red-400 hover:bg-red-900/30 border border-gray-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB: A PEDIR */}
        {tab === "pedir" && (
          <div className="space-y-3">
            {partsToOrder.length === 0 ? (
              <div className="card flex flex-col items-center py-14 text-center">
                <ShoppingCart className="w-12 h-12 text-gray-700 mb-4" />
                <p className="text-gray-400 font-semibold">No hay pedidos pendientes</p>
                <p className="text-gray-600 text-sm mt-1">Tocá el botón naranja para agregar un pedido</p>
              </div>
            ) : (
              partsToOrder.map((part) => {
                const StatusIcon = PART_STATUS_ICONS[part.status];
                return (
                  <div key={part.id} className="card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`badge ${PART_STATUS_COLORS[part.status]}`}>
                            <StatusIcon className="w-3 h-3" />
                            {PART_ORDER_STATUS_LABELS[part.status]}
                          </span>
                        </div>
                        <h3 className="text-white font-bold text-base">{part.name}</h3>
                        <div className="flex flex-wrap gap-3 mt-1.5 text-sm text-gray-400">
                          <span>Qty: <span className="text-gray-200 font-semibold">{part.quantity}</span></span>
                          {part.supplier && <span>Proveedor: <span className="text-gray-200">{part.supplier}</span></span>}
                          {part.orderClientName && (
                            <span>Para: <span className="text-orange-400 font-semibold">{part.orderClientName}</span></span>
                          )}
                          <span className="text-gray-600">{formatDate(part.createdAt)}</span>
                        </div>
                        {part.notes && (
                          <p className="text-gray-500 text-xs mt-1">{part.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Toggle rápido de estado */}
                        {part.status !== "recibido" && (
                          <button
                            onClick={() =>
                              updatePart(part.id, {
                                status: part.status === "pendiente" ? "pedido" : "recibido",
                              })
                            }
                            className="btn btn-sm px-3 rounded-xl bg-blue-900/40 text-blue-400 border border-blue-700 hover:bg-blue-900/70"
                            title="Avanzar estado"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingPart(part); setShowPartForm(true); }}
                          className="btn btn-secondary btn-sm px-3 rounded-xl"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePart(part.id)}
                          className="btn btn-sm px-3 rounded-xl bg-gray-800 text-gray-500 hover:text-red-400 hover:bg-red-900/30 border border-gray-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => {
          if (tab === "stock") {
            setEditingStock(null);
            setShowStockForm(true);
          } else {
            setEditingPart(null);
            setShowPartForm(true);
          }
        }}
        className="fixed bottom-6 right-6 btn-primary rounded-2xl shadow-2xl shadow-orange-500/40
                   h-16 w-16 sm:w-auto sm:px-6 z-40"
        aria-label="Agregar"
      >
        <Plus className="w-7 h-7 flex-shrink-0" />
        <span className="hidden sm:inline text-base">
          {tab === "stock" ? "Agregar al Stock" : "Agregar Pedido"}
        </span>
      </button>

      {showStockForm && (
        <StockForm
          initial={editingStock ?? undefined}
          onSave={handleSaveStock}
          onClose={() => { setShowStockForm(false); setEditingStock(null); }}
        />
      )}

      {showPartForm && (
        <PartOrderForm
          initial={editingPart ?? undefined}
          onSave={handleSavePart}
          onClose={() => { setShowPartForm(false); setEditingPart(null); }}
        />
      )}
    </>
  );
}
