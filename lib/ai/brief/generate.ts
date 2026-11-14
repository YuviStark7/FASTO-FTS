import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getStaffRole } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { priceFor } from "../pricing";
import { checkDraft, dropFailures, type CheckFailure } from "./citation-check";
import { buildFactPack } from "./facts";
import { BRIEF_PROMPT_VERSION, draftBrief, type Usage } from "./draft";
import type { BriefContent, BriefDraft } from "./types";

export { BRIEF_PROMPT_VERSION };

export type GenerateResult =
  | { ok: true; briefId: number; versionId: number; version: number; dropped: number }
  | { ok: false; reason: "not_staff" | "no_cell" | "no_facts" | "disabled" | "global_limit" | "user_limit" | "model_failed" };


/**
 * Generates a new brief version for a cell (analysts and admins; 3 per user per day by default).
 * Flow: fact pack (code) -> draft (model) -> citation check -> one retry with the failures ->
 * failing sentences dropped -> stored with its citations. A stored version always passes the check.
 */
export async function generateBrief(categorySlug: string, territorySlug: string, locale: "it" | "en", client?: Anthropic): Promise<GenerateResult> {
  const { userId, role } = await getStaffRole();
  if (!role) return { ok: false, reason: "not_staff" };
  const admin = createAdminClient();

  const { data: gate } = await admin.rpc("ai_quota_check", { p_user: userId, p_kind: "brief" });
  if (gate !== "ok") return { ok: false, reason: (gate as "disabled" | "global_limit" | "user_limit") ?? "disabled" };

  const pack = await buildFactPack(categorySlug, territorySlug, locale);
  if (!pack) return { ok: false, reason: "no_cell" };
  if (!pack.facts.length) return { ok: false, reason: "no_facts" };

  const { data: cfg } = await admin.from("app_config").select("value").eq("key", "ai.model.orchestrator").single();
  const model = String(cfg?.value ?? "");
  priceFor(model); // unknown model: refuse before any spend
  const anthropic = client ?? new Anthropic();

  const total: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  const addUsage = (u: Usage) => {
    total.inputTokens += u.inputTokens;
    total.outputTokens += u.outputTokens;
    total.costUsd += u.costUsd;
  };
  const { data: membership } = await admin.from("memberships").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
  const logUsage = async () => {
    await admin.from("usage").insert({
      user_id: userId,
      org_id: membership?.org_id ?? null,
      module: "06",
      kind: "brief",
      model,
      input_tokens: total.inputTokens,
      output_tokens: total.outputTokens,
      cost_usd: Number(total.costUsd.toFixed(6)),
    });
  };

  let draft: BriefDraft | undefined;
  let dropped: CheckFailure[] = [];
  try {
    const first = await draftBrief(anthropic, model, pack);
    addUsage(first.usage);
    let check = first.draft ? checkDraft(first.draft, pack.facts) : null;
    draft = first.draft;
    if (!draft || !check!.passed) {
      const second = await draftBrief(anthropic, model, pack, check?.failures);
      addUsage(second.usage);
      if (second.draft) {
        draft = second.draft;
        check = checkDraft(draft, pack.facts);
      }
    }
    if (draft && check && !check.passed) {
      dropped = check.failures;
      draft = dropFailures(draft, check.failures);
    }
  } finally {
    await logUsage();
  }
  if (!draft || !draft.sections.length) return { ok: false, reason: "model_failed" };

  const { facts, ...rest } = pack;
  const context: BriefContent["context"] = {
    category: rest.category, territory: rest.territory, country: rest.country, status: rest.status, statusRule: rest.statusRule,
    missingInputs: rest.missingInputs, representativenessNote: rest.representativenessNote, isDemo: rest.isDemo,
  };
  const content: BriefContent = {
    sections: draft.sections,
    facts,
    dropped: dropped.map((d) => ({ path: d.path, text: d.text, reason: d.reason })),
    context,
  };
  return storeVersion(admin, categorySlug, territorySlug, content, model, userId, locale);
}

async function storeVersion(admin: ReturnType<typeof createAdminClient>, categorySlug: string, territorySlug: string, content: BriefContent, model: string, userId: string, locale: "it" | "en"): Promise<GenerateResult> {
  const [{ data: cat }, { data: ter }] = await Promise.all([
    admin.from("categories").select("id").eq("slug", categorySlug).single(),
    admin.from("territories").select("id").eq("slug", territorySlug).eq("is_pilot", true).single(),
  ]);
  if (!cat || !ter) return { ok: false, reason: "no_cell" };

  const { data: existing } = await admin.from("briefs").select("id, status").eq("category_id", cat.id).eq("territory_id", ter.id).maybeSingle();
  let briefId = existing?.id;
  if (!briefId) {
    const { data, error } = await admin.from("briefs").insert({ category_id: cat.id, territory_id: ter.id, created_by: userId }).select("id").single();
    if (error) throw new Error(`create brief: ${error.message}`);
    briefId = data.id;
  }
  const { data: last } = await admin.from("brief_versions").select("version").eq("brief_id", briefId).order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;
  const { data: v, error: ve } = await admin
    .from("brief_versions")
    .insert({ brief_id: briefId, version, locale, content, model, prompt_version: BRIEF_PROMPT_VERSION, citation_check_passed: checkDraft(content, content.facts).passed, created_by: userId })
    .select("id")
    .single();
  if (ve) throw new Error(`store brief version: ${ve.message}`);

  const byId = new Map(content.facts.map((f) => [f.id, f]));
  const rows = content.sections.flatMap((s, si) =>
    s.sentences.flatMap((sentence, i) =>
      sentence.facts.flatMap((fid) => {
        const f = byId.get(fid)!;
        const sentence_path = `sections.${si}.sentences.${i}`;
        const refs = f.snapshotRef ? [{ brief_version_id: v.id, sentence_path, observation_id: null, snapshot_ref: f.snapshotRef }] : [];
        return [...refs, ...f.observationIds.map((id) => ({ brief_version_id: v.id, sentence_path, observation_id: id, snapshot_ref: null }))];
      }),
    ),
  );
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("brief_citations").insert(rows.slice(i, i + 500));
    if (error) throw new Error(`store citations: ${error.message}`);
  }
  // A published brief keeps its published version until a reviewer promotes the new one.
  if (existing?.status !== "published") {
    const { error } = await admin.from("briefs").update({ current_version_id: v.id, status: "draft" }).eq("id", briefId);
    if (error) throw new Error(`point brief to new version: ${error.message}`);
  }
  return { ok: true, briefId, versionId: v.id, version, dropped: content.dropped.length };
}
