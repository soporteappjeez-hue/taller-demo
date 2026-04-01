"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchPrintedLabels, type PrintedLabel } from "@/hooks/useSearchPrintedLabels";
import Link from "next/link";
import { ArrowLeft, Download, Search, Loader2 } from "lucide-react";

type ShippingMethod = "todas" | "correo" | "flex" | "turbo";

export default function HistorialEtiquetasPage() {
  const [meliUserId, setMeliUserId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<ShippingMethod>("todas");

  const { query, setQuery, results, loading, error } = useSearchPrintedLabels(
    undefined,
    meliUserId
  );

  // Obtener meli_user_id del usuario (simplificado, en producción usar auth)
  useEffect(() => {
    const storedId = localStorage.getItem("meli_user_id");
    if (storedId) setMeliUserId(storedId);
  }, []);

  // Filtrar resultados por tipo de envío
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (activeTab === "todas") return true;
      return r.shipping_method === activeTab;
    });
  }, [results, activeTab]);

  // Contar por tipo
  const typeCounts = useMemo(() => {
    return {
      todas: results.length,
      correo: results.filter((r) => r.shipping_method === "correo").length,
      flex: results.filter((r) => r.shipping_method === "flex").length,
      turbo: results.filter((r) => r.shipping_method === "turbo").length,
    };
  }, [results]);

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
          meli_user_id: meliUserId,
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
    const a = document.createElement("a");
    a.href = filePath;
    a.download = `etiqueta-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
        <h1 className="font-black text-white">Historial de Etiquetas</h1>
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
              {tab === "correo" && "📮 Correo"}
              {tab === "flex" && "🚚 Flex"}
              {tab === "turbo" && "⚡ Turbo"}
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
              placeholder="Buscar por SKU, tracking, comprador..."
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

        {/* Results */}
        {loading && query.length >= 2 && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-500" />
            <p className="text-sm text-gray-500 mt-2">Buscando...</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg" style={{ background: "#FF6B6B20", borderLeft: "2px solid #FF6B6B" }}>
            <p className="text-sm text-red-400">Error: {error}</p>
          </div>
        )}

        {query.length < 2 && (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: "#6B7280" }}>
              Ingresa al menos 2 caracteres para buscar
            </p>
          </div>
        )}

        {query.length >= 2 && !loading && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: "#6B7280" }}>
              No se encontraron resultados
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
                    Envío
                  </th>
                  <th className="px-4 py-3 text-left" style={{ color: "#9CA3AF" }}>
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left" style={{ color: "#9CA3AF" }}>
                    Comprador
                  </th>
                  <th className="px-4 py-3 text-left" style={{ color: "#9CA3AF" }}>
                    Método
                  </th>
                  <th className="px-4 py-3 text-left" style={{ color: "#9CA3AF" }}>
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-center" style={{ color: "#9CA3AF" }}>
                    Acción
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
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold mr-2 mb-1"
                          style={{ background: "rgba(57,255,20,0.2)", color: "#39FF14" }}
                        >
                          🧪 TEST
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
                              : "#6B728020",
                          color:
                            label.shipping_method === "flex"
                              ? "#0EA5E9"
                              : label.shipping_method === "correo"
                              ? "#F59E0B"
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
