import { describe, expect, it } from "vitest";
import { computeCsi, representativenessNote, type CsiParams, type ScoredMention } from "./csi";

const p: CsiParams = {
  weights: { liking: 0.3, desirability: 0.25, trust: 0.2, perceived_value: 0.15, purchase_intent: 0.1 },
  min_mentions: 3,
  window_days: 365,
};
const m = (id: number, v: number, extra: Partial<ScoredMention> = {}): ScoredMention => ({
  id, language: "it", publishedOn: "2026-10-01", sourceId: 9,
  liking: v, desirability: v, trust: v, perceived_value: v, purchase_intent: v, levers: [], barriers: [], ...extra,
});

describe("computeCsi (csi-v1)", () => {
  it("is the SPEC weighted mean of the dimension means", () => {
    // means: liking 80, desirability 60, trust 70, value 40, intent 50
    const ms = [
      { ...m(1, 0), liking: 70, desirability: 50, trust: 60, perceived_value: 30, purchase_intent: 50 },
      { ...m(2, 0), liking: 90, desirability: 70, trust: 80, perceived_value: 50, purchase_intent: 50 },
      { ...m(3, 0), liking: 80, desirability: 60, trust: 70, perceived_value: 40, purchase_intent: 50 },
    ];
    const r = computeCsi(ms, p);
    // 0.30*80 + 0.25*60 + 0.20*70 + 0.15*40 + 0.10*50 = 24 + 15 + 14 + 6 + 5 = 64
    expect(r.csi).toBeCloseTo(64, 10);
    expect(r.components.liking).toBeCloseTo(80, 10);
    expect(r.published).toBe(true);
  });

  it("is not published below the minimum, and never reads as a low score", () => {
    const r = computeCsi([m(1, 90), m(2, 90)], p);
    expect(r.published).toBe(false);
    expect(r.csi).toBeNull();
    expect(r.n).toBe(2);
    expect(r.components.liking).toBe(90); // components stay visible as context
  });

  it("is published exactly at the minimum", () => {
    expect(computeCsi([m(1, 50), m(2, 50), m(3, 50)], p).published).toBe(true);
  });

  it("counts each lever once per mention, ranks by count, keeps up to three examples", () => {
    const r = computeCsi(
      [
        m(1, 50, { levers: ["quality_taste", "quality_taste", "origin_territory"] }),
        m(2, 50, { levers: ["quality_taste"], barriers: ["price_high"] }),
        m(3, 50, { levers: ["origin_territory"] }),
        m(4, 50, { levers: ["quality_taste"] }),
      ],
      p,
    );
    expect(r.levers[0]).toEqual({ code: "quality_taste", count: 3, share: 0.75, examples: [1, 2, 4] });
    expect(r.levers[1].code).toBe("origin_territory");
    expect(r.barriers).toEqual([{ code: "price_high", count: 1, share: 0.25, examples: [2] }]);
  });

  it("reports languages and sources", () => {
    const r = computeCsi([m(1, 50), m(2, 50, { language: "fr", sourceId: 3 })], p);
    expect(r.languages).toEqual(["fr", "it"]);
    expect(r.sourceIds).toEqual([3, 9]);
  });

  it("empty input: nothing published, no division by zero", () => {
    const r = computeCsi([], p);
    expect(r).toMatchObject({ n: 0, published: false, csi: null });
    expect(r.components.trust).toBeNull();
  });

  it("the representativeness note always says the sample is not representative", () => {
    const r = computeCsi([m(1, 50)], p);
    const note = representativenessNote(r, ["bluesky"], { start: "2025-11-12", end: "2026-11-12" }, 3);
    expect(note).toMatch(/not a representative sample/);
    expect(note).toMatch(/not published/);
  });
});
