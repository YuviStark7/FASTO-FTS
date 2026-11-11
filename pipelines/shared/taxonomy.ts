import type { SupabaseClient } from "@supabase/supabase-js";
import type { Grade } from "./types";

export type CategoryCodes = {
  coicop?: string[];
  coicop_group?: string | null;
  osm_shop?: string[];
  off_tags?: string[];
  /** Open Food Facts labels (e.g. en:organic), queried with labels_tags. */
  off_labels?: string[];
  scope_note?: string;
};

export type TerritoryRow = {
  id: number;
  slug: string;
  level: "city" | "region" | "country";
  country_code: string;
  nuts_code: string | null;
  parent_id: number | null;
  is_pilot: boolean;
  stat_codes: Record<string, string>;
  name_it: string;
  name_en: string;
  centroid: { type: "Point"; coordinates: [number, number] } | null;
};

export type Taxonomy = {
  categories: Map<string, { id: number; slug: string; codes: CategoryCodes }>;
  territories: Map<string, TerritoryRow>;
  indicators: Map<string, { id: number; slug: string; unit: string }>;
  sources: Map<string, { id: number; slug: string; default_grade: Grade }>;
  /** Pilot cities only, in display order. */
  pilotCities: TerritoryRow[];
  countryOf: (territorySlug: string) => TerritoryRow;
  regionOf: (territorySlug: string) => TerritoryRow | null;
};

export async function loadTaxonomy(db: SupabaseClient): Promise<Taxonomy> {
  const [c, t, i, s] = await Promise.all([
    db.from("categories").select("id, slug, codes").order("sort_order"),
    db
      .from("territories")
      .select("id, slug, level, country_code, nuts_code, parent_id, is_pilot, stat_codes, name_it, name_en, centroid, sort_order")
      .order("sort_order"),
    db.from("indicators").select("id, slug, unit"),
    db.from("sources").select("id, slug, default_grade"),
  ]);
  for (const r of [c, t, i, s]) if (r.error) throw new Error(`taxonomy: ${r.error.message}`);
  return buildTaxonomy(c.data!, t.data as TerritoryRow[], i.data!, s.data as { id: number; slug: string; default_grade: Grade }[]);
}

export function buildTaxonomy(
  categories: { id: number; slug: string; codes: unknown }[],
  territories: TerritoryRow[],
  indicators: { id: number; slug: string; unit: string }[],
  sources: { id: number; slug: string; default_grade: Grade }[],
): Taxonomy {
  const terr = new Map(territories.map((x) => [x.slug, x]));
  const byId = new Map(territories.map((x) => [x.id, x]));
  const up = (slug: string, level: TerritoryRow["level"]) => {
    let cur = terr.get(slug);
    if (!cur) throw new Error(`unknown territory ${slug}`);
    while (cur && cur.level !== level) cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    return cur ?? null;
  };
  return {
    categories: new Map(categories.map((x) => [x.slug, { id: x.id, slug: x.slug, codes: (x.codes ?? {}) as CategoryCodes }])),
    territories: terr,
    indicators: new Map(indicators.map((x) => [x.slug, x])),
    sources: new Map(sources.map((x) => [x.slug, x])),
    pilotCities: territories.filter((x) => x.is_pilot && x.level === "city"),
    countryOf: (slug) => {
      const c = up(slug, "country");
      if (!c) throw new Error(`no country above ${slug}`);
      return c;
    },
    regionOf: (slug) => up(slug, "region"),
  };
}
