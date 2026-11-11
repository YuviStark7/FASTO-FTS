/**
 * Compute step: observations -> trend snapshots (per category x country), geo estimates
 * (per category x pilot city) -> cells. Deterministic, reproducible from the stored inputs.
 *
 * Observation conventions the connectors follow (docs/METHODS.md, "Inputs"):
 *   household_spend_value  category null, country, series_key = HFCE group ("CP011", "CP012"), EUR
 *   hicp_weight            category null, country, series_key = COICOP code (classes and groups), per mille
 *   price_index            category null, country, series_key = COICOP code, "CP00" = all items
 *   population             category null, city: series_key = unit ("nuts3" | "urban_audit" | "istat_comune");
 *                          country: series_key ""
 *   tourist_nights         category null, city, series_key = unit ("nuts3" | "urban_audit")
 *   household_income_per_capita  category null, region and country, series_key ""
 *   pos_count              category null, city, series_key = "shop=<value>"
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCategorySeries, classifyTrend, type ClassInputs, type Grade, type Series, type TrendParams } from "../../lib/scoring/trend";
import { estimateLocalDemand, median, type GeoParams } from "../../lib/scoring/geo";
import { loadTaxonomy, type Taxonomy } from "../shared/taxonomy";

type Obs = {
  id: number;
  category_id: number | null;
  territory_id: number;
  indicator_id: number;
  series_key: string;
  period_start: string;
  value: number;
  grade: Grade;
};

const INDICATORS = [
  "household_spend_value",
  "hicp_weight",
  "price_index",
  "population",
  "tourist_nights",
  "household_income_per_capita",
  "pos_count",
] as const;

export async function computeAll(db: SupabaseClient, log: (m: string) => void = console.log) {
  const tax = await loadTaxonomy(db);
  const params = await loadParams(db);
  const obs = await loadObservations(db, tax);
  const idx = indexObservations(obs, tax);
  log(`compute: ${obs.length} observations loaded`);

  const countries = [...new Set(tax.pilotCities.map((c) => tax.countryOf(c.slug).slug))];
  const trendIds = new Map<string, { id: number; status: string; grade: Grade | null; inputIds: number[]; lastYear: number | null; nominalLast: number | null }>();

  // ---------------------------------------------------------------- trend per category x country
  for (const cat of tax.categories.values()) {
    for (const countrySlug of countries) {
      const country = tax.territories.get(countrySlug)!;
      const used: Obs[] = [];
      const classes: ClassInputs[] = (cat.codes.coicop ?? []).map((code) => ({
        coicop: code,
        group: code.startsWith("CP012") ? "CP012" : "CP011",
        weight: idx.series("hicp_weight", country.id, code, used),
        price: idx.series("price_index", country.id, code, used),
      }));
      const groups = [...new Set(classes.map((c) => c.group))];
      const hfceByGroup = new Map(groups.map((g) => [g, idx.series("household_spend_value", country.id, g, used)]));
      const groupWeight = new Map(groups.map((g) => [g, idx.series("hicp_weight", country.id, g, used)]));
      const allItems = idx.series("price_index", country.id, "CP00", used);

      const points = classes.length ? buildCategorySeries({ classes, hfceByGroup, groupWeight, allItemsPrice: allItems }) : [];
      const result = classes.length
        ? classifyTrend(points, used.map((o) => o.grade), params.trend)
        : {
            status: "insufficient_data" as const,
            grade: null,
            realCagr: null,
            volumeCagr: null,
            nominalCagr: null,
            firstYear: null,
            lastYear: null,
            reason: cat.codes.scope_note ?? "no statistical class mapped to this category",
            series: [],
          };
      if (result.status === "insufficient_data" && classes.length) {
        // Say which input is missing instead of only counting points. A category is never
        // silently redefined by dropping one of its classes.
        const gaps = classes
          .filter((c) => !c.weight.size || !c.price.size)
          .map((c) => `${c.coicop} (${!c.price.size ? "no price index" : "no basket weight"})`);
        if (gaps.length) result.reason = `${result.reason}; missing for ${country.country_code}: ${gaps.join(", ")}`;
      }
      const usedYears = new Set(points.map((p) => p.year));
      const inputIds = used.filter((o) => usedYears.has(Number(o.period_start.slice(0, 4)))).map((o) => o.id);

      const { data, error } = await db
        .from("trend_snapshots")
        .insert({
          category_id: cat.id,
          territory_id: country.id,
          status: result.status,
          real_value_cagr: result.realCagr,
          volume_cagr: result.volumeCagr,
          nominal_value_cagr: result.nominalCagr,
          first_year: result.firstYear,
          last_year: result.lastYear,
          grade: result.grade,
          reason: result.reason,
          input_observation_ids: inputIds,
          series: result.series,
          scope: "national",
          method_version_id: "trend-v1",
        })
        .select("id")
        .single();
      if (error) throw new Error(`trend ${cat.slug}/${countrySlug}: ${error.message}`);
      const last = points.at(-1);
      trendIds.set(`${cat.slug}|${countrySlug}`, {
        id: data.id,
        status: result.status,
        grade: result.grade,
        inputIds,
        lastYear: last?.year ?? null,
        nominalLast: last ? last.nominal : null,
      });
    }
  }
  log(`compute: ${trendIds.size} trend snapshots`);

  // ---------------------------------------------------------------- geo per category x city
  const posDensity = (citySlug: string, shops: string[]) => {
    const city = tax.territories.get(citySlug)!;
    const pop = idx.latest("population", city.id, city.stat_codes.population_unit ?? "");
    if (!pop || !shops.length) return null;
    let count = 0;
    let found = false;
    for (const s of shops) {
      const o = idx.latest("pos_count", city.id, `shop=${s}`);
      if (o) {
        count += o.value;
        found = true;
      }
    }
    return found ? { density: (count / pop.value) * 10000, inputs: shops.map((s) => idx.latest("pos_count", city.id, `shop=${s}`)).filter(Boolean) as Obs[] } : null;
  };

  let geoCount = 0;
  for (const cat of tax.categories.values()) {
    const shops = cat.codes.osm_shop ?? [];
    for (const city of tax.pilotCities) {
      const country = tax.countryOf(city.slug);
      const trend = trendIds.get(`${cat.slug}|${country.slug}`)!;
      const used: Obs[] = [];
      const cityPop = idx.latest("population", city.id, city.stat_codes.population_unit ?? "", used);
      const year = trend.lastYear;
      const natPop = year ? idx.at("population", country.id, "", year, used) ?? idx.latest("population", country.id, "", used) : null;
      const region = tax.regionOf(city.slug);
      const regInc = region ? idx.latest("household_income_per_capita", region.id, "", used) : null;
      const natInc = idx.latest("household_income_per_capita", country.id, "", used);
      const nights = idx.latest("tourist_nights", city.id, city.stat_codes.tourism_unit ?? "", used);
      const own = posDensity(city.slug, shops);
      const peers = tax.pilotCities
        .filter((c) => tax.countryOf(c.slug).slug === country.slug)
        .map((c) => posDensity(c.slug, shops)?.density)
        .filter((x): x is number => x != null);
      const ref = peers.length >= 2 ? median(peers) : null;
      if (own) used.push(...own.inputs);

      const est =
        trend.nominalLast != null && year
          ? estimateLocalDemand(
              {
                nationalSpend: trend.nominalLast,
                nationalPopulation: natPop?.value ?? NaN,
                cityPopulation: cityPop?.value ?? NaN,
                regionalIncomePc: regInc?.value,
                nationalIncomePc: natInc?.value,
                touristNights: nights?.value,
                cityPosDensity: own?.density,
                refPosDensity: ref,
              },
              params.geo,
            )
          : null;

      let geoId: number | null = null;
      if (est && year) {
        const { data, error } = await db
          .from("geo_estimates")
          .insert({
            category_id: cat.id,
            territory_id: city.id,
            period_year: year,
            value: est.value,
            low: est.low,
            high: est.high,
            unit: "EUR",
            factors: {
              ...est.factors,
              base: est.base,
              per_capita: est.perCapita,
              missing: est.missing,
              scope_note: city.stat_codes.scope_note ?? null,
              years: {
                spend: year,
                city_population: cityPop ? Number(cityPop.period_start.slice(0, 4)) : null,
                tourist_nights: nights ? Number(nights.period_start.slice(0, 4)) : null,
                income: regInc ? Number(regInc.period_start.slice(0, 4)) : null,
              },
            },
            input_observation_ids: [...new Set([...trend.inputIds, ...used.map((o) => o.id)])],
            method_version_id: "geo-v1",
          })
          .select("id")
          .single();
        if (error) throw new Error(`geo ${cat.slug}/${city.slug}: ${error.message}`);
        geoId = data.id;
        geoCount++;
      }

      // ---------------------------------------------------------------- cell
      const missing: string[] = [];
      if (trend.status === "insufficient_data") missing.push("trend");
      if (!geoId) missing.push("geo");
      missing.push("csi", "competition"); // Day 3 modules
      const present = 4 - missing.length;
      const gradeObs = [...trend.inputIds.map((id) => idx.byId.get(id)!), ...used].filter(Boolean);
      const gradeMix = { A: 0, B: 0, C: 0 } as Record<Grade, number>;
      for (const id of new Set(gradeObs.map((o) => o.id))) gradeMix[idx.byId.get(id)!.grade]++;
      const { error } = await db
        .from("cells")
        .update({
          status: trend.status,
          trend_snapshot_id: trend.id,
          geo_estimate_id: geoId,
          coverage_pct: (present / 4) * 100,
          grade_mix: gradeMix,
          missing_inputs: missing,
          is_demo: false,
          updated_at: new Date().toISOString(),
        })
        .eq("category_id", cat.id)
        .eq("territory_id", city.id);
      if (error) throw new Error(`cell ${cat.slug}/${city.slug}: ${error.message}`);
    }
  }
  log(`compute: ${geoCount} geo estimates, ${tax.categories.size * tax.pilotCities.length} cells updated`);
}

async function loadParams(db: SupabaseClient) {
  const { data, error } = await db.from("method_versions").select("id, params").in("id", ["trend-v1", "geo-v1"]);
  if (error) throw new Error(error.message);
  const get = (id: string) => data!.find((r) => r.id === id)!.params;
  return { trend: get("trend-v1") as TrendParams, geo: get("geo-v1") as GeoParams };
}

async function loadObservations(db: SupabaseClient, tax: Taxonomy): Promise<Obs[]> {
  const ids = INDICATORS.map((s) => tax.indicators.get(s)?.id).filter((x): x is number => x != null);
  const out: Obs[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("observations")
      .select("id, category_id, territory_id, indicator_id, series_key, period_start, value, grade")
      .in("indicator_id", ids)
      .eq("is_demo", false)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data as Obs[]).map((o) => ({ ...o, value: Number(o.value) })));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function indexObservations(obs: Obs[], tax: Taxonomy) {
  const slugOf = new Map([...tax.indicators.values()].map((i) => [i.id, i.slug]));
  const byKey = new Map<string, Obs[]>();
  for (const o of obs) {
    if (o.category_id !== null) continue; // compute reads context-level series only
    const k = `${slugOf.get(o.indicator_id)}|${o.territory_id}|${o.series_key}`;
    const list = byKey.get(k) ?? [];
    list.push(o);
    byKey.set(k, list);
  }
  for (const list of byKey.values()) list.sort((a, b) => a.period_start.localeCompare(b.period_start));
  const get = (ind: string, terr: number, key: string) => byKey.get(`${ind}|${terr}|${key}`) ?? [];
  return {
    byId: new Map(obs.map((o) => [o.id, o])),
    /** Annual series keyed by year; records the observations it read in `used`. */
    series(ind: string, terr: number, key: string, used?: Obs[]): Series {
      const list = get(ind, terr, key);
      used?.push(...list);
      return new Map(list.map((o) => [Number(o.period_start.slice(0, 4)), o.value]));
    },
    latest(ind: string, terr: number, key: string, used?: Obs[]): Obs | null {
      const o = get(ind, terr, key).at(-1) ?? null;
      if (o) used?.push(o);
      return o;
    },
    at(ind: string, terr: number, key: string, year: number, used?: Obs[]): Obs | null {
      const o = get(ind, terr, key).find((x) => x.period_start.startsWith(String(year))) ?? null;
      if (o) used?.push(o);
      return o;
    },
  };
}
