import { describe, expect, it } from "vitest";
import { COMPONENTS, DEFAULT_WEIGHTS, validWeights } from "@/lib/scoring/mos";
import { parseMosComponents, parseWeights, toCellComponents } from "@/lib/queries/mos-shape";
import { normaliseWeights, sameWeights, toSliders } from "@/components/opportunities/weights";

describe("what-if weights", () => {
  it("round-trips the default weights through the sliders", () => {
    const w = normaliseWeights(toSliders(DEFAULT_WEIGHTS))!;
    expect(sameWeights(w, DEFAULT_WEIGHTS)).toBe(true);
    expect(validWeights(w)).toBe(true);
  });

  it("always sums to exactly 1, whatever the proportions", () => {
    for (const s of [
      { growth: 1, size: 1, csi: 1, pressure: 0, fit: 0 },
      { growth: 33, size: 33, csi: 33, pressure: 7, fit: 1 },
      { growth: 100, size: 100, csi: 100, pressure: 100, fit: 100 },
      { growth: 0, size: 0, csi: 0, pressure: 0, fit: 5 },
    ]) {
      const w = normaliseWeights(s)!;
      expect(validWeights(w)).toBe(true);
      expect(Math.round(COMPONENTS.reduce((a, k) => a + w[k] * 10_000, 0))).toBe(10_000);
    }
  });

  it("has no weights when every slider is at zero", () => {
    expect(normaliseWeights({ growth: 0, size: 0, csi: 0, pressure: 0, fit: 0 })).toBeNull();
  });
});

describe("stored MOS components", () => {
  const stored = {
    growth: { present: true, pct: 80, raw: 0.031, grade: "B", contribution: 28.2 },
    size: { present: true, pct: 40, raw: 1_200_000, grade: "B", contribution: 9.4 },
    csi: { present: false, pct: null, raw: null, grade: null, contribution: null },
    pressure: { present: true, pct: 25, grade: "C", contribution: 13.2, competitors: { raw: 12, pct: 25 }, barriers_per_mention: { raw: null, pct: null } },
    fit: { present: false, pct: null, grade: null, contribution: null },
  };

  it("keeps a missing component missing, never zero", () => {
    const c = parseMosComponents(stored);
    expect(c.csi).toEqual({ present: false, pct: null, raw: null, grade: null, contribution: null });
    expect(c.pressureParts).toEqual({ competitors: { raw: 12, pct: 25 }, barriersPerMention: { raw: null, pct: null } });
    expect(Object.keys(toCellComponents(c))).toEqual(["growth", "size", "pressure"]);
  });

  it("does not treat a percentile without a grade as present", () => {
    const c = parseMosComponents({ ...stored, growth: { present: true, pct: 80, raw: 0.031, grade: null, contribution: null } });
    expect(c.growth.present).toBe(false);
    expect(toCellComponents(c).growth).toBeUndefined();
  });

  it("survives a malformed payload", () => {
    const c = parseMosComponents(null);
    expect(COMPONENTS.every((k) => !c[k].present)).toBe(true);
    expect(parseWeights({ growth: 1 })).toBeNull();
    expect(parseWeights({ growth: 0.3, size: 0.2, csi: 0.2, pressure: 0.15, fit: 0.15 })).toEqual(DEFAULT_WEIGHTS);
  });
});
