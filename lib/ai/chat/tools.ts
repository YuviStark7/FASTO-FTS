import "server-only";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { formatValue } from "@/components/sheet/format";
import { buildFactPack } from "../brief/facts";
import type { Fact } from "../brief/types";

/**
 * Typed tools for the Ask screen (SPEC section 4). The chat never writes SQL: each tool reads
 * stored figures through the user's own client (RLS) and returns them as facts with ids, so the
 * post-check can verify every number in the answer. Tools never compute new figures.
 */

export const SLUG = z.string().regex(/^[a-z0-9-]{1,60}$/);
export const ToolInputs = {
  get_cell: z.object({ category: SLUG, territory: SLUG }),
  rank_opportunities: z.object({ category: SLUG.nullable(), country: SLUG.nullable(), limit: z.number().int().min(1).max(10) }),
  compare_territories: z.object({ category: SLUG, territories: z.array(SLUG).min(2).max(5) }),
  get_levers: z.object({ category: SLUG, country: SLUG }),
  get_sources: z.object({ category: SLUG, territory: SLUG }),
};
export type ToolName = keyof typeof ToolInputs;

/** Facts handed to the model in one turn, renumbered T1, T2, ... across tool calls. */
export class FactRegistry {
  readonly facts: Fact[] = [];
  add(f: Omit<Fact, "id">): Fact {
    const fact = { ...f, id: `T${this.facts.length + 1}` };
    this.facts.push(fact);
    return fact;
  }
}

type ToolResult = Record<string, unknown>;

export async function runTool(name: ToolName, rawInput: unknown, locale: "it" | "en", reg: FactRegistry): Promise<ToolResult> {
  const parsed = ToolInputs[name].safeParse(rawInput);
  if (!parsed.success) return { error: "invalid input", details: parsed.error.issues.map((i) => i.message) };
  const input = parsed.data as never;
  switch (name) {
    case "get_cell":
      return getCell(input, locale, reg);
    case "rank_opportunities":
      return rankOpportunities(input, locale, reg);
    case "compare_territories":
      return compareTerritories(input, locale, reg);
    case "get_levers":
      return getLevers(input, locale, reg);
    case "get_sources":
      return getSources(input, locale);
  }
}

const brief = (f: Fact) => ({ id: f.id, label: f.label, value: f.display, grade: f.grade, period: f.period, source: f.source });

async function getCell(input: { category: string; territory: string }, locale: "it" | "en", reg: FactRegistry) {
  const pack = await buildFactPack(input.category, input.territory, locale);
  if (!pack) return { error: "no such cell", hint: "use the category and pilot city slugs from the system prompt" };
  const facts = pack.facts.map((f) => reg.add({ ...f, id: undefined } as Omit<Fact, "id">));
  return {
    category: pack.category,
    territory: pack.territory,
    country: pack.country,
    status: pack.status,
    status_rule: pack.statusRule,
    missing_inputs: pack.missingInputs,
    representativeness_note: pack.representativenessNote,
    is_demo: pack.isDemo,
    facts: facts.map(brief),
  };
}

type MosRow = { category_id: number; territory_id: number; mos: number | null; mos_grade: "B" | "C" | null; mos_is_partial: boolean | null; mos_snapshot_id: number | null; is_demo: boolean };

async function loadTaxonomy() {
  const { supabase } = await requireUser();
  const [{ data: cats }, { data: ters }] = await Promise.all([
    supabase.from("categories").select("id, slug, name_it, name_en"),
    supabase.from("territories").select("id, slug, name_it, name_en, level, parent_id, is_pilot"),
  ]);
  const byId = new Map((ters ?? []).map((t) => [t.id, t]));
  const countryOf = (id: number) => {
    let cur = byId.get(id);
    while (cur && cur.level !== "country") cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    return cur;
  };
  return { supabase, cats: cats ?? [], ters: ters ?? [], countryOf };
}

