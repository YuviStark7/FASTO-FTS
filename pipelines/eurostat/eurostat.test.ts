import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { JsonStat } from "../shared/jsonstat";
import { buildTaxonomy, type TerritoryRow } from "../shared/taxonomy";
import { toResult } from "../shared/http";
import { normalise } from "../shared/normalise";
import type { ConnectorContext, ObservationInput, RawFile } from "../shared/types";
import connector, { buildUrl } from "./index";
import { annual, mapJsonStat } from "./map";

// Fixtures are real Eurostat responses (recorded 11 Nov 2026, from 2022 onward, annotations removed).
const fixture = (dataset: string) => JSON.parse(readFileSync(path.join(__dirname, "fixtures", `${dataset}.json`), "utf8")) as JsonStat;

const terr = (id: number, slug: string, level: TerritoryRow["level"], cc: string, extra: Partial<TerritoryRow> = {}): TerritoryRow => ({
  id,
  slug,
  level,
  country_code: cc,
  nuts_code: null,
  parent_id: null,
  is_pilot: false,
  stat_codes: {},
  name_it: slug,
  name_en: slug,
  centroid: null,
  ...extra,
});

// Berlin and Amsterdam are deliberately missing: their rows in the fixtures must be ignored.
const territories: TerritoryRow[] = [
  terr(1, "it", "country", "IT"),
  terr(2, "fr", "country", "FR"),
  terr(3, "es", "country", "ES"),
  terr(10, "lazio", "region", "IT", { nuts_code: "ITI4", parent_id: 1 }),
  terr(20, "roma", "city", "IT", {
    is_pilot: true,
    parent_id: 10,
    nuts_code: "ITI43",
    stat_codes: { urban_audit: "IT001C", population_unit: "istat_comune", tourism_unit: "urban_audit" },
  }),
  terr(21, "milano", "city", "IT", {
    is_pilot: true,
    parent_id: 1,
    nuts_code: "ITC4C",
    stat_codes: { urban_audit: "IT002C", population_unit: "istat_comune", tourism_unit: "urban_audit" },
  }),
  terr(22, "paris", "city", "FR", {
    is_pilot: true,
    parent_id: 2,
    nuts_code: "FR101",
    stat_codes: { urban_audit: "FR001C", population_unit: "nuts3", tourism_unit: "nuts3" },
  }),
  terr(23, "madrid", "city", "ES", {
    is_pilot: true,
    parent_id: 3,
    nuts_code: "ES300",
    stat_codes: { urban_audit: "ES001C", population_unit: "urban_audit", tourism_unit: "nuts3" },
  }),
];
const taxonomy = buildTaxonomy(
  [
    { id: 1, slug: "evo-oil", codes: { coicop: ["CP01153"], coicop_group: "CP011" } },
    { id: 2, slug: "organic", codes: { coicop: [], coicop_group: null } },
  ],
  territories,
  ["household_spend_value", "hicp_weight", "price_index", "population", "tourist_nights", "household_income_per_capita"].map((slug, i) => ({ id: i + 1, slug, unit: "x" })),
  [{ id: 1, slug: "eurostat", default_grade: "A" }],
);

function fakeCtx() {
  const urls: string[] = [];
  const raw: RawFile[] = [];
  const logs: string[] = [];
  const ctx: ConnectorContext = {
    taxonomy,
    get: async (url) => {
      urls.push(url);
      const dataset = new URL(url).pathname.split("/").pop()!;
      return toResult(url, 200, "application/json", new TextEncoder().encode(JSON.stringify(fixture(dataset))));
    },
    storeRaw: async (f) => void raw.push(f),
    log: (m) => void logs.push(m),
    warn: (m) => void logs.push(m),
    params: {},
  };
  return { ctx, urls, raw, logs };
}

