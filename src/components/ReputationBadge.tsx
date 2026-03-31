"use client";

import { Crown, Star, Award } from "lucide-react";

interface Props {
  levelId: string | null;
  levelName: string;
  powerSellerStatus: string | null;
}

/**
 * Badge dinámico de reputación como en MercadoLibre
 * Muestra nivel de vendedor + poder vendedor (Mercadolíder, Gold, Platinum)
 */
export default function ReputationBadge({ levelId, levelName, powerSellerStatus }: Props) {
  // Mapeo de colores para cada nivel
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    "5_green": { bg: "#39FF1415", text: "#39FF14", border: "#39FF1433" },
    "4_light_green": { bg: "#7CFC0015", text: "#7CFC00", border: "#7CFC0033" },
    "3_yellow": { bg: "#FFE60015", text: "#FFE600", border: "#FFE60033" },
    "2_orange": { bg: "#FF972215", text: "#FF9722", border: "#FF972233" },
    "1_red": { bg: "#ef444415", text: "#ef4444", border: "#ef444433" },
  };

  const colors = colorMap[levelId ?? ""] || colorMap["3_yellow"];

  // Determinar ícono según poder vendedor
  const getPowerSellerIcon = () => {
    if (powerSellerStatus === "platinum") {
      return <Award className="w-3 h-3" />;
    }
    if (powerSellerStatus === "gold") {
      return <Star className="w-3 h-3" />;
    }
    if (powerSellerStatus === "mercadolider") {
      return <Crown className="w-3 h-3" />;
    }
    return null;
  };

  const getPowerSellerLabel = () => {
    if (powerSellerStatus === "platinum") return "Platinum";
    if (powerSellerStatus === "gold") return "Gold";
    if (powerSellerStatus === "mercadolider") return "Mercadolíder";
    return null;
  };

  const getPowerSellerStyles = () => {
    if (powerSellerStatus === "platinum") {
      return { bg: "#C0C0C015", text: "#C0C0C0", border: "#C0C0C033" }; // Plateado
    }
    if (powerSellerStatus === "gold") {
      return { bg: "#FFD70015", text: "#FFD700", border: "#FFD70033" }; // Dorado
    }
    if (powerSellerStatus === "mercadolider") {
      return { bg: "#FF6B3515", text: "#FF6B35", border: "#FF6B3533" }; // Naranja/Rojo
    }
    return { bg: "#FFFFFF15", text: "#FFFFFF", border: "#FFFFFF33" }; // Default blanco
  };

  const icon = getPowerSellerIcon();
  const label = getPowerSellerLabel();
  const powerSellerStyles = getPowerSellerStyles();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Badge de nivel de reputación */}
      <div
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
        style={{
          background: colors.bg,
          color: colors.text,
          border: `1px solid ${colors.border}`,
        }}
      >
        <Star className="w-3 h-3" />
        {levelName}
      </div>

      {/* Badge de poder vendedor (si aplica) */}
      {label && (
        <div
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
          style={{
            background: powerSellerStyles.bg,
            color: powerSellerStyles.text,
            border: `1px solid ${powerSellerStyles.border}`,
          }}
        >
          {icon}
          {label}
        </div>
      )}
    </div>
  );
}
