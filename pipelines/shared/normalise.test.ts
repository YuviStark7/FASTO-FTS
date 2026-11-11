import { describe, expect, it } from "vitest";
import { NORMALISE_METHOD, normalise } from "./normalise";
import { buildTaxonomy, type TerritoryRow } from "./taxonomy";
import type { ObservationInput } from "./types";

const terr = (o: Partial<TerritoryRow> & Pick<TerritoryRow, "id" | "slug" | "level">): TerritoryRow => ({
  country_code: "IT",
  nuts_code: null,
  parent_id: null,
  is_pilot: false,
  stat_codes: {},
  name_it: o.slug,
  name_en: o.slug,
  centroid: null,
  ...o,
});

const taxonomy = buildTaxonomy(
  [{ id: 11, slug: "cheese", codes: { coicop: ["CP01141"] } }],
  [terr({ id: 1, slug: "it", level: "country" }), terr({ id: 2, slug: "roma", level: "city", parent_id: 1, is_pilot: true })],
  [
    { id: 21, slug: "population", unit: "persons" },
    { id: 22, slug: "price_index", unit: "index" },
  ],
  [
    { id: 31, slug: "eurostat", default_grade: "A" },
    { id: 32, slug: "osm", default_grade: "B" },
  ],
);

const ctx = { source: "eurostat", runId: 7 };

const good: ObservationInput = {
  category: "cheese",
  territory: "roma",
  indicator: "population",
  periodStart: "2022-01-01",
  periodEnd: "2022-12-31",
  value: 100,
  sourceRef: "demo_pjan?geo=IT",
};

const reasonOf = (o: Partial<ObservationInput>) => {
  const r = normalise([{ ...good, ...o } as ObservationInput], taxonomy, ctx);
  expect(r.rows).toHaveLength(0);
  expect(r.rejected).toHaveLength(1);
  return r.rejected[0].reason;
};

describe("normalise", () => {
  it("maps a valid row with ids, default unit and grade, and method normalise-v1", () => {
    const { rows, rejected } = normalise([good], taxonomy, ctx);
    expect(rejected).toEqual([]);
    expect(rows).toEqual([
      {
        category_id: 11,
        territory_id: 2,
        indicator_id: 21,
        series_key: "",
        period_start: "2022-01-01",
        period_end: "2022-12-31",
        value: 100,
        low: null,
        high: null,
        unit: "persons",
        grade: "A",
        source_id: 31,
        run_id: 7,
        method_version_id: "normalise-v1",
        is_demo: false,
        source_ref: "demo_pjan?geo=IT",
      },
    ]);
    expect(NORMALISE_METHOD).toBe("normalise-v1");
  });

  it("explicit unit, grade, bounds, seriesKey, demo flag and null category are kept", () => {
    const { rows } = normalise(
      [{ ...good, category: null, unit: "x", grade: "C", low: 90, high: 110, seriesKey: "shop=cheese" }],
      taxonomy,
      { source: "osm", runId: null, isDemo: true },
    );
    expect(rows[0]).toMatchObject({
      category_id: null,
      unit: "x",
      grade: "C",
      low: 90,
      high: 110,
      series_key: "shop=cheese",
      source_id: 32,
      run_id: null,
      is_demo: true,
    });
  });

  it("source default grade applies when the input has none", () => {
    expect(normalise([good], taxonomy, { source: "osm", runId: 1 }).rows[0].grade).toBe("B");
  });

  it("throws on an unknown source", () => {
    expect(() => normalise([good], taxonomy, { source: "nope", runId: 1 })).toThrow(/unknown source/);
  });

  it("accepts bounds equal to value", () => {
    expect(normalise([{ ...good, low: 100, high: 100 }], taxonomy, ctx).rows).toHaveLength(1);
  });

  describe("rejections", () => {
    it("unknown category", () => expect(reasonOf({ category: "nope" })).toBe("unknown category nope"));
    it("unknown territory", () => expect(reasonOf({ territory: "nope" })).toBe("unknown territory nope"));
    it("unknown indicator", () => expect(reasonOf({ indicator: "nope" })).toBe("unknown indicator nope"));
    it("bad start date", () => expect(reasonOf({ periodStart: "2022-1-1" })).toMatch(/ISO date/));
    it("bad end date", () => expect(reasonOf({ periodEnd: "31/12/2022" })).toMatch(/ISO date/));
    it("end before start", () => expect(reasonOf({ periodStart: "2022-12-31", periodEnd: "2022-01-01" })).toMatch(/ends before/));
    it("NaN", () => expect(reasonOf({ value: NaN })).toMatch(/finite/));
    it("Infinity", () => expect(reasonOf({ value: Infinity })).toMatch(/finite/));
    it("-Infinity", () => expect(reasonOf({ value: -Infinity })).toMatch(/finite/));
    it("non-number value", () => expect(reasonOf({ value: "5" as unknown as number })).toMatch(/finite/));
    it("low above value", () => expect(reasonOf({ low: 101 })).toMatch(/low bound/));
    it("high below value", () => expect(reasonOf({ high: 99 })).toMatch(/high bound/));
    it("non-finite low", () => expect(reasonOf({ low: NaN })).toMatch(/low bound/));
    it("bad grade", () => expect(reasonOf({ grade: "D" as never })).toMatch(/bad grade/));
    it("missing sourceRef", () => expect(reasonOf({ sourceRef: "" })).toMatch(/sourceRef/));
    it("oversized sourceRef", () => expect(reasonOf({ sourceRef: "x".repeat(1001) })).toMatch(/sourceRef/));
  });

  it("one bad row does not stop the others; rejected carries the input", () => {
    const bad = { ...good, value: NaN };
    const { rows, rejected } = normalise([good, bad, { ...good, periodStart: "2021-01-01", periodEnd: "2021-12-31" }], taxonomy, ctx);
    expect(rows).toHaveLength(2);
    expect(rejected).toEqual([{ input: bad, reason: "value is not a finite number" }]);
  });

  describe("duplicates on the natural key", () => {
    it("last wins", () => {
      const { rows } = normalise([{ ...good, value: 1 }, { ...good, value: 2 }, { ...good, value: 3 }], taxonomy, ctx);
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe(3);
    });
    it("different series_key, period, category, territory or indicator are not duplicates", () => {
      const { rows } = normalise(
        [
          good,
          { ...good, seriesKey: "a" },
          { ...good, periodEnd: "2022-06-30" },
          { ...good, category: null },
          { ...good, territory: "it" },
          { ...good, indicator: "price_index" },
        ],
        taxonomy,
        ctx,
      );
      expect(rows).toHaveLength(6);
    });
    it("seriesKey undefined and '' collide; default is ''", () => {
      const { rows } = normalise([{ ...good, value: 1 }, { ...good, seriesKey: "", value: 2 }], taxonomy, ctx);
      expect(rows).toHaveLength(1);
      expect(rows[0].series_key).toBe("");
      expect(rows[0].value).toBe(2);
    });
  });
});
