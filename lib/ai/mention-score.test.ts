import { describe, expect, it } from "vitest";
import { isConsistent, ScoreSchema, systemPrompt, LEVERS, BARRIERS, type MentionScore } from "./mention-score";

const base: { id: number; levers: MentionScore["levers"]; barriers: MentionScore["barriers"] } = { id: 1, levers: [], barriers: [] };

describe("mention-score.v1 output contract", () => {
  it("accepts a relevant result with all five scores", () => {
    const r = { ...base, relevant: true, liking: 80, desirability: 70, trust: 60, perceived_value: 40, purchase_intent: 50, levers: ["quality_taste" as const] };
    expect(ScoreSchema.parse({ results: [r] }).results).toHaveLength(1);
    expect(isConsistent(r)).toBe(true);
  });

  it("rejects scores outside 0-100 and levers outside the vocabulary", () => {
    expect(() => ScoreSchema.parse({ results: [{ ...base, relevant: true, liking: 101, desirability: 1, trust: 1, perceived_value: 1, purchase_intent: 1 }] })).toThrow();
    expect(() => ScoreSchema.parse({ results: [{ ...base, relevant: true, liking: 1, desirability: 1, trust: 1, perceived_value: 1, purchase_intent: 1, levers: ["cheap"] }] })).toThrow();
  });

  it("a relevant result missing a score, or an irrelevant one carrying scores, is inconsistent and dropped", () => {
    expect(isConsistent({ ...base, relevant: true, liking: 50, desirability: null, trust: 50, perceived_value: 50, purchase_intent: 50 })).toBe(false);
    expect(isConsistent({ ...base, relevant: false, liking: 50, desirability: null, trust: null, perceived_value: null, purchase_intent: null })).toBe(false);
    expect(isConsistent({ ...base, relevant: false, liking: null, desirability: null, trust: null, perceived_value: null, purchase_intent: null })).toBe(true);
  });

  it("the prompt lists exactly the lever and barrier vocabulary of the schema", () => {
    const prompt = systemPrompt();
    for (const code of [...LEVERS, ...BARRIERS]) expect(prompt).toContain(code);
    expect(prompt).toMatch(/never compute/);
  });
});
