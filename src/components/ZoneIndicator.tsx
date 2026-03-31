import { ZONE_CFG } from "@/lib/zone-calc";

export function ZoneIndicator({ zone }: { zone: string }) {
  const cfg = ZONE_CFG[zone] || ZONE_CFG["desconocida"];

  return (
    <span
      className="text-[9px] font-black px-1.5 py-0.5 rounded"
      style={{
        background: cfg.bgColor,
        color: cfg.color,
        border: `1px solid ${cfg.color}44`,
      }}
    >
      {cfg.label}
    </span>
  );
}
