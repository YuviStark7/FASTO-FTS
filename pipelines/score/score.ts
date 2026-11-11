/**
 * Scores every mention that has no score yet (cache by content hash: a mention is stored once
 * per hash and scored once). Batches of 20, Haiku via lib/ai/mention-score.ts. Spend is logged
 * in `usage`; the kill switch, the global daily limit and the classification budget stop it.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PROMPT_VERSION, scoreBatch, type MentionForScoring } from "../../lib/ai/mention-score";

export async function scoreMentions(db: SupabaseClient, log: (m: string) => void = console.log, limit = 2000) {
  if (!process.env.ANTHROPIC_API_KEY) {
    log("score: ANTHROPIC_API_KEY not set; mentions stay unscored");
    return { scored: 0, skipped: "no_key" as const };
  }
  const { data: cfg } = await db.from("app_config").select("key, value").in("key", ["ai.model.classifier", "ai.daily_classification_budget_usd"]);
  const model = cfg?.find((r) => r.key === "ai.model.classifier")?.value as string;
  const budget = Number(cfg?.find((r) => r.key === "ai.daily_classification_budget_usd")?.value ?? 0);
  if (!model) throw new Error("app_config ai.model.classifier is not set");

  const { data: pending, error } = await db
    .from("mentions")
    .select("id, language, excerpt, categories(slug), mention_scores(mention_id)")
    .is("mention_scores", null)
    .order("id")
    .limit(limit);
  if (error) throw new Error(error.message);
  const queue: MentionForScoring[] = (pending ?? []).map((m) => ({
    id: m.id,
    language: m.language,
    excerpt: m.excerpt,
    category: (m.categories as unknown as { slug: string }).slug,
  }));
  log(`score: ${queue.length} mentions to score with ${model}`);

  const client = new Anthropic();
  let scored = 0;
  for (let i = 0; i < queue.length; i += 20) {
    const gate = await allowed(db, budget);
    if (gate !== "ok") {
      log(`score: stopped (${gate}); ${queue.length - i} mentions left for the next run`);
      return { scored, skipped: gate };
    }
    const batch = queue.slice(i, i + 20);
    let result;
    try {
      result = await scoreBatch(client, model, batch);
    } catch (e) {
      log(`score: batch starting at mention ${batch[0].id} failed: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (result.scores.length) {
      const { error: e } = await db.from("mention_scores").upsert(
        result.scores.map((s) => ({
          mention_id: s.id,
          relevant: s.relevant,
          liking: s.liking,
          desirability: s.desirability,
          trust: s.trust,
          perceived_value: s.perceived_value,
          purchase_intent: s.purchase_intent,
          levers: s.levers,
          barriers: s.barriers,
          model,
          prompt_version: PROMPT_VERSION,
        })),
        { onConflict: "mention_id" },
      );
      if (e) throw new Error(`write scores: ${e.message}`);
    }
    await db.from("usage").insert({
      module: "04",
      kind: "classification",
      model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
    });
    scored += result.scores.length;
  }
  log(`score: ${scored} mentions scored`);
  return { scored, skipped: null };
}

async function allowed(db: SupabaseClient, budget: number): Promise<string> {
  const { data: gate, error } = await db.rpc("ai_quota_check", { p_user: null, p_kind: "classification" });
  if (error) throw new Error(`quota check: ${error.message}`);
  if (gate !== "ok") return String(gate);
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { data } = await db.from("usage").select("cost_usd").eq("kind", "classification").gte("created_at", since.toISOString());
  const spent = (data ?? []).reduce((a, r) => a + Number(r.cost_usd), 0);
  return spent >= budget ? "classification_budget" : "ok";
}
