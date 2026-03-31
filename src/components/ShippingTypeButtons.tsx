import { Printer, Download, RefreshCw } from "lucide-react";

type LogisticType = "flex" | "turbo" | "correo" | "full";

const TYPE_CFG: Record<LogisticType, { color: string; label: string }> = {
  correo: { color: "#FF9800", label: "CORREO" },
  flex: { color: "#00E5FF", label: "FLEX" },
  turbo: { color: "#A855F7", label: "TURBO" },
  full: { color: "#FFE600", label: "FULL" },
};

export function ShippingTypeButtons({
  selectedByType,
  downloading,
  onPrint,
}: {
  selectedByType: Record<LogisticType, number>;
  downloading: boolean;
  onPrint: (format: "pdf" | "zpl", type: LogisticType) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {(["flex", "correo", "turbo"] as LogisticType[]).map((type) => {
        const count = selectedByType[type] || 0;
        const cfg = TYPE_CFG[type];
        const isActive = count > 0;

        return (
          <div
            key={type}
            className="flex items-center gap-2"
            style={{ opacity: isActive ? 1 : 0.4 }}
          >
            <span
              className="text-xs font-black px-2 py-1 rounded"
              style={{ background: cfg.color, color: "#121212" }}
            >
              {cfg.label}
            </span>
            <button
              onClick={() => onPrint("pdf", type)}
              disabled={!isActive || downloading}
              className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-30"
              style={{
                background: isActive ? cfg.color : cfg.color + "40",
                color: "#121212",
              }}
            >
              {downloading ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Printer className="w-3 h-3" />
              )}
              PDF ({count})
            </button>
            <button
              onClick={() => onPrint("zpl", type)}
              disabled={!isActive || downloading}
              className="py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-30"
              style={{
                background: "transparent",
                color: cfg.color,
                border: `1px solid ${cfg.color}44`,
              }}
            >
              <Download className="w-3 h-3" />
              ZPL
            </button>
          </div>
        );
      })}
    </div>
  );
}
