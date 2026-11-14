import "server-only";
import type { BriefContent } from "@/lib/ai/brief/types";
import { danglingCitations, parseBriefContent } from "@/lib/advisor/content";
import { requireUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

export type BriefStatus = Database["public"]["Enums"]["brief_status"];
export type ViewerRole = "admin" | "analyst" | "member" | "viewer";

type Named = { slug: string; name_it: string; name_en: string };
const nameOf = (x: Named | null | undefined, locale: string) => (x ? (locale === "en" ? x.name_en : x.name_it) : "");

export type BriefListItem = {
  id: number;
  status: BriefStatus;
  category: string;
  territory: string;
  version: number | null;
  versionLocale: string | null;
  date: string;
  isDemo: boolean;
};

/** Highest role and the first organisation the user may write to (exports are org-scoped). */
export async function getViewer() {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase.from("memberships").select("org_id, role, created_at").eq("user_id", userId).order("created_at", { ascending: true });
  const rows = data ?? [];
  const has = (r: ViewerRole) => rows.some((m) => m.role === r);
  const role: ViewerRole = has("admin") ? "admin" : has("analyst") ? "analyst" : has("member") ? "member" : "viewer";
  return { supabase, userId, role, isStaff: role === "admin" || role === "analyst", writeOrgId: rows.find((m) => m.role !== "viewer")?.org_id ?? null };
}

/** Briefs the user can see. RLS does the filtering: published for everyone, the rest for staff. */
export async function listBriefs(locale: string): Promise<BriefListItem[]> {
  const { supabase } = await requireUser();
  const { data: briefs, error } = await supabase
    .from("briefs")
    .select("id, status, current_version_id, created_at, category:categories(slug, name_it, name_en), territory:territories(slug, name_it, name_en)")
    .order("id", { ascending: false });
  if (error) throw error;
  const ids = (briefs ?? []).map((b) => b.current_version_id).filter((x): x is number => x != null);
  const { data: versions, error: ve } = ids.length
    ? await supabase.from("brief_versions").select("id, version, locale, created_at, is_demo:content->context->isDemo").in("id", ids)
    : { data: [], error: null };
  if (ve) throw ve;
  const byId = new Map((versions ?? []).map((v) => [v.id, v]));
  return (briefs ?? [])
    .map((b) => {
      const v = b.current_version_id != null ? byId.get(b.current_version_id) : undefined;
      return {
        id: b.id,
        status: b.status,
        category: nameOf(b.category, locale),
        territory: nameOf(b.territory, locale),
        version: v?.version ?? null,
        versionLocale: v?.locale ?? null,
        date: v?.created_at ?? b.created_at,
        isDemo: v?.is_demo === true,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export type BriefVersionMeta = {
  id: number;
  version: number;
  locale: string;
  createdAt: string;
  citationCheckPassed: boolean;
  model: string;
  promptVersion: string;
};

export type BriefDetail = {
  id: number;
  status: BriefStatus;
  currentVersionId: number | null;
  publishedAt: string | null;
  category: Named;
  territory: Named;
  /** Newest first. Readers who are not staff get the current version only. */
  versions: BriefVersionMeta[];
  selected: (BriefVersionMeta & { content: BriefContent | null }) | null;
};

/**
 * One brief with the version to show: `versionId` for staff browsing history, else the current one.
 * Non-staff are always given the current version, whatever the URL says: a newer draft of a
 * published brief has not been reviewed.
 */
export async function getBriefDetail(id: number, versionId: number | null, isStaff: boolean): Promise<BriefDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const { supabase } = await requireUser();
  const { data: b, error } = await supabase
    .from("briefs")
    .select("id, status, current_version_id, published_at, category:categories(slug, name_it, name_en), territory:territories(slug, name_it, name_en)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!b || !b.category || !b.territory) return null;

  let q = supabase.from("brief_versions").select("id, version, locale, created_at, citation_check_passed, model, prompt_version").eq("brief_id", id).order("version", { ascending: false }).order("id", { ascending: false });
  if (!isStaff) q = q.eq("id", b.current_version_id ?? -1);
  const { data: vs, error: ve } = await q;
  if (ve) throw ve;
  const versions: BriefVersionMeta[] = (vs ?? []).map((v) => ({
    id: v.id,
    version: v.version,
    locale: v.locale,
    createdAt: v.created_at,
    citationCheckPassed: v.citation_check_passed,
    model: v.model,
    promptVersion: v.prompt_version,
  }));

  const wanted = (isStaff && versionId != null ? versions.find((v) => v.id === versionId) : undefined) ?? versions.find((v) => v.id === b.current_version_id) ?? null;
  let selected: BriefDetail["selected"] = null;
  if (wanted) {
    const { data: row, error: ce } = await supabase.from("brief_versions").select("content").eq("id", wanted.id).maybeSingle();
    if (ce) throw ce;
    selected = { ...wanted, content: row ? parseBriefContent(row.content) : null };
  }
  return { id: b.id, status: b.status, currentVersionId: b.current_version_id, publishedAt: b.published_at, category: b.category, territory: b.territory, versions, selected };
}

export type ExportRefusal = "not_found" | "viewer" | "check_failed" | "unreadable";
export type Exportable = { ok: true; detail: BriefDetail; version: BriefVersionMeta; content: BriefContent; orgId: string; userId: string } | { ok: false; reason: ExportRefusal };

/**
 * Gate shared by the print page and the Word route: only a version the user can read (RLS), only
 * for roles that may export (not viewers), and never a version that failed the citation check.
 */
export async function getExportable(id: number, versionId: number | null): Promise<Exportable> {
  const viewer = await getViewer();
  const detail = await getBriefDetail(id, versionId, viewer.isStaff);
  if (!detail?.selected) return { ok: false, reason: "not_found" };
  if (!viewer.writeOrgId) return { ok: false, reason: "viewer" };
  const { content, ...version } = detail.selected;
  if (!version.citationCheckPassed) return { ok: false, reason: "check_failed" };
  if (!content) return { ok: false, reason: "unreadable" };
  // Belt and braces: a marker with no fact behind it would be an uncited figure on paper.
  if (danglingCitations(content.sections.flatMap((s) => s.sentences), content.facts).length) return { ok: false, reason: "check_failed" };
  return { ok: true, detail, version, content, orgId: viewer.writeOrgId, userId: viewer.userId };
}

/** One `exports` row per export, written with the user's own client (RLS: org members, not viewers). */
export async function recordExport(x: Extract<Exportable, { ok: true }>, format: "pdf" | "docx"): Promise<boolean> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("exports").insert({ org_id: x.orgId, user_id: x.userId, brief_version_id: x.version.id, format });
  return !error;
}
