import "server-only";
import { requireUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { DEFAULT_WEIGHTS, validWeights, type Weights } from "@/lib/scoring/mos";
import { parseMosComponents, parseWeights, type Grade, type MosComponents } from "./mos-shape";

type Tables = Database["public"]["Tables"];

export type OpportunityRow = {
  key: string;
  category: Pick<Tables["categories"]["Row"], "id" | "slug" | "name_it" | "name_en" | "color" | "icon">;
  territory: Pick<Tables["territories"]["Row"], "id" | "slug" | "name_it" | "name_en" | "country_code">;
  snapshotId: number;
  computedAt: string;
  methodVersion: string;
  isDemo: boolean;
  /** The stored score under the system default weights. Null MOS means insufficient data, never zero. */
  stored: { mos: number | null; grade: Grade | null; isPartial: boolean; coveragePct: number; rank: number | null };
  components: MosComponents;
};

export type WeightSet = { id: number; name: string; weights: Weights };

export type OpportunitiesData = {
  rows: OpportunityRow[];
  /** System default weight set (SPEC section 5): what the stored scores were computed with. */
  defaultWeights: Weights;
  /** Sets saved by the user's organisation. */
  weightSets: WeightSet[];
  /** False for viewers: RLS would refuse the insert. */
  canSave: boolean;
};

type Embedded = {
  is_demo: boolean;
  categories: OpportunityRow["category"] & { sort_order: number };
  territories: OpportunityRow["territory"] & { sort_order: number };
  mos_snapshots: Pick<
    Tables["mos_snapshots"]["Row"],
    "id" | "mos" | "grade" | "is_partial" | "coverage_pct" | "rank" | "components" | "computed_at" | "method_version_id" | "is_demo"
  > | null;
};

/**
 * Every cell with a MOS snapshot, with the snapshot its cell points to (the latest one).
 * Read through RLS. Nothing is computed: the screen re-ranks what-if weights in the browser
 * with `scoreMos` on the percentiles loaded here.
 */
export async function getOpportunities(): Promise<OpportunitiesData> {
  const { supabase, userId } = await requireUser();
  const [cells, sets, memberships] = await Promise.all([
    supabase
      .from("cells")
      .select(
        "is_demo, categories(id, slug, name_it, name_en, color, icon, sort_order), territories(id, slug, name_it, name_en, country_code, sort_order), mos_snapshots(id, mos, grade, is_partial, coverage_pct, rank, components, computed_at, method_version_id, is_demo)",
      )
      .not("mos_snapshot_id", "is", null),
    supabase.from("weight_sets").select("id, org_id, name, weights, is_default").order("created_at", { ascending: true }),
    supabase.from("memberships").select("role").eq("user_id", userId),
  ]);
  const error = cells.error ?? sets.error ?? memberships.error;
  if (error) throw new Error(error.message);

  const rows = ((cells.data ?? []) as unknown as Embedded[])
    .filter((c): c is Embedded & { mos_snapshots: NonNullable<Embedded["mos_snapshots"]> } => c.mos_snapshots != null)
    .sort((a, b) => a.categories.sort_order - b.categories.sort_order || a.territories.sort_order - b.territories.sort_order)
    .map(({ is_demo, categories: c, territories: t, mos_snapshots: s }): OpportunityRow => ({
      key: `${c.slug}:${t.slug}`,
      category: { id: c.id, slug: c.slug, name_it: c.name_it, name_en: c.name_en, color: c.color, icon: c.icon },
      territory: { id: t.id, slug: t.slug, name_it: t.name_it, name_en: t.name_en, country_code: t.country_code },
      snapshotId: s.id,
      computedAt: s.computed_at,
      methodVersion: s.method_version_id,
      isDemo: is_demo || s.is_demo,
      stored: { mos: s.mos == null ? null : Number(s.mos), grade: s.grade, isPartial: s.is_partial, coveragePct: Number(s.coverage_pct), rank: s.rank },
      components: parseMosComponents(s.components),
    }));

  const parsed = (sets.data ?? []).flatMap((s) => {
    const weights = parseWeights(s.weights);
    return weights && validWeights(weights) ? [{ id: s.id, name: s.name, weights, isSystem: s.org_id == null, isDefault: s.is_default }] : [];
  });
  return {
    rows,
    defaultWeights: parsed.find((s) => s.isSystem && s.isDefault)?.weights ?? DEFAULT_WEIGHTS,
    weightSets: parsed.filter((s) => !s.isSystem).map(({ id, name, weights }) => ({ id, name, weights })),
    canSave: (memberships.data ?? []).some((m) => m.role !== "viewer"),
  };
}
