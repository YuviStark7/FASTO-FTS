import { admin } from "./helpers";
import { LEVER_LABELS } from "../lib/ai/levers";
import { fitRaw, passportLevers, type LeverCode, type Passport } from "../lib/scoring/fit";
import { percentileRanks } from "../lib/scoring/mos";

/**
 * Test fixture: a published consumer reading (CSI snapshot with levers) for one category in two
 * countries, so a passport of that category has a Fit in some pilot cities and none in the others.
 * The local database has no real readings; the shares below are made up.
 *
 * Every row is written with `is_demo = true`, like every other fixture, so the Fit read from it
 * is shown under the DEMO badge. The rows are deleted when the worker ends.
 */
export const FIT_CATEGORY: string = "coffee";
const NOTE = "e2e fixture: invented shares, not a consumer reading";

const READINGS: { country: string; levers: [LeverCode, number][] }[] = [
  { country: "it", levers: [["origin_territory", 0.5], ["quality_taste", 0.3], ["price_value", 0.2]] },
  { country: "de", levers: [["sustainability", 0.5], ["quality_taste", 0.3], ["origin_territory", 0.2]] },
];

const must = <T>(what: string, r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error || r.data == null) throw new Error(`passport fixture, ${what}: ${r.error?.message ?? "no data"}`);
  return r.data;
};

export async function categoryOf(slug: string) {
  return must("category", await admin.from("categories").select("id, slug, name_it, name_en").eq("slug", slug).single());
}

/** Inserts the readings and returns their ids for `removeFitReadings`. */
export async function seedFitReadings(): Promise<number[]> {
  const category = await categoryOf(FIT_CATEGORY);
  const countries = must("countries", await admin.from("territories").select("id, slug").eq("level", "country").in("slug", READINGS.map((r) => r.country)));
  const ids: number[] = [];
  for (const reading of READINGS) {
    const territory = countries.find((c) => c.slug === reading.country);
    if (!territory) throw new Error(`passport fixture: no country ${reading.country}`);
    const snap = must(
      `reading ${reading.country}`,
      await admin
        .from("csi_snapshots")
        .insert({
          category_id: category.id,
          territory_id: territory.id,
          period_start: "2026-07-01",
          period_end: "2026-09-30",
          csi: 60,
          n_mentions: 120,
          languages: ["it"],
          representativeness_note: NOTE,
          is_published: true,
          method_version_id: "csi-v1",
          is_demo: true,
        })
        .select("id")
        .single(),
    );
    ids.push(snap.id);
    const { error } = await admin.from("levers").insert(
      reading.levers.map(([code, share]) => ({
        category_id: category.id,
        territory_id: territory.id,
        csi_snapshot_id: snap.id,
        label_it: LEVER_LABELS[code].it,
        label_en: LEVER_LABELS[code].en,
        mention_count: Math.round(share * 120),
        share,
        is_demo: true,
      })),
    );
    if (error) throw new Error(`passport fixture, levers ${reading.country}: ${error.message}`);
  }
  return ids;
}

/** Levers go with their reading (on delete cascade). */
export async function removeFitReadings(ids: number[]) {
  if (ids.length) await admin.from("csi_snapshots").delete().in("id", ids);
}

export type ExpectedFit = { levers: LeverCode[]; cities: { slug: string; fit: { raw: number; pct: number; isDemo: boolean } | null }[] };

/**
 * What fit-v1 should give for a passport, worked out from the database with the pure functions of
 * `lib/scoring`: per pilot city, the latest published reading of the category in its country, a
 * real reading before a demo one. The test never assumes which cities have a reading.
 */
export async function expectedFit(categorySlug: string, passport: Passport): Promise<ExpectedFit> {
  const category = await categoryOf(categorySlug);
  const demo = new Set<number>();
  const territories = must("territories", await admin.from("territories").select("id, slug, level, parent_id, is_pilot, sort_order"));
  const byId = new Map(territories.map((t) => [t.id, t]));
  const countryOf = (id: number) => {
    let cur = byId.get(id);
    while (cur && cur.level !== "country") cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    return cur?.id;
  };
  const snaps = must(
    "readings",
    await admin.from("csi_snapshots").select("id, territory_id, computed_at, is_demo").eq("category_id", category.id).eq("is_published", true).order("is_demo", { ascending: true }).order("computed_at", { ascending: false }),
  );
  const latest = new Map<number, number>();
  for (const s of snaps) {
    if (latest.has(s.territory_id)) continue;
    latest.set(s.territory_id, s.id);
    if (s.is_demo) demo.add(s.id);
  }
  const levers = latest.size ? must("levers", await admin.from("levers").select("csi_snapshot_id, label_en, share").in("csi_snapshot_id", [...latest.values()])) : [];
  const codeOf = new Map(Object.entries(LEVER_LABELS).map(([code, l]) => [l.en, code as LeverCode]));

  const matched = passportLevers(passport);
  const cities = territories.filter((t) => t.is_pilot).sort((a, b) => a.sort_order - b.sort_order);
  const raw = new Map<string, number>();
  const demoCity = new Set<string>();
  for (const c of cities) {
    const country = countryOf(c.id);
    const snapId = country == null ? undefined : latest.get(country);
    if (snapId == null) continue;
    const list = levers.filter((l) => l.csi_snapshot_id === snapId && l.share != null && codeOf.has(l.label_en)).map((l) => ({ code: codeOf.get(l.label_en)!, share: Number(l.share) }));
    const r = fitRaw(matched, list);
    if (r != null) raw.set(c.slug, r);
    if (r != null && demo.has(snapId)) demoCity.add(c.slug);
  }
  const pct = percentileRanks(raw);
  return { levers: [...matched], cities: cities.map((c) => ({ slug: c.slug, fit: raw.has(c.slug) ? { raw: raw.get(c.slug)!, pct: pct.get(c.slug)!, isDemo: demoCity.has(c.slug) } : null })) };
}

/** A passport written straight into an organisation, for the flows that do not test the form. */
export async function insertPassport(userId: string, name: string, claims: LeverCode[], certifications: string[] = [], categorySlug = FIT_CATEGORY) {
  const category = await categoryOf(categorySlug);
  const mem = must("membership", await admin.from("memberships").select("org_id").eq("user_id", userId).limit(1).single());
  const row = must(
    "passport",
    await admin.from("product_passports").insert({ org_id: mem.org_id, name, category_id: category.id, price_band: "premium", certifications, attributes: { claims } }).select("id").single(),
  );
  return { id: row.id, orgId: mem.org_id };
}

export async function removePassports(ids: number[]) {
  if (ids.length) await admin.from("product_passports").delete().in("id", ids);
}
