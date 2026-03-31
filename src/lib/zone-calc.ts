/**
 * Calcula la zona de distancia basada en la fecha de entrega
 * cercana: <= 2 días desde hoy
 * media: 3-7 días desde hoy
 * larga: > 7 días desde hoy
 * desconocida: sin fecha de entrega
 */
export function calculateZoneDistance(deliveryDate: string | null | undefined): string {
  if (!deliveryDate) {
    return "desconocida";
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const delivery = new Date(deliveryDate);
    delivery.setHours(0, 0, 0, 0);

    const diffTime = delivery.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 2 && diffDays >= 0) {
      return "cercana";
    } else if (diffDays >= 3 && diffDays <= 7) {
      return "media";
    } else if (diffDays > 7) {
      return "larga";
    } else {
      // Pasada
      return "desconocida";
    }
  } catch (e) {
    return "desconocida";
  }
}

export const ZONE_CFG: Record<string, { color: string; label: string; bgColor: string }> = {
  cercana: {
    color: "#FF6B35",
    label: "Cercana",
    bgColor: "#FF6B3520",
  },
  media: {
    color: "#FFB703",
    label: "Media",
    bgColor: "#FFB70320",
  },
  larga: {
    color: "#6B7280",
    label: "Larga",
    bgColor: "#6B728020",
  },
  desconocida: {
    color: "#9CA3AF",
    label: "Desconocida",
    bgColor: "#9CA3AF20",
  },
};
