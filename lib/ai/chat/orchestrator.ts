import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkDraft, type CheckFailure } from "../brief/citation-check";
import type { Fact } from "../brief/types";
import { costOf, priceFor } from "../pricing";
import { FactRegistry, runTool, ToolInputs, type ToolName } from "./tools";

export const CHAT_PROMPT_VERSION = "chat.v1";
const MAX_ROUNDS = 6;

export const AnswerSchema = z.object({
  sentences: z.array(z.object({ text: z.string(), facts: z.array(z.string()) })).min(1).max(12),
  follow_ups: z.array(z.string()).max(3),
});
export type Answer = z.infer<typeof AnswerSchema>;

export type ChatTurn =
  | { ok: true; answer: Answer; facts: Fact[]; checked: "passed" | "unavailable"; toolCalls: { name: string; input: unknown }[] }
  | { ok: false; reason: "disabled" | "global_limit" | "user_limit" | "model_failed" | "bad_input" };

const DESCRIPTIONS: Record<ToolName, string> = {
  get_cell: "All stored figures for one category in one pilot city: national trend, local demand estimate, consumer sentiment (if published), assortment coverage and MOS, with status and missing inputs.",
  rank_opportunities: "Cells ranked by Market Opportunity Score, highest first, optionally for one category and/or one country. Pass null for a filter you do not use.",
  compare_territories: "get_cell for one category in two to five pilot cities, side by side.",
  get_levers: "Purchase levers and barriers from published online sentiment for a category in a country.",
  get_sources: "Which sources and methods stand behind a cell, with licences.",
};

const DROP = new Set(["$schema", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minItems", "maxItems", "minLength", "maxLength", "pattern"]);

/** JSON Schema for a strict tool: closed objects, every property required, no range keywords
 * (inputs are validated again with zod on the server before any tool runs). */
export function strictSchema(schema: unknown): Anthropic.Tool.InputSchema {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) if (!DROP.has(k)) out[k] = walk(v);
    if (out.type === "object" && out.properties) {
      out.additionalProperties = false;
      out.required = Object.keys(out.properties as object);
    }
    return out;
  };
  return walk(z.toJSONSchema(schema as z.ZodType)) as Anthropic.Tool.InputSchema;
}

function toolDefs(): Anthropic.Tool[] {
  const defs = (Object.keys(ToolInputs) as ToolName[]).map((name) => ({
    name,
    description: DESCRIPTIONS[name],
    input_schema: strictSchema(ToolInputs[name]),
    strict: true,
  }));
  defs.push({
    name: "answer" as ToolName,
    description: "Your final reply to the user. Call once, at the end. Each sentence lists the ids of the facts whose numbers it uses.",
    input_schema: strictSchema(AnswerSchema),
    strict: true,
  });
  return defs;
}

let promptBase: string | null = null;
async function systemPrompt(): Promise<string> {
  promptBase ??= readFileSync(path.join(process.cwd(), "lib/ai/prompts/chat.v1.md"), "utf8");
  const admin = createAdminClient();
  const [{ data: cats }, { data: ters }] = await Promise.all([
    admin.from("categories").select("slug, name_it, name_en").order("slug"),
    admin.from("territories").select("slug, name_it, name_en, level, is_pilot").order("slug"),
  ]);
  const cl = (cats ?? []).map((c) => `${c.slug}: ${c.name_it} / ${c.name_en}`).join("\n");
  const cities = (ters ?? []).filter((t) => t.is_pilot).map((t) => `${t.slug}: ${t.name_it} / ${t.name_en}`).join("\n");
  const countries = (ters ?? []).filter((t) => t.level === "country").map((t) => `${t.slug}: ${t.name_it} / ${t.name_en}`).join("\n");
  return `${promptBase}\nCategories:\n${cl}\n\nPilot cities:\n${cities}\n\nCountries:\n${countries}\n`;
}

const UNAVAILABLE = {
  it: "Non posso rispondere con dati verificati a questa domanda. Prova a chiedere di una categoria in una delle città pilota.",
  en: "I can't answer this with verified data. Try asking about a category in one of the pilot cities.",
};

/**
 * One chat turn: typed tools only, then an `answer` call checked against the facts the tools
 * returned (same check as briefs). One retry with the failures; then "data not available".
 */
