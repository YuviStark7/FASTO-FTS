import { describe, expect, it } from "vitest";
import {
  buildCategorySeries,
  cagr,
  classifyTrend,
  derivedGrade,
  latestWindow,
  type CategoryInputs,
  type Grade,
  type Series,
  type TrendParams,
  type TrendPoint,
} from "./trend";

const P: TrendParams = { expanding_min_real_cagr: 0.02, threatened_max_cagr: -0.02, min_annual_points: 3, max_years: 5 };

const s = (entries: [number, number][]): Series => new Map(entries);
const flat = (years: number[], v: number): Series => new Map(years.map((y) => [y, v]));

describe("buildCategorySeries", () => {
  it("single class: nominal, price index, real and volume", () => {
    // nominal = 1000 * 20 / 200 = 100; priceIndex = 110; all-items = 105
    // real = 100 / 105 * 100 = 95.2381; volume = 100 / 110 * 100 = 90.9091
    const inp: CategoryInputs = {
      classes: [{ coicop: "CP01153", group: "CP011", weight: flat([2022], 20), price: flat([2022], 110) }],
      hfceByGroup: new Map([["CP011", flat([2022], 1000)]]),
      groupWeight: new Map([["CP011", flat([2022], 200)]]),
      allItemsPrice: flat([2022], 105),
    };
    const out = buildCategorySeries(inp);
    expect(out).toHaveLength(1);
    expect(out[0].year).toBe(2022);
    expect(out[0].nominal).toBeCloseTo(100, 10);
    expect(out[0].priceIndex).toBeCloseTo(110, 10);
    expect(out[0].real).toBeCloseTo(95.2381, 4);
    expect(out[0].volume).toBeCloseTo(90.9091, 4);
  });

  it("two classes in different HFCE groups are summed; price index is weight-averaged", () => {
    // c1 (CP011): 1000 * 20 / 200 = 100. c2 (CP012): 400 * 10 / 40 = 100. nominal = 200
    // priceIndex = (20*110 + 10*104) / 30 = 3240 / 30 = 108
    // real = 200 / 100 * 100 = 200; volume = 200 / 108 * 100 = 185.185
    const inp: CategoryInputs = {
      classes: [
        { coicop: "CP01153", group: "CP011", weight: flat([2022], 20), price: flat([2022], 110) },
        { coicop: "CP01221", group: "CP012", weight: flat([2022], 10), price: flat([2022], 104) },
      ],
      hfceByGroup: new Map([
        ["CP011", flat([2022], 1000)],
        ["CP012", flat([2022], 400)],
      ]),
      groupWeight: new Map([
        ["CP011", flat([2022], 200)],
        ["CP012", flat([2022], 40)],
      ]),
      allItemsPrice: flat([2022], 100),
    };
    const [p] = buildCategorySeries(inp);
    expect(p.nominal).toBeCloseTo(200, 10);
    expect(p.priceIndex).toBeCloseTo(108, 10);
    expect(p.real).toBeCloseTo(200, 10);
    expect(p.volume).toBeCloseTo(185.185, 3);
  });

  it("skips a year in which any input is missing", () => {
    const years = [2020, 2021, 2022];
    const base = (): CategoryInputs => ({
      classes: [{ coicop: "CP01153", group: "CP011", weight: flat(years, 20), price: flat(years, 100) }],
      hfceByGroup: new Map([["CP011", flat(years, 1000)]]),
      groupWeight: new Map([["CP011", flat(years, 200)]]),
      allItemsPrice: flat(years, 100),
    });
    const yearsOf = (i: CategoryInputs) => buildCategorySeries(i).map((p) => p.year);
    expect(yearsOf(base())).toEqual([2020, 2021, 2022]);

    const noHfce = base();
    noHfce.hfceByGroup.get("CP011")!.delete(2021);
    expect(yearsOf(noHfce)).toEqual([2020, 2022]);

    const noGw = base();
    noGw.groupWeight.get("CP011")!.delete(2020);
    expect(yearsOf(noGw)).toEqual([2021, 2022]);

    const noW = base();
    noW.classes[0].weight.delete(2022);
    expect(yearsOf(noW)).toEqual([2020, 2021]);

    const noP = base();
    noP.classes[0].price.delete(2021);
    expect(yearsOf(noP)).toEqual([2020, 2022]);

    const noAll = base();
    noAll.allItemsPrice.delete(2021);
    expect(yearsOf(noAll)).toEqual([2020, 2022]);
  });

  it("skips a year when one of two classes lacks data", () => {
    const years = [2021, 2022];
    const inp: CategoryInputs = {
      classes: [
        { coicop: "A", group: "CP011", weight: flat(years, 20), price: flat(years, 100) },
        { coicop: "B", group: "CP012", weight: s([[2021, 10]]), price: flat(years, 100) },
      ],
      hfceByGroup: new Map([
        ["CP011", flat(years, 1000)],
        ["CP012", flat(years, 400)],
      ]),
      groupWeight: new Map([
        ["CP011", flat(years, 200)],
        ["CP012", flat(years, 40)],
      ]),
      allItemsPrice: flat(years, 100),
    };
    expect(buildCategorySeries(inp).map((p) => p.year)).toEqual([2021]);
  });

  it("returns [] for no classes and sorts output by year", () => {
    const empty: CategoryInputs = { classes: [], hfceByGroup: new Map(), groupWeight: new Map(), allItemsPrice: flat([2022], 100) };
    expect(buildCategorySeries(empty)).toEqual([]);
    const inp: CategoryInputs = {
      classes: [{ coicop: "A", group: "G", weight: flat([2022, 2020], 1), price: flat([2022, 2020], 100) }],
      hfceByGroup: new Map([["G", flat([2022, 2020], 10)]]),
      groupWeight: new Map([["G", flat([2022, 2020], 1)]]),
      allItemsPrice: s([
        [2022, 100],
        [2020, 100],
      ]),
    };
    expect(buildCategorySeries(inp).map((p) => p.year)).toEqual([2020, 2022]);
  });
});

