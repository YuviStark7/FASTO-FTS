import { describe, expect, it } from "vitest";
import { checkDraft, dropFailures, normaliseNumber, numbersIn } from "./citation-check";
import type { Fact } from "./types";

const fact = (id: string, display: string, period = "2019–2024"): Fact => ({
  id,
  section: "market",
  label: "Crescita reale del valore",
  display,
  grade: "B",
  period,
  method: "trend-v1",
  source: "Eurostat",
  observationIds: [1, 2],
  snapshotRef: "trend_snapshots:9",
});

describe("normaliseNumber", () => {
  it("reads Italian and English separators the same way", () => {
    expect(normaliseNumber("1.234,5")).toBe("1234.5");
    expect(normaliseNumber("1,234.5")).toBe("1234.5");
    expect(normaliseNumber("187,8")).toBe("187.8");
    expect(normaliseNumber("12.000")).toBe("12000");
    expect(normaliseNumber("1 234")).toBe("1234");
  });
  it("finds every number in a sentence", () => {
    expect(numbersIn("Tra il 2019 e il 2024 la spesa vale 187,8 Mln € (+2,1%).")).toEqual(["2019", "2024", "187.8", "2.1"]);
  });
  it("ignores method version ids but not figures next to them", () => {
    expect(numbersIn("Stima del modello geo-v1 (grado B) e mos-v1: 62.")).toEqual(["62"]);
  });
});

describe("checkDraft", () => {
  const facts = [fact("F1", "+2,1%"), fact("F2", "187,8 Mln €", "2024")];

  it("passes cited figures, including years from the fact period", () => {
    const r = checkDraft({ sections: [{ key: "market", heading: "Mercato", sentences: [{ text: "Dal 2019 al 2024 il valore reale cresce del +2,1% annuo.", facts: ["F1"] }] }] }, facts);
    expect(r.passed).toBe(true);
  });

  it("passes sentences without figures and without citations", () => {
    const r = checkDraft({ sections: [{ key: "summary", heading: "Sintesi", sentences: [{ text: "Il mercato è in espansione.", facts: [] }] }] }, facts);
    expect(r.passed).toBe(true);
  });

  it("fails a figure with no citation", () => {
    const r = checkDraft({ sections: [{ key: "market", heading: "Mercato", sentences: [{ text: "Il valore cresce del 2,1%.", facts: [] }] }] }, facts);
    expect(r.failures[0].reason).toMatch(/cites no fact/);
  });

  it("fails a number the cited facts do not contain (no arithmetic by the model)", () => {
    const r = checkDraft({ sections: [{ key: "market", heading: "Mercato", sentences: [{ text: "In cinque anni il valore cresce di circa il 10,5%.", facts: ["F1"] }] }] }, facts);
    expect(r.passed).toBe(false);
    expect(r.failures[0].reason).toMatch(/10.5/);
  });

  it("fails a citation to a fact that does not exist", () => {
    const r = checkDraft({ sections: [{ key: "market", heading: "Mercato", sentences: [{ text: "Il mercato cresce.", facts: ["F9"] }] }] }, facts);
    expect(r.failures[0].reason).toMatch(/unknown facts F9/);
  });

  it("drops failing sentences and empty sections, and what is left passes", () => {
    const draft = {
      sections: [
        { key: "market" as const, heading: "Mercato", sentences: [{ text: "Vale 187,8 Mln €.", facts: ["F2"] }, { text: "Vale 200 Mln €.", facts: ["F2"] }] },
        { key: "limits" as const, heading: "Limiti", sentences: [{ text: "Stimato 5% in più.", facts: [] }] },
      ],
    };
    const r = checkDraft(draft, facts);
    expect(r.failures).toHaveLength(2);
    const clean = dropFailures(draft, r.failures);
    expect(clean.sections).toHaveLength(1);
    expect(clean.sections[0].sentences).toHaveLength(1);
    expect(checkDraft(clean, facts).passed).toBe(true);
  });
});