describe("mapJsonStat", () => {
  it("converts million EUR to EUR, keeps the HFCE group as seriesKey and pins the filters in sourceRef", () => {
    const rows = mapJsonStat(fixture("nama_10_co3_p3"), {
      dataset: "nama_10_co3_p3",
      indicator: "household_spend_value",
      territory: (r) => (r.geo === "IT" ? "it" : null),
      seriesKey: (r) => r.coicop,
      period: annual,
      scale: 1e6,
    });
    const cp011 = rows.find((r) => r.seriesKey === "CP011" && r.periodStart === "2022-01-01");
    expect(cp011).toMatchObject({
      category: null,
      territory: "it",
      indicator: "household_spend_value",
      value: 155798.7 * 1e6,
      periodEnd: "2022-12-31",
      grade: "A",
      sourceRef: "nama_10_co3_p3?unit=CP_MEUR&coicop=CP011&geo=IT&time=2022",
    });
    expect(rows.every((r) => r.territory === "it")).toBe(true); // FR ignored
    expect(rows).toHaveLength(2); // 2 groups, one year published (2022)
  });

  it("skips confidential, not applicable and forecast values but keeps provisional and break flags, and counts flags", () => {
    const doc: JsonStat = {
      id: ["freq", "geo", "time"],
      size: [1, 1, 5],
      value: { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5 },
      status: { 0: "p", 1: "c", 2: "z", 3: "f", 4: "b" },
      dimension: {
        freq: { category: { index: { A: 0 } } },
        geo: { category: { index: { IT: 0 } } },
        time: { category: { index: { "2020": 0, "2021": 1, "2022": 2, "2023": 3, "2024": 4 } } },
      },
    };
    const flags = new Map<string, number>();
    const rows = mapJsonStat(doc, { dataset: "x", indicator: "population", territory: () => "it", seriesKey: () => "", period: annual, flags });
    expect(rows.map((r) => r.value)).toEqual([1, 5]);
    expect(Object.fromEntries(flags)).toEqual({ "x:p": 1, "x:c": 1, "x:z": 1, "x:f": 1, "x:b": 1 });
  });

  it("never emits a row for a missing value", () => {
    const doc = fixture("demo_pjan");
    delete (doc.value as Record<string, number>)["0"];
    const rows = mapJsonStat(doc, { dataset: "demo_pjan", indicator: "population", territory: (r) => r.geo.toLowerCase(), seriesKey: () => "", period: annual });
    expect(rows).toHaveLength(7);
  });

  it("ignores periods before 2015 and sub-annual periods", () => {
    const doc: JsonStat = {
      id: ["freq", "time"],
      size: [1, 3],
      value: [1, 2, 3],
      dimension: { freq: { category: { index: { A: 0 } } }, time: { category: { index: { "2014": 0, "2015": 1, "2016-Q1": 2 } } } },
    };
    const rows = mapJsonStat(doc, { dataset: "x", indicator: "population", territory: () => "it", seriesKey: () => "", period: annual });
    expect(rows.map((r) => r.periodStart)).toEqual(["2015-01-01"]);
  });
});

describe("buildUrl", () => {
  it("repeats multi-value parameters and starts at 2015", () => {
    expect(buildUrl("prc_hicp_inw", [["coicop", ["CP011", "CP012"]], ["geo", "IT"]])).toBe(
      "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_inw?format=JSON&lang=EN&coicop=CP011&coicop=CP012&geo=IT&sinceTimePeriod=2015",
    );
  });
});

