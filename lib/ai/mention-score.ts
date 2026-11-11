import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * Module 04 classifier: Haiku judges each mention (relevance, five 0-100 dimensions, levers,
 * barriers). It never aggregates: the CSI is computed in lib/scoring/csi.ts (product rule 3).
 */
export const PROMPT_VERSION = "mention-score.v1";
export const LEVERS = [
  "origin_territory", "quality_taste", "artisanal_tradition", "certification", "organic_natural", "health_nutrition",
  "price_value", "convenience", "sustainability", "gift_occasion", "brand_trust", "novelty",
] as const;
export const BARRIERS = [
  "price_high", "availability", "authenticity_doubt", "health_concern", "quality_inconsistency",
  "sustainability_concern", "taste_dislike", "packaging", "safety_trust",
] as const;

const score = z.number().int().min(0).max(100).nullable();
export const ScoreSchema = z.object({
  results: z.array(
    z.object({
      id: z.number().int(),
      relevant: z.boolean(),
      liking: score,
      desirability: score,
      trust: score,
      perceived_value: score,
      purchase_intent: score,
      levers: z.array(z.enum(LEVERS)),
      barriers: z.array(z.enum(BARRIERS)),
    }),
  ),
});
export type MentionScore = z.infer<typeof ScoreSchema>["results"][number];

export type MentionForScoring = { id: number; category: string; language: string; excerpt: string };

let cachedPrompt: string | null = null;
export function systemPrompt(): string {
  cachedPrompt ??= readFileSync(path.join(process.cwd(), "lib/ai/prompts/mention-score.v1.md"), "utf8");
  return cachedPrompt;
}

/** Haiku 5.5 list prices, USD per token (cached 2026-11-03); logged spend is an estimate. */
const PRICE = { "claude-haiku-5-5": { input: 0.1 / 1e6, output: 0.5 / 1e6 } } as Record<string, { input: number; output: number }>;

export type BatchResult = { scores: MentionScore[]; inputTokens: number; outputTokens: number; costUsd: number };

export async function scoreBatch(client: Anthropic, model: string, batch: MentionForScoring[]): Promise<BatchResult> {
  const response = await client.messages.parse({
    model,
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(ScoreSchema) },
    system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: JSON.stringify(batch.map((m) => ({ id: m.id, category: m.category, language: m.language, text: m.excerpt }))),
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("classifier refused the batch");
  if (response.stop_reason === "max_tokens") throw new Error("classifier output truncated");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("classifier output did not match the schema");

  // Keep only results for ids we sent, once each; a mention without a valid result stays unscored.
  const want = new Set(batch.map((m) => m.id));
  const seen = new Set<number>();
  const scores = parsed.results.filter((r) => {
    if (!want.has(r.id) || seen.has(r.id)) return false;
    seen.add(r.id);
    return isConsistent(r);
  });
  const p = PRICE[model] ?? { input: 0, output: 0 };
  const inputTokens = response.usage.input_tokens + (response.usage.cache_creation_input_tokens ?? 0) + (response.usage.cache_read_input_tokens ?? 0);
  return {
    scores,
    inputTokens,
    outputTokens: response.usage.output_tokens,
    costUsd: inputTokens * p.input + response.usage.output_tokens * p.output,
  };
}

/** Relevant mentions carry all five scores; irrelevant ones carry none. */
export function isConsistent(r: MentionScore): boolean {
  const s = [r.liking, r.desirability, r.trust, r.perceived_value, r.purchase_intent];
  return r.relevant ? s.every((x) => x !== null) : s.every((x) => x === null) && !r.levers.length && !r.barriers.length;
}