async function rankOpportunities(input: { category: string | null; country: string | null; limit: number }, locale: "it" | "en", reg: FactRegistry) {
  const { supabase, cats, ters, countryOf } = await loadTaxonomy();
  const cat = input.category ? cats.find((c) => c.slug === input.category) : null;
  if (input.category && !cat) return { error: "unknown category" };
  let q = supabase.from("cells").select("category_id, territory_id, mos, mos_grade, mos_is_partial, mos_snapshot_id, is_demo").not("mos", "is", null);
  if (cat) q = q.eq("category_id", cat.id);
  const { data } = await q.order("mos", { ascending: false }).limit(300);
  const rows = ((data ?? []) as MosRow[]).filter((r) => !input.country || countryOf(r.territory_id)?.slug === input.country).slice(0, input.limit);
  const name = (x: { name_it: string; name_en: string } | undefined) => (x ? (locale === "it" ? x.name_it : x.name_en) : "?");
  const { data: snaps } = await supabase.from("mos_snapshots").select("id, rank, coverage_pct, computed_at").in("id", rows.map((r) => r.mos_snapshot_id!).filter(Boolean));
  const snap = new Map((snaps ?? []).map((s) => [s.id, s]));
  return {
    note: locale === "it" ? "Il MOS è relativo alle altre celle; un punteggio parziale manca di alcuni componenti." : "MOS is relative to the other cells; a partial score lacks some components.",
    results: rows.map((r) => {
      const s = r.mos_snapshot_id ? snap.get(r.mos_snapshot_id) : undefined;
      const c = cats.find((x) => x.id === r.category_id);
      const t = ters.find((x) => x.id === r.territory_id);
      const f = reg.add({
        section: "entry",
        label: `MOS ${name(c)} · ${name(t)}${s?.rank != null ? ` (${locale === "it" ? "posizione" : "rank"} ${s.rank})` : ""}`,
        display: formatValue(Number(r.mos), "index_0_100", locale),
        grade: r.mos_grade,
        period: s?.computed_at?.slice(0, 10) ?? "",
        method: "mos-v1",
        source: "mos-v1",
        observationIds: [],
        snapshotRef: r.mos_snapshot_id ? `mos_snapshots:${r.mos_snapshot_id}` : null,
      });
      return { category: c?.slug, territory: t?.slug, partial: r.mos_is_partial, coverage_pct: s?.coverage_pct ?? null, is_demo: r.is_demo, fact: brief(f) };
    }),
  };
}

async function compareTerritories(input: { category: string; territories: string[] }, locale: "it" | "en", reg: FactRegistry) {
  const out = [];
  for (const territory of input.territories) out.push({ territory, ...(await getCell({ category: input.category, territory }, locale, reg)) });
  return { cells: out };
}

async function getLevers(input: { category: string; country: string }, locale: "it" | "en", reg: FactRegistry) {
  const { supabase, cats, ters } = await loadTaxonomy();
  const cat = cats.find((c) => c.slug === input.category);
  const country = ters.find((t) => t.slug === input.country && t.level === "country");
  if (!cat || !country) return { error: "unknown category or country" };
  const { data: csi } = await supabase
    .from("csi_snapshots")
    .select("id, is_published, n_mentions, period_start, period_end, representativeness_note")
    .eq("category_id", cat.id)
    .eq("territory_id", country.id)
    .eq("is_demo", false)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!csi?.is_published) return { published: false, note: locale === "it" ? "Nessuna lettura pubblicata: meno di 50 menzioni pertinenti." : "No published reading: fewer than 50 relevant mentions." };
  const [{ data: levers }, { data: barriers }] = await Promise.all([
    supabase.from("levers").select("label_it, label_en, share, mention_count").eq("csi_snapshot_id", csi.id).order("share", { ascending: false }).limit(5),
    supabase.from("barriers").select("label_it, label_en, share, mention_count").eq("csi_snapshot_id", csi.id).order("share", { ascending: false }).limit(5),
  ]);
  const period = `${csi.period_start} – ${csi.period_end}`;
  const mk = (kind: string, l: { label_it: string; label_en: string; share: number | null }) =>
    brief(
      reg.add({
        section: "consumers",
        label: `${kind}: ${locale === "it" ? l.label_it : l.label_en} (${locale === "it" ? "quota delle menzioni" : "share of mentions"})`,
        display: formatValue(Number(l.share ?? 0), "share", locale),
        grade: "C",
        period,
        method: "csi-v1",
        source: "Bluesky",
        observationIds: [],
        snapshotRef: `csi_snapshots:${csi.id}`,
      }),
    );
  return {
    published: true,
    representativeness_note: csi.representativeness_note,
    mentions: brief(reg.add({ section: "consumers", label: locale === "it" ? "Menzioni analizzate" : "Mentions analysed", display: formatValue(csi.n_mentions, "count", locale), grade: "C", period, method: "csi-v1", source: "Bluesky", observationIds: [], snapshotRef: `csi_snapshots:${csi.id}` })),
    levers: (levers ?? []).filter((l) => l.share != null).map((l) => mk(locale === "it" ? "Leva" : "Lever", l)),
    barriers: (barriers ?? []).filter((l) => l.share != null).map((l) => mk(locale === "it" ? "Barriera" : "Barrier", l)),
  };
}

async function getSources(input: { category: string; territory: string }, locale: "it" | "en") {
  const { supabase } = await requireUser();
  const pack = await buildFactPack(input.category, input.territory, locale);
  if (!pack) return { error: "no such cell" };
  const { data: sources } = await supabase.from("sources").select("slug, name, url, licence, default_grade, is_active").eq("is_active", true);
  const used = new Set(pack.facts.map((f) => f.source));
  return {
    methods: [...new Set(pack.facts.map((f) => f.method))],
    sources_in_cell: [...used],
    active_sources: (sources ?? []).map((s) => ({ slug: s.slug, name: s.name, url: s.url, licence: s.licence, default_grade: s.default_grade })),
  };
}
