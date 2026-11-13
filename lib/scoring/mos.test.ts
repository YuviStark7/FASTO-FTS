import { describe, expect, it } from "vitest";
import { DEFAULT_WEIGHTS, percentileRanks, rankByMos, scoreMos, validWeights } from "./mos";

describe("percentileRanks", () => {
  it("spreads distinct values from 0 to 100", () => {
    const r = percentileRanks(new Map([["a", 10], ["b", 30], ["c", 20]]));
    expect([r.get("a"), r.get("c"), r.get("b")]).toEqual([0, 50, 100]);
  });
  it("gives ties the mid-rank", () => {
    const r = percentileRanks(new Map([["a", 1], ["b", 2], ["c", 2], ["d", 3]]));
    expect(r.get("b")).toBe(50);
    expect(r.get("c")).toBe(50);
    expect(r.get("a")).toBe(0);
    expect(r.get("d")).toBe(100);
  });
  it("gives a lone value 50 and ignores non-finite values", () => {
    const r = percentileRanks(new Map([["a", 5], ["b", NaN]]));
    expect(r.get("a")).toBe(50);
    expect(r.has("b")).toBe(false);
  });
});

describe("scoreMos", () => {
  const full = {
    growth: { pct: 80, grade: "A" as const },
    size: { pct: 60, grade: "B" as const },
    csi: { pct: 40, grade: "C" as const },
    pressure: { pct: 30, grade: "A" as const },
    fit: { pct: 50, grade: "B" as const },
  };

  it("applies the SPEC weights with pressure inverted", () => {
    const r = scoreMos(full);
    // 0.30*80 + 0.20*60 + 0.20*40 + 0.15*(100-30) + 0.15*50 = 24 + 12 + 8 + 10.5 + 7.5
    expect(r.mos).toBe(62);
    expect(r.isPartial).toBe(false);
    expect(r.coveragePct).toBe(100);
    expect(r.grade).toBe("C");
  });

  it("renormalises over present components and labels the score partial", () => {
    const r = scoreMos({ growth: full.growth, size: full.size, pressure: full.pressure });
    // (0.30*80 + 0.20*60 + 0.15*70) / 0.65 = 46.5 / 0.65
    expect(r.mos).toBe(71.5);
    expect(r.isPartial).toBe(true);
    expect(r.coveragePct).toBe(65);
    expect(r.missing).toEqual(["csi", "fit"]);
    expect(r.grade).toBe("B");
  });

  it("returns no score without growth or size", () => {
    const r = scoreMos({ ...full, size: undefined });
    expect(r.mos).toBeNull();
    expect(r.grade).toBeNull();
    expect(r.coveragePct).toBe(80);
  });

  it("re-ranks under a different weight set", () => {
    const w = { growth: 0, size: 1, csi: 0, pressure: 0, fit: 0 };
    expect(scoreMos(full, w).mos).toBe(60);
  });

  it("is not partial when only zero-weight components are missing, and grades on weighted ones", () => {
    const w = { growth: 0.5, size: 0.5, csi: 0, pressure: 0, fit: 0 };
    const r = scoreMos({ growth: full.growth, size: full.size, pressure: full.pressure }, w);
    expect(r.isPartial).toBe(false);
    expect(r.coveragePct).toBe(100);
    expect(r.grade).toBe("B");
  });

  it("contributions add up to the score", () => {
    const r = scoreMos(full);
    const sum = Object.values(r.contributions).reduce((a, b) => a + b!, 0);
    expect(Math.abs(sum - r.mos!)).toBeLessThan(0.3);
  });
});

describe("validWeights", () => {
  it("accepts the default and rejects a set that does not sum to 1", () => {
    expect(validWeights(DEFAULT_WEIGHTS)).toBe(true);
    expect(validWeights({ ...DEFAULT_WEIGHTS, fit: 0.2 })).toBe(false);
    expect(validWeights({ growth: 1 })).toBe(false);
  });
});

describe("rankByMos", () => {
  it("ranks highest first, shares ranks on ties and skips missing scores", () => {
    const r = rankByMos(new Map<string, number | null>([["a", 50], ["b", 70], ["c", null], ["d", 50]]));
    expect([r.get("b"), r.get("a"), r.get("d"), r.has("c")]).toEqual([1, 2, 2, false]);
  });
});