describe("eurostat connector run", () => {
  it("fetches each dataset once, stores every response, and reads codes from the taxonomy", async () => {
    const { ctx, urls, raw } = fakeCtx();
    await connector.run(ctx);
    expect(connector.source).toBe("eurostat");
    expect(urls.map((u) => new URL(u).pathname.split("/").pop())).toEqual([
      "nama_10_co3_p3",
      "prc_hicp_inw",
      "prc_hicp_aind",
      "demo_pjan",
      "demo_r_pjanaggr3",
      "urb_cpop1",
      "tour_occ_nin3",
      "urb_ctour",
      "nama_10r_2hhinc",
    ]);
    expect(raw).toHaveLength(urls.length);
    const q = (i: number) => new URL(urls[i]).searchParams;
    expect(q(1).getAll("coicop")).toEqual(["CP01153", "CP011", "CP012"]); // from categories.codes, once
    expect(q(2).getAll("coicop")).toEqual(["CP01153", "CP011", "CP012", "CP00"]);
    expect(q(2).get("unit")).toBe("INX_A_AVG");
    expect(q(1).getAll("geo")).toEqual(["IT", "FR", "ES"]);
    expect(q(4).getAll("geo")).toEqual(["FR101"]); // only nuts3-population cities
    expect(q(5).getAll("cities")).toEqual(["ES001C"]);
    expect(q(7).getAll("cities")).toEqual(["IT001C", "IT002C"]);
    expect(q(8).getAll("geo")).toEqual(["ITI4", "IT", "FR", "ES"]); // lazio region + countries
  });

  it("maps every indicator to the observation conventions and passes normalisation without rejects", async () => {
    const { ctx } = fakeCtx();
    const inputs = await connector.run(ctx);
    const pick = (indicator: string, territory: string, seriesKey: string, start: string): ObservationInput | undefined =>
      inputs.find((i) => i.indicator === indicator && i.territory === territory && i.seriesKey === seriesKey && i.periodStart === start);

    // household spend in EUR
    expect(pick("household_spend_value", "it", "CP012", "2022-01-01")?.value).toBe(13577.2 * 1e6);
    // HICP weight and price index, per COICOP code, country level, no category
    expect(pick("hicp_weight", "it", "CP01153", "2024-01-01")).toMatchObject({ category: null, grade: "A", sourceRef: "prc_hicp_inw?coicop=CP01153&geo=IT&time=2024" });
    expect(pick("price_index", "fr", "CP00", "2024-01-01")).toMatchObject({
      category: null,
      sourceRef: "prc_hicp_aind?unit=INX_A_AVG&coicop=CP00&geo=FR&time=2024",
    });
    // population: 1 January stock, national seriesKey "", city seriesKey = unit
    expect(pick("population", "it", "", "2024-01-01")).toMatchObject({ periodEnd: "2024-01-01" });
    expect(pick("population", "paris", "nuts3", "2024-01-01")).toMatchObject({ periodEnd: "2024-01-01" });
    expect(pick("population", "madrid", "urban_audit", "2024-01-01")).toBeDefined();
    // istat_comune cities are not Eurostat's job
    expect(inputs.filter((i) => i.indicator === "population" && ["roma", "milano"].includes(i.territory))).toHaveLength(0);
    // tourist nights, per unit, full year
    expect(pick("tourist_nights", "paris", "nuts3", "2024-01-01")).toMatchObject({ periodEnd: "2024-12-31", sourceRef: expect.stringContaining("tour_occ_nin3?c_resid=TOTAL&unit=NR&nace_r2=I551-I553&geo=FR101&time=2024") });
    expect(pick("tourist_nights", "madrid", "nuts3", "2024-01-01")).toBeDefined();
    expect(pick("tourist_nights", "roma", "urban_audit", "2024-01-01")).toMatchObject({ sourceRef: expect.stringContaining("urb_ctour?indic_ur=CR2001V&cities=IT001C") });
    // income for the region and the country
    expect(pick("household_income_per_capita", "lazio", "", "2023-01-01")).toBeDefined();
    expect(pick("household_income_per_capita", "it", "", "2023-01-01")).toBeDefined();

    // geographies we did not ask for (Berlin DE300, Amsterdam NL001C) never appear
    expect(inputs.some((i) => ["berlin", "amsterdam"].includes(i.territory))).toBe(false);
    expect(inputs.every((i) => i.category === null && i.grade === "A" && i.sourceRef.includes("?"))).toBe(true);

    const { rejected, rows } = normalise(inputs, taxonomy, { source: "eurostat", runId: 1 });
    expect(rejected).toEqual([]);
    expect(rows.length).toBe(inputs.length); // no duplicate natural keys
  });

  it("fails loudly on an error payload instead of returning partial data", async () => {
    const { ctx } = fakeCtx();
    ctx.get = async (url) => toResult(url, 200, "application/json", new TextEncoder().encode(JSON.stringify({ error: [{ status: 400, label: "bad" }] })));
    await expect(connector.run(ctx)).rejects.toThrow(/unexpected response/);
  });
});
