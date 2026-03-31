import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Period = "day" | "week" | "month";

function getPeriodDates(periodType: Period, baseDate: string) {
  const date = new Date(baseDate);
  const year = date.getFullYear();
  const month = date.getMonth();
  const dayOfMonth = date.getDate();

  let startDate: Date;
  let endDate: Date = new Date(date);

  if (periodType === "day") {
    startDate = new Date(year, month, dayOfMonth);
    endDate = new Date(year, month, dayOfMonth + 1);
  } else if (periodType === "week") {
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    startDate = new Date(year, month, diff);
    endDate = new Date(year, month, diff + 7);
  } else {
    // month
    startDate = new Date(year, month, 1);
    endDate = new Date(year, month + 1, 1);
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("account_id");
  const period = (searchParams.get("period") || "day") as Period;
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];

  if (!accountId) {
    return NextResponse.json({ error: "account_id required" }, { status: 400 });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { startDate, endDate } = getPeriodDates(period, dateStr);

    // Query etiquetas_history para calcular stats
    const { data, error } = await supabase
      .from("etiquetas_history")
      .select("zone_distance, status, shipping_type")
      .eq("account_id", accountId)
      .gte("created_at", startDate)
      .lt("created_at", endDate);

    if (error) {
      console.error("[stats] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Procesar datos
    const zones: Record<
      string,
      {
        total: number;
        printed: number;
        by_shipping_type: Record<string, number>;
      }
    > = {
      cercana: { total: 0, printed: 0, by_shipping_type: { flex: 0, correo: 0, turbo: 0 } },
      media: { total: 0, printed: 0, by_shipping_type: { flex: 0, correo: 0, turbo: 0 } },
      larga: { total: 0, printed: 0, by_shipping_type: { flex: 0, correo: 0, turbo: 0 } },
      desconocida: { total: 0, printed: 0, by_shipping_type: { flex: 0, correo: 0, turbo: 0 } },
    };

    for (const item of data || []) {
      const zone = item.zone_distance || "desconocida";
      if (!zones[zone]) {
        zones[zone] = { total: 0, printed: 0, by_shipping_type: { flex: 0, correo: 0, turbo: 0 } };
      }

      zones[zone].total++;
      if (item.status === "printed") {
        zones[zone].printed++;
      }

      const shippingType = item.shipping_type || "otros";
      if (zones[zone].by_shipping_type[shippingType] === undefined) {
        zones[zone].by_shipping_type[shippingType] = 0;
      }
      zones[zone].by_shipping_type[shippingType]++;
    }

    // Calcular top zones
    const topZones = Object.entries(zones)
      .map(([zone, stats]) => ({
        zone,
        count: stats.total,
        percentage: parseFloat(((stats.total / (data?.length || 1)) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      period,
      period_date: dateStr,
      zones,
      top_zones: topZones,
    });
  } catch (e) {
    console.error("[stats] Error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
