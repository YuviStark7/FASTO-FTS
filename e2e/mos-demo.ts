import { admin } from "./helpers";
import { percentileRanks, rankByMos, scoreMos, type CellComponents, type Weights } from "../lib/scoring/mos";

/**
 * Test fixture: MOS snapshots for a few cells of the local database, which has no observations.
 * Every row is written with `is_demo = true`, so the app shows it under the DEMO badge. The inputs
 * below are made up; the percentiles, scores, grades and ranks come from `lib/scoring/mos.ts`
 * exactly as the compute step derives them. Only cells that have no snapshot yet are touched.
 */
type Raw = { category: string; territory: string; growth: number | null; size: number | null; csi: number | null; competitors: number | null; barriers: number | null };

const DEMO: Raw[] = [
  { category: "coffee", territory: "roma", growth: 0.012, size: 9_000_000, csi: 61, competitors: 40, barriers: 0.2 },
  { category: "coffee", territory: "milano", growth: 0.012, size: 7_500_000, csi: 61, competitors: 40, barriers: 0.2 },
  { category: "coffee", territory: "paris", growth: 0.034, size: 4_100_000, csi: null, competitors: 55, barriers: null },
  { category: "coffee", territory: "berlin", growth: 0.051, size: 2_200_000, csi: 70, competitors: 25, barriers: 0.12 },
  { category: "chocolate", territory: "roma", growth: -0.004, size: 6_000_000, csi: 58, competitors: 70, barriers: 0.31 },
  { category: "chocolate", territory: "milano", growth: -0.004, size: 6_800_000, csi: 58, competitors: 70, barriers: 0.31 },
  { category: "chocolate", territory: "paris", growth: 0.021, size: 8_200_000, csi: 66, competitors: 90, barriers: 0.26 },
  { category: "chocolate", territory: "berlin", growth: 0.027, size: 3_000_000, csi: null, competitors: null, barriers: null },
  // No growth: the snapshot exists but has no MOS (insufficient data, never zero).
  { category: "chocolate", territory: "wien", growth: null, size: 1_100_000, csi: null, competitors: null, barriers: null },
];

export async function seedDemoMos() {
  const fail = (what: string, e: { message: string } | null) => {
    if (e) throw new Error(`demo MOS ${what}: ${e.message}`);
  };
  const [cats, ters, ws] = await Promise.all([
    admin.from("categories").select("id, slug").in("slug", [...new Set(DEMO.map((d) => d.category))]),
    admin.from("territories").select("id, slug").in("slug", [...new Set(DEMO.map((d) => d.territory))]),
    admin.from("weight_sets").select("id, weights").is("org_id", null).eq("is_default", true).single(),
  ]);
  fail("categories", cats.error);
  fail("territories", ters.error);
  fail("default weights", ws.error);
  const cat = new Map((cats.data ?? []).map((c) => [c.slug, c.id]));
  const ter = new Map((ters.data ?? []).map((t) => [t.slug, t.id]));

  const { data: cells, error } = await admin.from("cells").select("category_id, territory_id, mos_snapshot_id").in("category_id", [...cat.values()]).in("territory_id", [...ter.values()]);
  fail("cells", error);
  const taken = new Set((cells ?? []).filter((c) => c.mos_snapshot_id != null).map((c) => `${c.category_id}|${c.territory_id}`));
  const todo = DEMO.filter((d) => cat.has(d.category) && ter.has(d.territory) && !taken.has(`${cat.get(d.category)}|${ter.get(d.territory)}`));
  if (!todo.length) return;

  const key = (d: Raw) => `${d.category}:${d.territory}`;
  const pick = (f: (d: Raw) => number | null) => new Map(todo.flatMap((d) => (f(d) == null ? [] : [[key(d), f(d)!] as const])));
  const raw = { growth: pick((d) => d.growth), size: pick((d) => d.size), csi: pick((d) => d.csi), competitors: pick((d) => d.competitors), barriers: pick((d) => d.barriers) };
  const pct = {
    growth: percentileRanks(raw.growth),
    size: percentileRanks(raw.size),
    csi: percentileRanks(raw.csi),
    competitors: percentileRanks(raw.competitors),
    barriers: percentileRanks(raw.barriers),
  };
  const weights = ws.data!.weights as Weights;
  const results = todo.map((d) => {
    const k = key(d);
    const c: CellComponents = {};
    if (pct.growth.has(k)) c.growth = { pct: pct.growth.get(k)!, grade: "B" };
    if (pct.size.has(k)) c.size = { pct: pct.size.get(k)!, grade: "B" };
    if (pct.csi.has(k)) c.csi = { pct: pct.csi.get(k)!, grade: "C" };
    const parts = [pct.competitors.get(k), pct.barriers.get(k)].filter((x): x is number => x != null);
    if (parts.length) c.pressure = { pct: Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10, grade: "C" };
    return { d, k, c, r: scoreMos(c, weights) };
  });
  const ranks = rankByMos(new Map(results.map((x) => [x.k, x.r.mos])));

  for (const { d, k, c, r } of results) {
    const one = (name: "growth" | "size" | "csi") => ({
      present: !!c[name],
      pct: c[name]?.pct ?? null,
      raw: raw[name].get(k) ?? null,
      grade: c[name]?.grade ?? null,
      contribution: r.contributions[name] ?? null,
    });
    const { data: snap, error: se } = await admin
      .from("mos_snapshots")
      .insert({
        category_id: cat.get(d.category)!,
        territory_id: ter.get(d.territory)!,
        weight_set_id: ws.data!.id,
        mos: r.mos,
        grade: r.grade,
        components: {
          growth: one("growth"),
          size: one("size"),
          csi: one("csi"),
          pressure: {
            present: !!c.pressure,
            pct: c.pressure?.pct ?? null,
            grade: c.pressure?.grade ?? null,
            contribution: r.contributions.pressure ?? null,
            competitors: { raw: raw.competitors.get(k) ?? null, pct: pct.competitors.get(k) ?? null },
            barriers_per_mention: { raw: raw.barriers.get(k) ?? null, pct: pct.barriers.get(k) ?? null },
          },
          fit: { present: false, pct: null, grade: null, contribution: null },
        },
        coverage_pct: r.coveragePct,
        is_partial: r.isPartial,
        rank: ranks.get(k) ?? null,
        input_snapshot_ids: { trend_snapshot_id: null, geo_estimate_id: null, csi_snapshot_id: null },
        method_version_id: "mos-v1",
        is_demo: true,
      })
      .select("id")
      .single();
    fail(`snapshot ${k}`, se);
    const { error: ce } = await admin
      .from("cells")
      .update({ is_demo: true, mos_snapshot_id: snap!.id, mos: r.mos, mos_is_partial: r.mos == null ? null : r.isPartial, mos_grade: r.grade })
      .eq("category_id", cat.get(d.category)!)
      .eq("territory_id", ter.get(d.territory)!)
      .is("mos_snapshot_id", null);
    fail(`cell ${k}`, ce);
  }
}
