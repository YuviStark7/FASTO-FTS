import { describe, expect, it } from "vitest";
import { estimateLocalDemand, median, type GeoInputs, type GeoParams } from "./geo";

const P: GeoParams = {
  income_elasticity: { low: 0.3, mid: 0.5, high: 0.7 },
  tourist_food_share: { low: 0.5, mid: 0.75, high: 1.0 },
  pos_elasticity: { low: 0, mid: 0.1, high: 0.2 },
  days_per_year: 365,
};

// perCapita = 60,000,000,000 / 60,000,000 = 1000; base = 1000 * 2,000,000 = 2,000,000,000
const CORE: GeoInputs = { nationalSpend: 60_000_000_000, nationalPopulation: 60_000_000, cityPopulation: 2_000_000 };

describe("estimateLocalDemand", () => {
  it("base = national spend / national pop x city pop; no corrections -> all neutral", () => {
    const r = estimateLocalDemand(CORE, P)!;
    expect(r.perCapita).toBeCloseTo(1000, 6);
    expect(r.base).toBeCloseTo(2_000_000_000, 0);
    expect(r.value).toBeCloseTo(r.base, 0);
    expect(r.low).toBeCloseTo(r.base, 0);
    expect(r.high).toBeCloseTo(r.base, 0);
    expect(r.missing).toEqual(["income", "tourism", "pos"]);
    for (const f of Object.values(r.factors)) {
      expect(f).toMatchObject({ value: 1, low: 1, high: 1, missing: true });
    }
  });

  it("income factor at low/mid/high elasticity", () => {
    // ratio = 24000 / 20000 = 1.2; 1.2^0.3 = 1.05620; 1.2^0.5 = 1.09545; 1.2^0.7 = 1.13599
    const r = estimateLocalDemand({ ...CORE, regionalIncomePc: 24000, nationalIncomePc: 20000 }, P)!;
    const f = r.factors.income;
    expect(f.low).toBeCloseTo(Math.pow(1.2, 0.3), 10);
    expect(f.value).toBeCloseTo(1.095445, 5);
    expect(f.high).toBeCloseTo(Math.pow(1.2, 0.7), 10);
    expect(f.missing).toBeUndefined();
    expect(r.value / r.base).toBeCloseTo(1.095445, 5);
    expect(r.missing).toEqual(["tourism", "pos"]);
  });

  it("income ratio < 1: low <= value <= high still holds (spread is min/max)", () => {
    // ratio 0.8: 0.8^0.3 = 0.9353 (larger), 0.8^0.7 = 0.8554 (smaller)
    const r = estimateLocalDemand({ ...CORE, regionalIncomePc: 16000, nationalIncomePc: 20000 }, P)!;
    const f = r.factors.income;
    expect(f.low).toBeCloseTo(Math.pow(0.8, 0.7), 10);
    expect(f.high).toBeCloseTo(Math.pow(0.8, 0.3), 10);
    expect(f.low).toBeLessThanOrEqual(f.value);
    expect(f.value).toBeLessThanOrEqual(f.high);
    expect(r.low).toBeLessThanOrEqual(r.value);
    expect(r.value).toBeLessThanOrEqual(r.high);
  });

  it("tourism factor at low/mid/high share", () => {
    // share = 7,300,000 / (365 * 2,000,000) = 0.01; factors 1.005, 1.0075, 1.01
    const r = estimateLocalDemand({ ...CORE, touristNights: 7_300_000 }, P)!;
    const f = r.factors.tourism;
    expect(f.low).toBeCloseTo(1.005, 10);
    expect(f.value).toBeCloseTo(1.0075, 10);
    expect(f.high).toBeCloseTo(1.01, 10);
    expect(r.value / r.base).toBeCloseTo(1.0075, 10);
    expect(r.missing).toEqual(["income", "pos"]);
  });

  it("zero tourist nights is a real value: factor 1, not missing", () => {
    const r = estimateLocalDemand({ ...CORE, touristNights: 0 }, P)!;
    expect(r.factors.tourism).toMatchObject({ value: 1, low: 1, high: 1 });
    expect(r.factors.tourism.missing).toBeUndefined();
    expect(r.missing).not.toContain("tourism");
  });

  it("negative, null or non-finite tourist nights count as missing", () => {
    expect(estimateLocalDemand({ ...CORE, touristNights: -1 }, P)!.missing).toContain("tourism");
    expect(estimateLocalDemand({ ...CORE, touristNights: NaN }, P)!.missing).toContain("tourism");
    expect(estimateLocalDemand({ ...CORE, touristNights: null }, P)!.missing).toContain("tourism");
  });

  it("pos factor at low/mid/high elasticity", () => {
    // ratio = 8 / 4 = 2; 2^0 = 1; 2^0.1 = 1.07177; 2^0.2 = 1.14870
    const r = estimateLocalDemand({ ...CORE, cityPosDensity: 8, refPosDensity: 4 }, P)!;
    const f = r.factors.pos;
    expect(f.low).toBeCloseTo(1, 12);
    expect(f.value).toBeCloseTo(1.071773, 5);
    expect(f.high).toBeCloseTo(1.148698, 5);
    expect(r.missing).toEqual(["income", "tourism"]);
  });

  it("pos ratio < 1: interval still ordered", () => {
    const r = estimateLocalDemand({ ...CORE, cityPosDensity: 2, refPosDensity: 4 }, P)!;
    const f = r.factors.pos;
    expect(f.low).toBeLessThanOrEqual(f.value);
    expect(f.value).toBeLessThanOrEqual(f.high);
    expect(f.low).toBeCloseTo(Math.pow(0.5, 0.2), 10);
    expect(f.high).toBeCloseTo(1, 12);
  });

  it("all factors: value is the product of mids; interval contains value", () => {
    const inp: GeoInputs = {
      ...CORE,
      regionalIncomePc: 24000,
      nationalIncomePc: 20000,
      touristNights: 7_300_000,
      cityPosDensity: 8,
      refPosDensity: 4,
    };
    const r = estimateLocalDemand(inp, P)!;
    expect(r.value / r.base).toBeCloseTo(Math.pow(1.2, 0.5) * 1.0075 * Math.pow(2, 0.1), 10);
    expect(r.low / r.base).toBeCloseTo(Math.pow(1.2, 0.3) * 1.005 * 1, 10);
    expect(r.high / r.base).toBeCloseTo(Math.pow(1.2, 0.7) * 1.01 * Math.pow(2, 0.2), 10);
    expect(r.low).toBeLessThanOrEqual(r.value);
    expect(r.value).toBeLessThanOrEqual(r.high);
    expect(r.missing).toEqual([]);
  });

  it("a correction with only one of its two inputs is neutral and listed", () => {
    expect(estimateLocalDemand({ ...CORE, regionalIncomePc: 24000 }, P)!.missing).toContain("income");
    expect(estimateLocalDemand({ ...CORE, cityPosDensity: 8 }, P)!.missing).toContain("pos");
  });

  it("missing or non-positive core input -> null", () => {
    expect(estimateLocalDemand({ ...CORE, nationalSpend: NaN }, P)).toBeNull();
    expect(estimateLocalDemand({ ...CORE, nationalSpend: 0 }, P)).toBeNull();
    expect(estimateLocalDemand({ ...CORE, nationalPopulation: 0 }, P)).toBeNull();
    expect(estimateLocalDemand({ ...CORE, cityPopulation: -5 }, P)).toBeNull();
    expect(estimateLocalDemand({ ...CORE, cityPopulation: undefined as unknown as number }, P)).toBeNull();
  });
});

describe("median", () => {
  it("odd", () => expect(median([5, 1, 3])).toBe(3));
  it("even", () => expect(median([4, 1, 3, 2])).toBe(2.5));
  it("empty", () => expect(median([])).toBeNull());
  it("filters NaN and infinities", () => {
    expect(median([NaN, 1, 3, Infinity])).toBe(2);
    expect(median([NaN])).toBeNull();
  });
  it("does not mutate input", () => {
    const xs = [3, 1, 2];
    median(xs);
    expect(xs).toEqual([3, 1, 2]);
  });
});
