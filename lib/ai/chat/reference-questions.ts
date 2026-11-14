/**
 * The ten reference questions for the Ask screen (SPEC section 10, Day 4 gate). A question passes
 * when the answer passes the citation check (or, for out-of-scope questions, carries no figure),
 * the expected tool was called with the expected slugs, and the cited facts include the expected
 * kind of figure. Figures themselves are correct by construction: they can only come from facts
 * the tools read from the database.
 */
export type ReferenceQuestion = {
  id: number;
  locale: "it" | "en";
  question: string;
  expect: {
    tool?: string;
    /** Every listed key/value must appear in at least one call to `tool`. */
    input?: Record<string, string>;
    /** At least one cited fact label must contain one of these (case-insensitive). */
    citesAny?: string[];
    /** Out of scope: the answer must carry no figure and need not pass the check. */
    noFigures?: boolean;
  };
};

export const REFERENCE_QUESTIONS: ReferenceQuestion[] = [
  { id: 1, locale: "it", question: "Com'è il mercato dei formaggi a Roma?", expect: { tool: "get_cell", input: { category: "cheese", territory: "roma" }, citesAny: ["crescita", "domanda locale"] } },
  { id: 2, locale: "it", question: "Quanto vale la domanda locale stimata di olio extravergine a Milano?", expect: { tool: "get_cell", input: { category: "evo-oil", territory: "milano" }, citesAny: ["domanda locale"] } },
  { id: 3, locale: "en", question: "What is the consumer sentiment index for cheese in Italy, and how many mentions is it based on?", expect: { tool: "get_cell", input: { category: "cheese" }, citesAny: ["sentiment", "mentions"] } },
  { id: 4, locale: "it", question: "Quali sono le migliori opportunità per la pasta?", expect: { tool: "rank_opportunities", input: { category: "pasta" }, citesAny: ["mos"] } },
  { id: 5, locale: "en", question: "Which cells in Germany have the highest Market Opportunity Score?", expect: { tool: "rank_opportunities", input: { country: "de" }, citesAny: ["mos"] } },
  { id: 6, locale: "it", question: "Confronta il cioccolato a Vienna e a Parigi.", expect: { tool: "compare_territories", input: { category: "chocolate" }, citesAny: ["crescita", "domanda locale", "mos"] } },
  { id: 7, locale: "it", question: "Quali leve e barriere d'acquisto emergono per i salumi in Spagna?", expect: { tool: "get_levers", input: { category: "cured-meats", country: "es" }, citesAny: ["leva", "barriera"] } },
  { id: 8, locale: "en", question: "Is real value growth for coffee in France positive, and how does volume compare?", expect: { tool: "get_cell", input: { category: "coffee" }, citesAny: ["real value", "volume"] } },
  { id: 9, locale: "it", question: "Da quali fonti provengono i dati sul miele a Madrid?", expect: { tool: "get_sources", input: { category: "honey", territory: "madrid" } } },
  { id: 10, locale: "en", question: "What will the price of olive oil be in Tokyo next year?", expect: { noFigures: true } },
];

export type ReferenceResult = { id: number; passed: boolean; reasons: string[] };

/** Pure grading of one turn against its expectation. */
export function gradeTurn(
  q: ReferenceQuestion,
  turn: { checked: "passed" | "unavailable"; answer: { sentences: { text: string; facts: string[] }[] }; facts: { label: string }[]; toolCalls: { name: string; input: unknown }[] },
  numbersIn: (s: string) => string[],
): ReferenceResult {
  const reasons: string[] = [];
  const e = q.expect;
  if (e.noFigures) {
    if (turn.answer.sentences.some((s) => numbersIn(s.text).length)) reasons.push("out-of-scope answer contains a figure");
  } else {
    if (turn.checked !== "passed") reasons.push("answer did not pass the citation check");
    if (e.tool) {
      const calls = turn.toolCalls.filter((c) => c.name === e.tool);
      if (!calls.length) reasons.push(`${e.tool} not called (called: ${turn.toolCalls.map((c) => c.name).join(", ") || "none"})`);
      else if (e.input) {
        const ok = calls.some((c) => Object.entries(e.input!).every(([k, v]) => JSON.stringify((c.input as Record<string, unknown>)?.[k] ?? "").includes(v)));
        if (!ok) reasons.push(`${e.tool} not called with ${JSON.stringify(e.input)}`);
      }
    }
    if (e.citesAny && !turn.facts.some((f) => e.citesAny!.some((w) => f.label.toLowerCase().includes(w)))) reasons.push(`no cited fact about ${e.citesAny.join(" / ")}`);
  }
  return { id: q.id, passed: reasons.length === 0, reasons };
}
