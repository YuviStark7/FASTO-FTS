/**
 * Runs the brief prompt against fact packs built from real snapshots (lib/ai/prompts/brief.v1.fixtures.json).
 * Each case passes when the draft passes the citation check without dropping sentences (after at
 * most the one retry the app also allows), has the required sections, is long enough and names
 * the caveat the case expects. Calls the API: a few cents per case.
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { checkDraft } from "../../lib/ai/brief/citation-check";
import { draftBrief } from "../../lib/ai/brief/draft";
import type { FactPack } from "../../lib/ai/brief/types";
import { priceFor } from "../../lib/ai/pricing";
import { serviceClient } from "../shared/db";

type Case = { name: string; pack: FactPack; expect: { min_sentences: number; sections: string[]; must_mention_any: string[] } };
const { cases } = JSON.parse(readFileSync("lib/ai/prompts/brief.v1.fixtures.json", "utf8")) as { cases: Case[] };

async function main() {
  const db = serviceClient();
  const { data: cfg, error } = await db.from("app_config").select("value").eq("key", "ai.model.orchestrator").single();
  if (error) throw new Error(error.message);
  const model = String(cfg.value);
  priceFor(model);
  const { data: gate } = await db.rpc("ai_quota_check", { p_user: null, p_kind: "brief" });
  if (gate !== "ok") {
    console.log(`brief eval: not run (${gate})`);
    process.exitCode = 1;
    return;
  }
  const client = new Anthropic();
  let failed = 0;
  let cost = 0;
  for (const c of cases) {
    const fails: string[] = [];
    let attempt = await draftBrief(client, model, c.pack);
    let spent = { ...attempt.usage };
    let check = attempt.draft ? checkDraft(attempt.draft, c.pack.facts) : null;
    let retried = false;
    if (!attempt.draft || !check!.passed) {
      retried = true;
      attempt = await draftBrief(client, model, c.pack, check?.failures);
      spent = {
        inputTokens: spent.inputTokens + attempt.usage.inputTokens,
        outputTokens: spent.outputTokens + attempt.usage.outputTokens,
        costUsd: spent.costUsd + attempt.usage.costUsd,
      };
      check = attempt.draft ? checkDraft(attempt.draft, c.pack.facts) : null;
    }
    cost += spent.costUsd;
    const { error: ue } = await db
      .from("usage")
      .insert({ module: "06", kind: "brief", model, input_tokens: spent.inputTokens, output_tokens: spent.outputTokens, cost_usd: Number(spent.costUsd.toFixed(6)) });
    if (ue) throw new Error(`write usage: ${ue.message}`);
    const d = attempt.draft;
    if (!d) fails.push(`no draft (${attempt.error})`);
    else {
      if (!check!.passed) fails.push(`citation check: ${check!.failures.map((f) => `${f.reason} in "${f.text}"`).join(" | ")}`);
      const keys: string[] = d.sections.map((s) => s.key);
      const missing = c.expect.sections.filter((k) => !keys.includes(k));
      if (missing.length) fails.push(`missing sections ${missing.join(", ")}`);
      const n = d.sections.reduce((a, s) => a + s.sentences.length, 0);
      if (n < c.expect.min_sentences) fails.push(`${n} sentences < ${c.expect.min_sentences}`);
      const text = d.sections.flatMap((s) => s.sentences.map((x) => x.text)).join(" ").toLowerCase();
      if (!c.expect.must_mention_any.some((w) => text.includes(w.toLowerCase()))) fails.push(`does not mention any of ${c.expect.must_mention_any.join(", ")}`);
      console.log(`--- ${c.name}${retried ? " (after retry)" : ""}`);
      for (const s of d.sections) console.log(`## ${s.heading}\n${s.sentences.map((x) => `${x.text} [${x.facts.join(",")}]`).join("\n")}`);
    }
    console.log(`${fails.length ? "FAIL" : "ok  "} ${c.name}${fails.length ? `: ${fails.join("; ")}` : ""}`);
    failed += fails.length ? 1 : 0;
  }
  console.log(`${cases.length - failed}/${cases.length} passed, ~$${cost.toFixed(4)}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
