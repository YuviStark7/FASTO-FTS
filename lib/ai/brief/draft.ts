/**
 * One brief drafting call (module 06). No server-only imports, so the eval pipeline can run it.
 * The model writes prose around the facts it is handed and cites them by id; it computes nothing.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { readFileSync } from "node:fs";
import path from "node:path";
import { costOf } from "../pricing";
import type { CheckFailure } from "./citation-check";
import { BriefDraftSchema, type BriefDraft, type FactPack } from "./types";

export const BRIEF_PROMPT_VERSION = "brief.v1";

let cachedPrompt: string | null = null;
function systemPrompt() {
  cachedPrompt ??= readFileSync(path.join(process.cwd(), "lib/ai/prompts/brief.v1.md"), "utf8");
  return cachedPrompt;
}

export type Usage = { inputTokens: number; outputTokens: number; costUsd: number };

/** One model call. Returns the parsed draft or the reason it is unusable; usage is always filled. */
export async function draftBrief(client: Anthropic, model: string, pack: FactPack, feedback?: CheckFailure[]): Promise<{ draft?: BriefDraft; error?: string; usage: Usage }> {
  const user = feedback?.length
    ? `${JSON.stringify(pack)}\n\nYour previous draft failed the citation check. Rewrite it so that every number is copied from a cited fact. Failures:\n${feedback.map((f) => `- ${f.path}: ${f.reason} — "${f.text}"`).join("\n")}`
    : JSON.stringify(pack);
  const response = await client.messages.create({
    model,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(BriefDraftSchema) },
    system: [{ type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  const usage = costOf(model, response.usage);
  if (response.stop_reason === "refusal") return { error: "refused", usage };
  if (response.stop_reason === "max_tokens") return { error: "truncated", usage };
  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  try {
    const parsed = BriefDraftSchema.safeParse(JSON.parse(text));
    return parsed.success ? { draft: parsed.data, usage } : { error: "schema", usage };
  } catch {
    return { error: "not_json", usage };
  }
}

