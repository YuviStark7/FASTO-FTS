/** Runs the mention-score prompt against its hand-labelled fixtures. Calls the API: a few cents. */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { scoreBatch, type MentionScore } from "../../lib/ai/mention-score";
import { serviceClient } from "../shared/db";
import { allowed } from "../score/score";

type Case = { id: number; category: string; language: string; text: string; expect: Record<string, unknown> };
const { cases } = JSON.parse(readFileSync("lib/ai/prompts/mention-score.v1.fixtures.json", "utf8")) as { cases: Case[] };

// Same model, gates and spend log as the scoring run (app_config is the only place the model id lives).
const db = serviceClient();
const { data: cfg, error: cfgError } = await db.from("app_config").select("key, value").in("key", ["ai.model.classifier", "ai.daily_classification_budget_usd"]);
if (cfgError) throw new Error(cfgError.message);
const model = cfg?.find((r) => r.key === "ai.model.classifier")?.value as string | undefined;
if (!model) throw new Error("app_config ai.model.classifier is not set");
const gate = await allowed(db, Number(cfg?.find((r) => r.key === "ai.daily_classification_budget_usd")?.value ?? 0));
if (gate !== "ok") {
  console.log(`eval: not run (${gate})`);
  process.exit(1);
}

function check(c: Case, r: MentionScore | undefined): string[] {
  if (!r) return ["no result"];
  const fails: string[] = [];
  for (const [k, want] of Object.entries(c.expect)) {
    if (k === "relevant" && r.relevant !== want) fails.push(`relevant ${r.relevant} != ${want}`);
    else if (k === "levers_any" && !(want as string[]).some((x) => r.levers.includes(x as never))) fails.push(`levers ${JSON.stringify(r.levers)} lack any of ${want}`);
    else if (k === "barriers_any" && !(want as string[]).some((x) => r.barriers.includes(x as never))) fails.push(`barriers ${JSON.stringify(r.barriers)} lack any of ${want}`);
    else if (typeof want === "string") {
      const v = r[k as keyof MentionScore] as number | null;
      const n = Number(want.slice(2));
      if (v == null || (want.startsWith(">=") ? v < n : v > n)) fails.push(`${k} ${v} not ${want}`);
    }
  }
  return fails;
}

const res = await scoreBatch(new Anthropic(), model, cases.map((c) => ({ id: c.id, category: c.category, language: c.language, excerpt: c.text })));
const { error: usageError } = await db.from("usage").insert({
  module: "04",
  kind: "classification",
  model,
  input_tokens: res.inputTokens,
  output_tokens: res.outputTokens,
  cost_usd: res.costUsd,
});
if (usageError) throw new Error(`write usage: ${usageError.message}`);
if (res.error) console.log(`eval: batch failed: ${res.error}`);
let failed = 0;
for (const c of cases) {
  const fails = check(c, res.scores.find((s) => s.id === c.id));
  console.log(`${fails.length ? "FAIL" : "ok  "} #${c.id} ${c.category}/${c.language}${fails.length ? `: ${fails.join("; ")}` : ""}`);
  failed += fails.length ? 1 : 0;
}
console.log(`${cases.length - failed}/${cases.length} passed, ${res.inputTokens} in / ${res.outputTokens} out tokens, ~$${res.costUsd.toFixed(4)}`);
process.exitCode = failed ? 1 : 0;
