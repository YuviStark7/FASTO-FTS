/**
 * Defensive readers for the JSON the advisor stores (brief_versions.content, messages.content).
 * Client-safe. A row that does not match the contract is reported as unreadable, never guessed at.
 */
import { z } from "zod";
import { SECTION_KEYS, type BriefContent, type Fact } from "@/lib/ai/brief/types";

const FactSchema = z.object({
  id: z.string(),
  section: z.enum(SECTION_KEYS),
  label: z.string(),
  display: z.string(),
  grade: z.enum(["A", "B", "C"]).nullable(),
  period: z.string(),
  method: z.string(),
  source: z.string(),
  observationIds: z.array(z.number()),
  snapshotRef: z.string().nullable(),
});
const SentenceSchema = z.object({ text: z.string(), facts: z.array(z.string()) });

const BriefContentSchema = z.object({
  sections: z.array(z.object({ key: z.enum(SECTION_KEYS), heading: z.string(), sentences: z.array(SentenceSchema) })),
  facts: z.array(FactSchema),
  dropped: z.array(z.object({ path: z.string(), text: z.string(), reason: z.string() })).default([]),
  context: z.object({
    category: z.string(),
    territory: z.string(),
    country: z.string(),
    status: z.string(),
    statusRule: z.string().nullable(),
    missingInputs: z.array(z.string()),
    representativenessNote: z.string().nullable(),
    isDemo: z.boolean(),
  }),
});

export function parseBriefContent(json: unknown): BriefContent | null {
  const r = BriefContentSchema.safeParse(json);
  return r.success ? r.data : null;
}

export type Sentence = z.infer<typeof SentenceSchema>;

/** A stored, checked assistant turn (the `ok: true` arm of ChatTurn, without the tool trace). */
export type StoredAnswer = { sentences: Sentence[]; followUps: string[]; facts: Fact[]; checked: "passed" | "unavailable" };

const StoredTurnSchema = z.object({
  ok: z.literal(true),
  answer: z.object({ sentences: z.array(SentenceSchema).min(1), follow_ups: z.array(z.string()).default([]) }),
  facts: z.array(FactSchema),
  checked: z.enum(["passed", "unavailable"]),
});

export function parseStoredAnswer(json: unknown): StoredAnswer | null {
  const r = StoredTurnSchema.safeParse(json);
  if (!r.success) return null;
  return { sentences: r.data.answer.sentences, followUps: r.data.answer.follow_ups, facts: r.data.facts, checked: r.data.checked };
}

export function parseStoredQuestion(json: unknown): string | null {
  const r = z.object({ text: z.string() }).safeParse(json);
  return r.success ? r.data.text : null;
}

/** Facts cited by at least one sentence, in the order of their ids in the pack. */
export function citedFacts(sentences: Sentence[], facts: Fact[]): Fact[] {
  const cited = new Set(sentences.flatMap((s) => s.facts));
  return facts.filter((f) => cited.has(f.id));
}

/** Ids cited in sentences that have no fact behind them. Must be empty for anything shown or exported. */
export function danglingCitations(sentences: Sentence[], facts: Fact[]): string[] {
  const known = new Set(facts.map((f) => f.id));
  return [...new Set(sentences.flatMap((s) => s.facts))].filter((id) => !known.has(id));
}