export async function chatTurn(question: string, history: Anthropic.MessageParam[], locale: "it" | "en", client?: Anthropic): Promise<ChatTurn> {
  if (!question.trim() || question.length > 2000) return { ok: false, reason: "bad_input" };
  const { userId } = await requireUser();
  const admin = createAdminClient();
  const { data: gate } = await admin.rpc("ai_quota_check", { p_user: userId, p_kind: "chat_turn" });
  if (gate !== "ok") return { ok: false, reason: (gate as "disabled" | "global_limit" | "user_limit") ?? "disabled" };

  const { data: cfg } = await admin.from("app_config").select("key, value").in("key", ["ai.model.orchestrator", "ai.max_tokens_per_chat_turn"]);
  const model = String(cfg?.find((r) => r.key === "ai.model.orchestrator")?.value ?? "");
  const maxTokens = Number(cfg?.find((r) => r.key === "ai.max_tokens_per_chat_turn")?.value ?? 2000);
  priceFor(model);
  const anthropic = client ?? new Anthropic();
  const system = await systemPrompt();
  const tools = toolDefs();

  const reg = new FactRegistry();
  const messages: Anthropic.MessageParam[] = [...history, { role: "user", content: `locale: ${locale}\n\n${question}` }];
  const spent = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  let answer: Answer | null = null;
  let retried = false;
  let checked: "passed" | "unavailable" = "unavailable";
  const toolCalls: { name: string; input: unknown }[] = [];

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        output_config: { effort: "low" },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools,
        messages,
      });
      const u = costOf(model, res.usage);
      spent.inputTokens += u.inputTokens;
      spent.outputTokens += u.outputTokens;
      spent.costUsd += u.costUsd;
      if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") break;
      messages.push({ role: "assistant", content: res.content });
      const calls = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!calls.length) break;

      const results: Anthropic.ToolResultBlockParam[] = [];
      let done = false;
      for (const call of calls) {
        if (call.name === "answer") {
          const parsed = AnswerSchema.safeParse(call.input);
          const check = parsed.success ? checkDraft({ sections: [{ key: "summary", heading: "", sentences: parsed.data.sentences }] }, reg.facts) : null;
          if (parsed.success && check!.passed) {
            answer = parsed.data;
            checked = "passed";
            done = true;
            results.push({ type: "tool_result", tool_use_id: call.id, content: "ok" });
          } else if (!retried) {
            retried = true;
            const failures: CheckFailure[] = check?.failures ?? [{ path: "", text: "", reason: "answer did not match the schema" }];
            results.push({ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Rejected by the citation check. Rewrite and call answer again; copy every number from a cited fact.\n${failures.map((f) => `- ${f.reason}: "${f.text}"`).join("\n")}` });
          } else {
            done = true;
            results.push({ type: "tool_result", tool_use_id: call.id, is_error: true, content: "Rejected again." });
          }
        } else {
          toolCalls.push({ name: call.name, input: call.input });
          const out = call.name in ToolInputs ? await runTool(call.name as ToolName, call.input, locale, reg) : { error: "unknown tool" };
          results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(out) });
        }
      }
      if (done) break;
      messages.push({ role: "user", content: results });
    }
  } catch {
    await logUsage(admin, userId, model, spent);
    return { ok: false, reason: "model_failed" };
  }
  await logUsage(admin, userId, model, spent);

  if (!answer) return { ok: true, answer: { sentences: [{ text: UNAVAILABLE[locale], facts: [] }], follow_ups: [] }, facts: [], checked: "unavailable", toolCalls };
  const cited = new Set(answer.sentences.flatMap((s) => s.facts));
  return { ok: true, answer, facts: reg.facts.filter((f) => cited.has(f.id)), checked, toolCalls };
}

async function logUsage(admin: ReturnType<typeof createAdminClient>, userId: string, model: string, spent: { inputTokens: number; outputTokens: number; costUsd: number }) {
  const { data: m } = await admin.from("memberships").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
  await admin.from("usage").insert({
    user_id: userId,
    org_id: m?.org_id ?? null,
    module: "chat",
    kind: "chat_turn",
    model,
    input_tokens: spent.inputTokens,
    output_tokens: spent.outputTokens,
    cost_usd: Number(spent.costUsd.toFixed(6)),
  });
}
