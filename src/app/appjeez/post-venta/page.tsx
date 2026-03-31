"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import UnifiedPostSalePanel from "@/components/UnifiedPostSalePanel";

interface AccountData {
  meli_user_id: string;
  account_name: string;
  roman_index: string;
  claims_count: number;
  claims_percent?: number;
  mediations_count?: number;
  mediations_percent?: number;
  delayed_shipments?: number;
  cancellations_percent?: number;
  reputation_risk: "low" | "medium" | "high" | "critical";
}

export default function PostVentaPage() {
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch("/api/meli-accounts");
        if (!res.ok) throw new Error("Failed to fetch accounts");
        const data = await res.json();

        // Transformar datos al formato requerido
        const transformed = data.map((acc: any) => {
          const claimsPercent = acc.claims_count ?? 0;
          let riskLevel: "low" | "medium" | "high" | "critical" = "low";

          if (claimsPercent > 2) {
            riskLevel = "critical";
          } else if (claimsPercent > 1.5) {
            riskLevel = "high";
          } else if (claimsPercent > 1) {
            riskLevel = "medium";
          }

          return {
            meli_user_id: acc.meli_user_id,
            account_name: acc.account,
            roman_index: acc.roman_index || "",
            claims_count: acc.claims_count ?? 0,
            claims_percent: acc.reputation?.claims ? (acc.reputation.claims * 100) : undefined,
            mediations_count: 0, // TODO: Obtener de API
            mediations_percent: acc.reputation?.cancellations ? (acc.reputation.cancellations * 100) : undefined,
            delayed_shipments: 0, // TODO: Obtener de API
            cancellations_percent: acc.reputation?.delayed_handling_time
              ? (acc.reputation.delayed_handling_time * 100)
              : undefined,
            reputation_risk: riskLevel,
          };
        });

        setAccounts(transformed);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  return (
    <div className="min-h-screen flex" style={{ background: "#121212" }}>
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div
          className="border-b px-4 py-4 flex items-center justify-between"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "#181818" }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" style={{ color: "#EF4444" }} />
            <h1 className="font-black text-lg text-white">Gestión Post-Venta</h1>
          </div>
          <Link
            href="/appjeez"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all hover:bg-opacity-80"
            style={{ background: "#FFE60022", color: "#FFE600", textDecoration: "none" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al Dashboard
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 py-4">
          {error && (
            <div
              className="rounded-lg p-4 mb-4 text-sm"
              style={{ background: "#EF444422", color: "#EF4444" }}
            >
              Error: {error}
            </div>
          )}

          {/* Unified Panel */}
          <UnifiedPostSalePanel accounts={accounts} isLoading={loading} />

          {/* Tabla Detallada */}
          {!loading && accounts.length > 0 && (
            <div
              className="mt-6 rounded-lg overflow-hidden"
              style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {/* Header */}
              <div
                className="px-4 py-3 grid grid-cols-5 gap-2 text-xs font-bold"
                style={{ background: "#0f0f0f", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div>Cuenta</div>
                <div className="text-center">Reclamos</div>
                <div className="text-center">Mediaciones</div>
                <div className="text-center">Demoras</div>
                <div className="text-center">Riesgo</div>
              </div>

              {/* Rows */}
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                {accounts.map((acc) => (
                  <div
                    key={acc.meli_user_id}
                    className="px-4 py-3 grid grid-cols-5 gap-2 items-center text-xs hover:bg-opacity-50 transition-colors"
                    style={{ background: "rgba(0,0,0,0.2)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-6 h-6 rounded text-xs font-bold flex items-center justify-center flex-shrink-0"
                        style={{ background: "#FFE600", color: "#121212" }}
                      >
                        {acc.roman_index}
                      </span>
                      <span className="truncate">{acc.account_name}</span>
                    </div>

                    <div className="text-center">
                      <p className="font-bold" style={{ color: acc.claims_count > 0 ? "#EF4444" : "#6B7280" }}>
                        {acc.claims_count}
                      </p>
                      {acc.claims_percent && (
                        <p style={{ color: "#6B7280", fontSize: "10px" }}>
                          {acc.claims_percent.toFixed(2)}%
                        </p>
                      )}
                    </div>

                    <div className="text-center">
                      <p className="font-bold" style={{ color: (acc.mediations_count ?? 0) > 0 ? "#FF5722" : "#6B7280" }}>
                        {acc.mediations_count ?? 0}
                      </p>
                      {acc.mediations_percent && (
                        <p style={{ color: "#6B7280", fontSize: "10px" }}>
                          {acc.mediations_percent.toFixed(2)}%
                        </p>
                      )}
                    </div>

                    <div className="text-center">
                      <p className="font-bold" style={{ color: (acc.delayed_shipments ?? 0) > 0 ? "#FFE600" : "#6B7280" }}>
                        {acc.delayed_shipments ?? 0}
                      </p>
                      {acc.cancellations_percent && (
                        <p style={{ color: "#6B7280", fontSize: "10px" }}>
                          {acc.cancellations_percent.toFixed(2)}%
                        </p>
                      )}
                    </div>

                    <div className="text-center">
                      <span
                        className="inline-block px-2 py-1 rounded text-[10px] font-bold"
                        style={{
                          background:
                            acc.reputation_risk === "critical"
                              ? "#EF444422"
                              : acc.reputation_risk === "high"
                                ? "#FF572222"
                                : acc.reputation_risk === "medium"
                                  ? "#FFE60022"
                                  : "#39FF1422",
                          color:
                            acc.reputation_risk === "critical"
                              ? "#EF4444"
                              : acc.reputation_risk === "high"
                                ? "#FF5722"
                                : acc.reputation_risk === "medium"
                                  ? "#FFE600"
                                  : "#39FF14",
                        }}
                      >
                        {acc.reputation_risk === "critical"
                          ? "🚨 Crítico"
                          : acc.reputation_risk === "high"
                            ? "⚠️ Alto"
                            : acc.reputation_risk === "medium"
                              ? "⚠ Medio"
                              : "✓ Bajo"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && accounts.length === 0 && (
            <div className="text-center py-10">
              <p style={{ color: "#6B7280" }}>No hay cuentas disponibles</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
