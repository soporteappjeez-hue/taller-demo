"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Search, Loader2, RefreshCw } from "lucide-react";

type ShippingMethod = "todas" | "correo" | "flex" | "turbo";

interface PrintedLabel {
  id: string;
  shipment_id: number;
  order_id: number | null;
  tracking_number: string | null;
  buyer_nickname: string | null;
  sku: string | null;
  variation: string | null;
  quantity: number | null;
  account_id: string | null;
  shipping_method: string | null;
  file_path: string;
  print_date: string;
  meli_user_id: string;
}

export default function HistorialEtiquetasPage() {
  const [allLabels, setAllLabels] = useState<PrintedLabel[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<ShippingMethod>("todas");

  // Cargar todas las etiquetas recientes via API (server-side, sin problemas de API key)
  const loadLabels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meli-labels/search?q=&limit=200&all=true");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAllLabels((data.results as PrintedLabel[]) || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  // Filtrar por búsqueda y tipo
  const filteredResults = useMemo(() => {
    let filtered = allLabels;

    // Filtro de búsqueda
    if (query.length >= 2) {
      const q = query.toLowerCase();
      filtered = filtered.filter((r) =>
        String(r.shipment_id).toLowerCase().includes(q) ||
        (r.sku || "").toLowerCase().includes(q) ||
        (r.buyer_nickname || "").toLowerCase().includes(q) ||
        (r.tracking_number || "").toLowerCase().includes(q) ||
        (r.account_id || "").toLowerCase().includes(q)
      );
    }

    // Filtro por tipo de envío
    if (activeTab !== "todas") {
      filtered = filtered.filter((r) => r.shipping_method === activeTab);
    }

    return filtered;
  }, [allLabels, query, activeTab]);

  // Contar por tipo
  const typeCounts = useMemo(() => {
    const base = query.length >= 2
      ? allLabels.filter((r) => {
          const q = query.toLowerCase();
          return (
            String(r.shipment_id).toLowerCase().includes(q) ||
            (r.sku || "").toLowerCase().includes(q) ||
            (r.buyer_nickname || "").toLowerCase().includes(q) ||
            (r.tracking_number || "").toLowerCase().includes(q)
          );
        })
      : allLabels;

    return {
      todas: base.length,
      correo: base.filter((r) => r.shipping_method === "correo").length,
      flex: base.filter((r) => r.shipping_method === "flex").length,
      turbo: base.filter((r) => r.shipping_method === "turbo").length,
    };
  }, [allLabels, query]);

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResults.map((r) => r.id)));
    }
  };

  const downloadSelected = async () => {
    if (selectedIds.size === 0) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/meli-labels/download-combined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          meli_user_id: "",
        }),
      });

      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `historial-etiquetas-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setSelectedIds(new Set());
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDownloading(false);
    }
  };

  const downloadIndividual = (filePath: string) => {
    window.open(filePath, "_blank");
  };

  return (
    <main className="min-h-screen" style={{ background: "#121212" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-30 px-4 py-3 flex items-center gap-3 border-b"
        style={{ background: "#181818", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <Link
          href="/appjeez/etiquetas"
          className="p-1.5 rounded-lg"
          style={{ color: "#6B7280" }}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-black text-white flex-1">Historial de Etiquetas</h1>
        <button
          onClick={loadLabels}
          disabled={loading}
          className="p-2 rounded-lg transition-all"
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Main */}
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Tabs por Tipo de Envío */}
        <div className="flex gap-2 flex-wrap">
          {(["todas", "correo", "flex", "turbo"] as ShippingMethod[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: activeTab === tab ? "#39FF14" : "rgba(255,255,255,0.05)",
                color: activeTab === tab ? "#121212" : "#9CA3AF",
                border: activeTab === tab ? "1px solid #39FF14" : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {tab === "todas" && "Todas"}
              {tab === "correo" && "Correo"}
              {tab === "flex" && "Flex"}
              {tab === "turbo" && "Turbo"}
              <span className="ml-2 text-xs opacity-75">({typeCounts[tab]})</span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por SKU, tracking, comprador, shipment..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
              style={{
                background: "#1F1F1F",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={downloadSelected}
              disabled={downloading}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all"
              style={{
                background: "#39FF14",
                color: "#121212",
              }}
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Descargando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Descargar {selectedIds.size}
                </>
              )}
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-500" />
            <p className="text-sm text-gray-500 mt-2">Cargando historial...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 rounded-lg" style={{ background: "#FF6B6B20", borderLeft: "2px solid #FF6B6B" }}>
            <p className="text-sm text-red-400">Error: {error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredResults.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: "#6B7280" }}>
              {allLabels.length === 0
                ? "No hay etiquetas en el historial"
                : "No se encontraron resultados para la busqueda"}
            </p>
          </div>
        )}

        {/* Table */}
        {filteredResults.length > 0 && (
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            <table className="w-full text-sm">
              <thead style={{ background: "#1F1F1F" }}>
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredResults.length && filteredResults.length > 0}
                      onChange={selectAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="px-4 py-3 text-left" style={{ color: "#9CA3AF" }}>
                    Envio
                  </th>
                  <th className="px-4 py-3 text-left" style={{ color: "#9CA3AF" }}>
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left" style={{ color: "#9CA3AF" }}>
                    Comprador
                  </th>
                  <th className="px-4 py-3 text-left" style={{ color: "#9CA3AF" }}>
                    Metodo
                  </th>
                  <th className="px-4 py-3 text-left" style={{ color: "#9CA3AF" }}>
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-center" style={{ color: "#9CA3AF" }}>
                    Accion
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((label, idx) => (
                  <tr
                    key={label.id}
                    style={{
                      background: idx % 2 === 0 ? "#1A1A1A" : "#121212",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(label.id)}
                        onChange={() => toggleSelection(label.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-4 py-3 text-white">
                      {label.buyer_nickname === "USUARIO_TEST" && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold mr-2"
                          style={{ background: "rgba(57,255,20,0.2)", color: "#39FF14" }}
                        >
                          TEST
                        </span>
                      )}
                      {label.shipment_id}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#9CA3AF" }}>
                      {label.sku || "-"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#9CA3AF" }}>
                      {label.buyer_nickname || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded text-xs font-semibold"
                        style={{
                          background:
                            label.shipping_method === "flex"
                              ? "#0EA5E920"
                              : label.shipping_method === "correo"
                              ? "#F59E0B20"
                              : label.shipping_method === "turbo"
                              ? "#A855F720"
                              : "#6B728020",
                          color:
                            label.shipping_method === "flex"
                              ? "#0EA5E9"
                              : label.shipping_method === "correo"
                              ? "#F59E0B"
                              : label.shipping_method === "turbo"
                              ? "#A855F7"
                              : "#9CA3AF",
                        }}
                      >
                        {label.shipping_method?.toUpperCase() || "OTHER"}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#9CA3AF" }}>
                      {new Date(label.print_date).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => downloadIndividual(label.file_path)}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded transition-all hover:opacity-80"
                        style={{ color: "#0EA5E9" }}
                      >
                        <Download className="w-3 h-3" />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