describe("cagr", () => {
  it("known values", () => {
    // 100 -> 121 over 2 years = 1.21^(1/2) - 1 = 10%
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1, 12);
    // 100 -> 100 = 0
    expect(cagr(100, 100, 4)).toBe(0);
    // 200 -> 100 over 1 year = -50%
    expect(cagr(200, 100, 1)).toBeCloseTo(-0.5, 12);
  });
  it("returns null for zero or negative inputs or non-positive years", () => {
    expect(cagr(0, 10, 2)).toBeNull();
    expect(cagr(10, 0, 2)).toBeNull();
    expect(cagr(-5, 10, 2)).toBeNull();
    expect(cagr(10, -5, 2)).toBeNull();
    expect(cagr(10, 20, 0)).toBeNull();
    expect(cagr(10, 20, -1)).toBeNull();
  });
});

const pt = (year: number, real = 100, volume = 100): TrendPoint => ({ year, nominal: real, real, volume, priceIndex: 100 });

describe("latestWindow", () => {
  it("returns the latest consecutive run; a gap breaks it", () => {
    const pts = [2015, 2016, 2017, 2019, 2020, 2021].map((y) => pt(y));
    expect(latestWindow(pts, 5).map((p) => p.year)).toEqual([2019, 2020, 2021]);
  });
  it("caps at max_years + 1 points", () => {
    const pts = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021].map((y) => pt(y));
    expect(latestWindow(pts, 5).map((p) => p.year)).toEqual([2016, 2017, 2018, 2019, 2020, 2021]);
    expect(latestWindow(pts, 2).map((p) => p.year)).toEqual([2019, 2020, 2021]);
  });
  it("sorts unsorted input and handles empty", () => {
    expect(latestWindow([pt(2021), pt(2019), pt(2020)], 5).map((p) => p.year)).toEqual([2019, 2020, 2021]);
    expect(latestWindow([], 5)).toEqual([]);
  });
});

describe("derivedGrade", () => {
  it("worst wins, never better than B, empty -> null", () => {
    expect(derivedGrade(["A", "A"])).toBe("B");
    expect(derivedGrade(["A", "B"])).toBe("B");
    expect(derivedGrade(["B", "C", "A"])).toBe("C");
    expect(derivedGrade([])).toBeNull();
  });
});

