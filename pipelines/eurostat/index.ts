/**
 * Eurostat connector: dissemination API (JSON-stat 2.0), licence CC BY 4.0 (docs/SOURCES.md).
 * "Source: Eurostat" plus the dataset code travels with every row in source_ref.
 * Values are Eurostat's own; the only transformation is million EUR -> EUR for household spend.
 */
import type { JsonStat } from "../shared/jsonstat";
import type { Connector, ConnectorContext, ObservationInput } from "../shared/types";
import { annual, FIRST_YEAR, firstOfJanuary, mapJsonStat } from "./map";

const API = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";

type Filters = [string, string | string[]][];

export function buildUrl(dataset: string, filters: Filters) {
  const q = ["format=JSON", "lang=EN"];
  for (const [k, v] of filters) for (const x of Array.isArray(v) ? v : [v]) q.push(`${k}=${encodeURIComponent(x)}`);
  q.push(`sinceTimePeriod=${FIRST_YEAR}`);
  return `${API}/${dataset}?${q.join("&")}`;
}

async function fetchDataset(ctx: ConnectorContext, n: number, dataset: string, filters: Filters): Promise<JsonStat> {
  const url = buildUrl(dataset, filters);
  const res = await ctx.get(url);
  await ctx.storeRaw({ name: `${String(n).padStart(2, "0")}_${dataset}.json`, bytes: res.bytes, contentType: "application/json", url });
  const doc = res.json<JsonStat & { error?: unknown }>();
  if (doc.error || !doc.id || !doc.value) throw new Error(`${dataset}: unexpected response ${JSON.stringify(doc.error ?? {}).slice(0, 200)}`);
  return doc;
}

