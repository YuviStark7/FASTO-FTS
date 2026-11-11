/** Runs the mention-score prompt against its hand-labelled fixtures. Calls the API: a few cents. */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { scoreBatch, type MentionScore } from "../../lib/ai/mention-score";

type Case = { id: number; category: string; language: string; text: string; expect: Record<string, unknown> };
const { cases } = JSON.parse(readFileSync("lib/ai/prompts/mention-score.v1.fixtures.json", "utf8")) as { cases: Case[] };
const model = process.env.CLASSIFIER_MODEL ?? "claude-haiku-5-5";

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
let failed = 0;
for (const c of cases) {
  const fails = check(c, res.scores.find((s) => s.id === c.id));
  console.log(`${fails.length ? "FAIL" : "ok  "} #${c.id} ${c.category}/${c.language}${fails.length ? `: ${fails.join("; ")}` : ""}`);
  failed += fails.length ? 1 : 0;
}
console.log(`${cases.length - failed}/${cases.length} passed, ${res.inputTokens} in / ${res.outputTokens} out tokens, ~$${res.costUsd.toFixed(4)}`);
process.exitCode = failed ? 1 : 0;
