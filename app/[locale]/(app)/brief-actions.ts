"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { generateBrief, type GenerateResult } from "@/lib/ai/brief/generate";

const SLUG = /^[a-z0-9-]{1,60}$/;
const STATUSES = ["draft", "reviewed", "published"] as const;
export type BriefStatus = (typeof STATUSES)[number];

/** Generates a new version of the cell's brief. Role, caps and kill switch are checked inside. */
export async function generateBriefAction(categorySlug: string, territorySlug: string, locale: "it" | "en"): Promise<GenerateResult> {
  if (!SLUG.test(categorySlug) || !SLUG.test(territorySlug) || (locale !== "it" && locale !== "en")) return { ok: false, reason: "no_cell" };
  const r = await generateBrief(categorySlug, territorySlug, locale);
  if (r.ok) {
    revalidatePath(`/[locale]/cell/${categorySlug}/${territorySlug}`, "page");
    revalidatePath("/[locale]/briefs", "page");
  }
  return r;
}

/**
 * Review workflow with the user's own client: RLS lets analysts move draft <-> reviewed, and the
 * status trigger lets only admins publish or unpublish, and only a version that passed the
 * citation check. Optionally points the brief at another of its versions first.
 */
export async function setBriefStatus(briefId: number, status: BriefStatus, versionId?: number): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(briefId) || !STATUSES.includes(status) || (versionId != null && !Number.isInteger(versionId))) return { ok: false };
  const { supabase } = await requireUser();
  if (versionId != null) {
    const { data: v } = await supabase.from("brief_versions").select("id").eq("id", versionId).eq("brief_id", briefId).maybeSingle();
    if (!v) return { ok: false, error: "version_not_found" };
  }
  const patch: { status: BriefStatus; current_version_id?: number } = { status };
  if (versionId != null) patch.current_version_id = versionId;
  const { data, error } = await supabase.from("briefs").update(patch).eq("id", briefId).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "not_allowed" };
  revalidatePath("/[locale]/briefs", "page");
  revalidatePath(`/[locale]/briefs/${briefId}`, "page");
  return { ok: true };
}