/** Three points 2020-2022 (2 years of growth) with given first/last real and volume. */
const three = (realFirst: number, realLast: number, volFirst: number, volLast: number): TrendPoint[] => [
  pt(2020, realFirst, volFirst),
  pt(2021, (realFirst + realLast) / 2, (volFirst + volLast) / 2),
  pt(2022, realLast, volLast),
];

describe("classifyTrend", () => {
  const A: Grade[] = ["A", "A"];

  it("expanding: real +10%, volume +5%", () => {
    // real 100 -> 121 over 2y = 10%; volume 100 -> 110.25 = 5%
    const r = classifyTrend(three(100, 121, 100, 110.25), A, P);
    expect(r.status).toBe("expanding");
    expect(r.realCagr).toBeCloseTo(0.1, 10);
    expect(r.volumeCagr).toBeCloseTo(0.05, 10);
    expect(r.grade).toBe("B");
    expect(r.firstYear).toBe(2020);
    expect(r.lastYear).toBe(2022);
  });

  it("expanding exactly at +2% real CAGR (boundary is inclusive)", () => {
    // 100 -> 104.04 over 2y = +2% (up to float rounding, so the threshold is the computed value)
    const exact = cagr(100, 104.04, 2)!;
    expect(exact).toBeCloseTo(0.02, 12);
    const r = classifyTrend(three(100, 104.04, 100, 100), A, { ...P, expanding_min_real_cagr: exact });
    expect(r.status).toBe("expanding");
  });

  it("literal 0.02 threshold: 100 -> 104.04 over 2y classifies as expanding", () => {
    // Exposes float rounding at the boundary if sqrt(1.0404) - 1 comes out a hair under 0.02.
    const r = classifyTrend(three(100, 104.04, 100, 100), A, P);
    expect(r.status).toBe("expanding");
  });

  it("just below +2% real is consolidated", () => {
    const r = classifyTrend(three(100, 104.0, 100, 100), A, P); // 1.04^0.5 - 1 = 1.98%
    expect(r.realCagr!).toBeLessThan(0.02);
    expect(r.status).toBe("consolidated");
  });

  it("real >= 2% but volume falling slightly is not expanding (consolidated)", () => {
    // real 100 -> 110.25 = +5%; volume 100 -> 99 over 2y = -0.5% (negative but above -2%)
    const r = classifyTrend(three(100, 110.25, 100, 99), A, P);
    expect(r.volumeCagr!).toBeLessThan(0);
    expect(r.status).toBe("consolidated");
  });

  it("volume exactly 0 with real >= 2% is expanding", () => {
    expect(classifyTrend(three(100, 110.25, 100, 100), A, P).status).toBe("expanding");
  });

  it("real >= 2% and volume <= -2% is threatened (volume rule beats growth in value)", () => {
    // volume 100 -> 90 over 2y = -5.1%
    const r = classifyTrend(three(100, 110.25, 100, 90), A, P);
    expect(r.status).toBe("threatened");
    expect(r.reason).toContain("volume CAGR");
  });

  it("threatened by real value alone", () => {
    // real 100 -> 90.25 = -5%; volume flat
    const r = classifyTrend(three(100, 90.25, 100, 100), A, P);
    expect(r.status).toBe("threatened");
    expect(r.reason).toContain("real value CAGR");
  });

  it("threatened exactly at -2% real (boundary inclusive)", () => {
    const exact = cagr(100, 96.04, 2)!;
    expect(exact).toBeCloseTo(-0.02, 12);
    const r = classifyTrend(three(100, 96.04, 100, 100), A, { ...P, threatened_max_cagr: exact });
    expect(r.status).toBe("threatened");
  });

  it("literal -0.02 threshold: 100 -> 96.04 over 2y classifies as threatened", () => {
    const r = classifyTrend(three(100, 96.04, 100, 100), A, P);
    expect(r.status).toBe("threatened");
  });

  it("volume at -2% alone (real flat) is threatened", () => {
    const exact = cagr(100, 96.04, 2)!;
    const r = classifyTrend(three(100, 100, 100, 96.04), A, { ...P, threatened_max_cagr: exact });
    expect(r.status).toBe("threatened");
    expect(r.reason).toContain("volume CAGR");
  });

  it("just above -2% is consolidated", () => {
    const r = classifyTrend(three(100, 96.5, 100, 96.5), A, P); // 0.965^0.5 - 1 = -1.76%
    expect(r.status).toBe("consolidated");
  });

  it("consolidated: flat", () => {
    const r = classifyTrend(three(100, 100, 100, 100), A, P);
    expect(r.status).toBe("consolidated");
    expect(r.grade).toBe("B");
  });

  it("fewer than 3 points -> insufficient_data, grade null", () => {
    const r = classifyTrend([pt(2021), pt(2022)], A, P);
    expect(r.status).toBe("insufficient_data");
    expect(r.grade).toBeNull();
    expect(r.realCagr).toBeNull();
    expect(r.volumeCagr).toBeNull();
    expect(classifyTrend([], A, P).status).toBe("insufficient_data");
  });

  it("a gap leaving fewer than 3 consecutive points -> insufficient_data", () => {
    const pts = [2018, 2019, 2021, 2022].map((y) => pt(y));
    expect(classifyTrend(pts, A, P).status).toBe("insufficient_data");
  });

  it("only grade C inputs -> insufficient_data, grade null", () => {
    const r = classifyTrend(three(100, 121, 100, 121), ["C", "C"], P);
    expect(r.status).toBe("insufficient_data");
    expect(r.grade).toBeNull();
  });

  it("grade is never better than B; worst input grade wins", () => {
    expect(classifyTrend(three(100, 121, 100, 121), ["A"], P).grade).toBe("B");
    expect(classifyTrend(three(100, 121, 100, 121), ["B", "A"], P).grade).toBe("B");
    expect(classifyTrend(three(100, 121, 100, 121), ["A", "B", "C"], P).grade).toBe("C");
    expect(classifyTrend(three(100, 121, 100, 121), ["B", "C"], P).grade).toBe("C");
  });

  it("non-positive values in the window -> insufficient_data", () => {
    const r = classifyTrend(three(0, 100, 100, 100), A, P);
    expect(r.status).toBe("insufficient_data");
    expect(r.grade).toBeNull();
  });

  it("uses only the capped window and the reason mentions its years", () => {
    // 8 consecutive years, window is the last 6 points: 2017..2022 (5 years of growth)
    const pts = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022].map((y) => pt(y, 100 * 1.1 ** (y - 2015), 100));
    const r = classifyTrend(pts, A, P);
    expect(r.firstYear).toBe(2017);
    expect(r.lastYear).toBe(2022);
    expect(r.realCagr).toBeCloseTo(0.1, 10);
    expect(r.reason).toContain("2017-2022");
    expect(r.series).toBe(pts);
  });

  it("reason mentions the window years for each classified status", () => {
    for (const pts of [three(100, 121, 100, 121), three(100, 100, 100, 100), three(100, 80, 100, 80)]) {
      expect(classifyTrend(pts, A, P).reason).toContain("(2020-2022)");
    }
  });

  it("nominal CAGR is reported separately", () => {
    // pt() sets nominal = real, so nominal CAGR = real CAGR here
    expect(classifyTrend(three(100, 121, 100, 100), A, P).nominalCagr).toBeCloseTo(0.1, 10);
  });
});

describe("classifyTrend without input grades", () => {
  it("is insufficient data, never an ungraded status (product rule 1)", () => {
    const pts = [2018, 2019, 2020, 2021].map((year, i) => ({ year, nominal: 100 + i * 10, real: 100 + i * 10, volume: 100 + i * 10, priceIndex: 100 }));
    const r = classifyTrend(pts, [], { expanding_min_real_cagr: 0.02, threatened_max_cagr: -0.02, min_annual_points: 3, max_years: 5 });
    expect(r.status).toBe("insufficient_data");
    expect(r.grade).toBeNull();
    expect(r.reason).toBe("no graded inputs");
  });
});