export async function run(ctx: ConnectorContext): Promise<ObservationInput[]> {
  const tax = ctx.taxonomy;
  const flags = new Map<string, number>();
  const out: ObservationInput[] = [];
  let n = 0;
  const add = (label: string, rows: ObservationInput[]) => {
    ctx.log(`${label}: ${rows.length} rows`);
    out.push(...rows);
  };
  const get = (dataset: string, filters: Filters) => fetchDataset(ctx, ++n, dataset, filters);

  // Countries of the pilot cities. Eurostat geo = ISO country code, territory slug looked up from it.
  const countries = [...new Map(tax.pilotCities.map((c) => [tax.countryOf(c.slug).slug, tax.countryOf(c.slug)])).values()];
  const countrySlugByGeo = new Map(countries.map((c) => [c.country_code, c.slug]));
  const countryGeo = countries.map((c) => c.country_code);
  const countryOfGeo = (row: Record<string, string>) => countrySlugByGeo.get(row.geo) ?? null;

  const coicop = [...new Set([...tax.categories.values()].flatMap((c) => c.codes.coicop ?? []))];
  const classesAndGroups = [...coicop, "CP011", "CP012"];

  // 1. household spend by HFCE group, million EUR -> EUR
  add(
    "household_spend_value",
    mapJsonStat(await get("nama_10_co3_p3", [["unit", "CP_MEUR"], ["coicop", ["CP011", "CP012"]], ["geo", countryGeo]]), {
      dataset: "nama_10_co3_p3",
      indicator: "household_spend_value",
      territory: countryOfGeo,
      seriesKey: (r) => r.coicop,
      period: annual,
      scale: 1e6,
      flags,
    }),
  );

  // 2. HICP item weights (per mille)
  add(
    "hicp_weight",
    mapJsonStat(await get("prc_hicp_inw", [["coicop", classesAndGroups], ["geo", countryGeo]]), {
      dataset: "prc_hicp_inw",
      indicator: "hicp_weight",
      territory: countryOfGeo,
      seriesKey: (r) => r.coicop,
      period: annual,
      flags,
    }),
  );

  // 3. HICP annual average index (2015 = 100)
  add(
    "price_index",
    mapJsonStat(await get("prc_hicp_aind", [["unit", "INX_A_AVG"], ["coicop", [...classesAndGroups, "CP00"]], ["geo", countryGeo]]), {
      dataset: "prc_hicp_aind",
      indicator: "price_index",
      territory: countryOfGeo,
      seriesKey: (r) => r.coicop,
      period: annual,
      flags,
    }),
  );

  // 4. population, national, 1 January
  add(
    "population (country)",
    mapJsonStat(await get("demo_pjan", [["sex", "T"], ["age", "TOTAL"], ["geo", countryGeo]]), {
      dataset: "demo_pjan",
      indicator: "population",
      territory: countryOfGeo,
      seriesKey: () => "",
      period: firstOfJanuary,
      flags,
    }),
  );

  const cities = tax.pilotCities;
  const withUnit = (key: "population_unit" | "tourism_unit", unit: string) => cities.filter((c) => c.stat_codes[key] === unit);

  // 5. population, cities (istat_comune cities belong to the ISTAT connector)
  const popNuts3 = withUnit("population_unit", "nuts3").filter((c) => c.nuts_code);
  if (popNuts3.length) {
    const bySlug = new Map(popNuts3.map((c) => [c.nuts_code!, c.slug]));
    add(
      "population (nuts3)",
      mapJsonStat(await get("demo_r_pjanaggr3", [["sex", "T"], ["age", "TOTAL"], ["geo", [...bySlug.keys()]]]), {
        dataset: "demo_r_pjanaggr3",
        indicator: "population",
        territory: (r) => bySlug.get(r.geo) ?? null,
        seriesKey: () => "nuts3",
        period: firstOfJanuary,
        flags,
      }),
    );
  }
  const popUa = withUnit("population_unit", "urban_audit").filter((c) => c.stat_codes.urban_audit);
  if (popUa.length) {
    const bySlug = new Map(popUa.map((c) => [c.stat_codes.urban_audit, c.slug]));
    add(
      "population (urban_audit)",
      mapJsonStat(await get("urb_cpop1", [["indic_ur", "DE1001V"], ["cities", [...bySlug.keys()]]]), {
        dataset: "urb_cpop1",
        indicator: "population",
        territory: (r) => bySlug.get(r.cities) ?? null,
        seriesKey: () => "urban_audit",
        period: firstOfJanuary,
        flags,
      }),
    );
  }

  // 6. tourist nights, cities
  const tourNuts3 = withUnit("tourism_unit", "nuts3").filter((c) => c.nuts_code);
  if (tourNuts3.length) {
    const bySlug = new Map(tourNuts3.map((c) => [c.nuts_code!, c.slug]));
    add(
      "tourist_nights (nuts3)",
      mapJsonStat(await get("tour_occ_nin3", [["unit", "NR"], ["c_resid", "TOTAL"], ["nace_r2", "I551-I553"], ["geo", [...bySlug.keys()]]]), {
        dataset: "tour_occ_nin3",
        indicator: "tourist_nights",
        territory: (r) => bySlug.get(r.geo) ?? null,
        seriesKey: () => "nuts3",
        period: annual,
        flags,
      }),
    );
  }
  const tourUa = withUnit("tourism_unit", "urban_audit").filter((c) => c.stat_codes.urban_audit);
  if (tourUa.length) {
    const bySlug = new Map(tourUa.map((c) => [c.stat_codes.urban_audit, c.slug]));
    add(
      "tourist_nights (urban_audit)",
      mapJsonStat(await get("urb_ctour", [["indic_ur", "CR2001V"], ["cities", [...bySlug.keys()]]]), {
        dataset: "urb_ctour",
        indicator: "tourist_nights",
        territory: (r) => bySlug.get(r.cities) ?? null,
        seriesKey: () => "urban_audit",
        period: annual,
        flags,
      }),
    );
  }

  // 7. household disposable income per inhabitant (EUR_HAB), regions and countries
  const regions = [...tax.territories.values()].filter((t) => t.level === "region" && t.nuts_code);
  const incomeBy = new Map<string, string>([
    ...regions.map((r) => [r.nuts_code!, r.slug] as const),
    ...countries.map((c) => [c.country_code, c.slug] as const),
  ]);
  add(
    "household_income_per_capita",
    mapJsonStat(await get("nama_10r_2hhinc", [["direct", "BAL"], ["na_item", "B6N"], ["unit", "EUR_HAB"], ["geo", [...incomeBy.keys()]]]), {
      dataset: "nama_10r_2hhinc",
      indicator: "household_income_per_capita",
      territory: (r) => incomeBy.get(r.geo) ?? null,
      seriesKey: () => "",
      period: annual,
      flags,
    }),
  );

  ctx.log(`flags seen (dataset:flag = count): ${[...flags].map(([k, v]) => `${k}=${v}`).join(", ") || "none"}`);
  return out;
}

const connector: Connector = { source: "eurostat", run };
export default connector;
