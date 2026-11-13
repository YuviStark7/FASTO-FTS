import "server-only";
import { requireUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import type { Category, CellRow, Territory } from "@/lib/queries/scout";
import { parsePoint } from "@/lib/map-geo";

type Tables = Database["public"]["Tables"];
export type { Category, CellRow, Territory };
export type MapTerritory = Territory & { lonLat: [number, number] | null };
export type GeoEstimate = Pick<
  Tables["geo_estimates"]["Row"],
  "category_id" | "territory_id" | "period_year" | "value" | "low" | "high" | "unit" | "grade" | "is_demo"
>;

/** Map data: pilot cities with [lon, lat], each cell's status, and the latest local-demand estimate per cell. RLS-scoped. */
export async function getMapData() {
  const { supabase } = await requireUser();
  const [categories, territories, cells, geo] = await Promise.all([
    supabase.from("categories").select("id, slug, name_it, name_en, color, icon").order("sort_order"),
    supabase
      .from("territories")
      .select("id, slug, name_it, name_en, country_code, centroid")
      .eq("is_pilot", true)
      .order("sort_order"),
    supabase
      .from("cells")
      .select("category_id, territory_id, status, mos, mos_grade, mos_is_partial, coverage_pct, grade_mix, missing_inputs, is_demo"),
    supabase
      .from("geo_estimates")
      .select("category_id, territory_id, period_year, value, low, high, unit, grade, is_demo")
      .order("computed_at", { ascending: false }),
  ]);
  const error = categories.error ?? territories.error ?? cells.error ?? geo.error;
  if (error) throw new Error(error.message);

  const latest = new Map<string, GeoEstimate>();
  for (const g of geo.data as GeoEstimate[]) {
    const k = `${g.category_id}:${g.territory_id}`;
    if (!latest.has(k)) latest.set(k, g); // rows arrive newest first
  }
  return {
    categories: categories.data as Category[],
    territories: (territories.data ?? []).map(({ centroid, ...t }) => ({ ...t, lonLat: parsePoint(centroid) })) as MapTerritory[],
    cells: cells.data as CellRow[],
    estimates: [...latest.values()].map((g) => ({ ...g, value: Number(g.value), low: Number(g.low), high: Number(g.high) })),
  };
}
