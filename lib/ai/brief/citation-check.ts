/**
 * Deterministic citation check (product rules 3 and 4). A sentence that contains a figure must
 * cite at least one fact, every cited fact must exist, and every number written in the sentence
 * must appear in the display, label or period of a fact the sentence cites. No figure ships
 * without a citation; the model cannot introduce a number of its own.
 */
import type { BriefDraft, Fact } from "./types";

export type CheckFailure = { path: string; text: string; reason: string };
export type CheckResult = { passed: boolean; failures: CheckFailure[] };

// Digits with optional thousands separators (. , space, narrow/no-break space) and decimals.
const NUMBER = /\d+(?:[.,   ]\d{3})*(?:[.,]\d+)?/g;

/** Canonical form: digits and a single decimal mark, so "1.234,5" and "1,234.5" both become "1234.5". */
export function normaliseNumber(token: string): string {
  const t = token.replace(/[   ]/g, "");
  const lastSep = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  if (lastSep === -1) return t;
  const decimals = t.length - lastSep - 1;
  // A single separator followed by exactly three digits is a thousands separator ("1.234", "12,000").
  const seps = (t.match(/[.,]/g) ?? []).length;
  if (seps === 1 && decimals === 3) return t.replace(/[.,]/g, "");
  return t.slice(0, lastSep).replace(/[.,]/g, "") + "." + t.slice(lastSep + 1);
}

// Method version ids ("geo-v1", "mos-v1") name a method, not a figure.
const METHOD_ID = /\b[a-z][a-z0-9_]*(?:-[a-z0-9_]+)*-v\d+\b/gi;

export function numbersIn(text: string): string[] {
  return (text.replace(METHOD_ID, " ").match(NUMBER) ?? []).map(normaliseNumber);
}

export function checkDraft(draft: BriefDraft, facts: Fact[]): CheckResult {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const failures: CheckFailure[] = [];
  draft.sections.forEach((s, si) =>
    s.sentences.forEach((sentence, i) => {
      const path = `sections.${si}.sentences.${i}`;
      const nums = numbersIn(sentence.text);
      const unknown = sentence.facts.filter((id) => !byId.has(id));
      if (unknown.length) {
        failures.push({ path, text: sentence.text, reason: `cites unknown facts ${unknown.join(", ")}` });
        return;
      }
      if (!nums.length) return;
      if (!sentence.facts.length) {
        failures.push({ path, text: sentence.text, reason: "contains a figure and cites no fact" });
        return;
      }
      const allowed = new Set(sentence.facts.flatMap((id) => {
        const f = byId.get(id)!;
        return numbersIn(`${f.display} ${f.label} ${f.period}`);
      }));
      const stray = nums.filter((n) => !allowed.has(n));
      if (stray.length) failures.push({ path, text: sentence.text, reason: `figures not in the cited facts: ${stray.join(", ")}` });
    }),
  );
  return { passed: failures.length === 0, failures };
}

/** Removes failing sentences (and sections left empty). The result always passes the check. */
export function dropFailures(draft: BriefDraft, failures: CheckFailure[]): BriefDraft {
  const bad = new Set(failures.map((f) => f.path));
  return {
    sections: draft.sections
      .map((s, si) => ({ ...s, sentences: s.sentences.filter((_, i) => !bad.has(`sections.${si}.sentences.${i}`)) }))
      .filter((s) => s.sentences.length > 0),
  };
}
