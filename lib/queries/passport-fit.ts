import "server-only";
import { requireUser } from "@/lib/auth";
import { LEVER_LABELS } from "@/lib/ai/levers";
import { fitRaw, LEVER_CODES, passportLevers, type LeverCode, type Passport } from "@/lib/scoring/fit";
import { percentileRanks } from "@/lib/scoring/mos";

export type PassportSummary = { id: number; name: string; categorySlug: string };

/** Fit for one passport, per pilot city of its category, keyed like opportunity rows ("cat:city"). */
export type PassportFit = {
  passport: PassportSummary;
  levers: LeverCode[];
  cells: Record<string, { raw: number; pct: number; grade: "C"; csiSnapshotId: number }>;
};

const CODE_BY_LABEL = new Map<string, LeverCode>(Object.entries(LEVER_LABELS).map(([code, l]) => [l.en, code as LeverCode]));

export function toPassport(row: { price_band: string | null; certifications: string[]; attributes: unknown }): Passport {
  const attrs = (row.attributes && typeof row.attributes === "object" ? row.attributes : {}) as { claims?: unknown };
  const claims = Array.isArray(attrs.claims) ? attrs.claims.filter((c): c is LeverCode => (LEVER_CODES as readonly string[]).includes(c as string)) : [];
  const band = row.price_band;
  return {
    priceBand: band === "entry" || band === "mid" || band === "premium" || band === "luxury" ? band : null,
    certifications: row.certifications ?? [],
    claims,
  };
}

/** The organisation's passports (RLS: members of the owning organisation only). */
export async function listPassports(): Promise<PassportSummary[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("product_passports").select("id, name, categories(slug)").order("updated_at", { ascending: false });
  return (data ?? []).map((p) => ({ id: p.id, name: p.name, categorySlug: (p.categories as unknown as { slug: string }).slug }));
}

/**
 * fit-v1 for a passport: share of the lever citations (latest published CSI of the category in each
 * city's country) the passport answers, then percentile rank among the passport's cells.
 * Cities whose country has no published reading get no Fit (never zero).
 */
export async function getPassportFit(passportId: number): Promise<PassportFit | null> {
  const { supabase } = await requireUser();
  const { data: p } = await supabase
    .from("product_passports")
    .select("id, name, category_id, price_band, certifications, attributes, categories(slug)")
    .eq("id", passportId)
    .maybeSingle();
  if (!p) return null;
  const categorySlug = (p.categories as unknown as { slug: string }).slug;
  const matched = passportLevers(toPassport(p));

  const { data: ters } = await supabase.from("territories").select("id, slug, level, parent_id, is_pilot");
  const byId = new Map((ters ?? []).map((t) => [t.id, t]));
  const countryOf = (id: number) => {
    let cur = byId.get(id);
    while (cur && cur.level !== "country") cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    return cur;
  };
  const cities = (ters ?? []).filter((t) => t.is_pilot);
  const countryIds = [...new Set(cities.map((c) => countryOf(c.id)?.id).filter((x): x is number => x != null))];

  const { data: csis } = await supabase
    .from("csi_snapshots")
    .select("id, territory_id, computed_at")
    .eq("category_id", p.category_id)
    .in("territory_id", countryIds)
    .eq("is_published", true)
    .eq("is_demo", false)
    .order("computed_at", { ascending: false });
  const latest = new Map<number, number>();
  for (const c of csis ?? []) if (!latest.has(c.territory_id)) latest.set(c.territory_id, c.id);

  const { data: levers } = latest.size
    ? await supabase.from("levers").select("csi_snapshot_id, label_en, share").in("csi_snapshot_id", [...latest.values()])
    : { data: [] };
  const rawByCountry = new Map<number, number>();
  for (const [countryId, snapId] of latest) {
    const list = (levers ?? [])
      .filter((l) => l.csi_snapshot_id === snapId && l.share != null && CODE_BY_LABEL.has(l.label_en))
      .map((l) => ({ code: CODE_BY_LABEL.get(l.label_en)!, share: Number(l.share) }));
    const r = fitRaw(matched, list);
    if (r != null) rawByCountry.set(countryId, r);
  }

  const raw = new Map<string, number>();
  for (const c of cities) {
    const country = countryOf(c.id);
    const r = country ? rawByCountry.get(country.id) : undefined;
    if (r != null) raw.set(`${categorySlug}:${c.slug}`, r);
  }
  const pct = percentileRanks(raw);
  const cells: PassportFit["cells"] = {};
  for (const c of cities) {
    const key = `${categorySlug}:${c.slug}`;
    const country = countryOf(c.id);
    if (raw.has(key) && country) cells[key] = { raw: raw.get(key)!, pct: pct.get(key)!, grade: "C", csiSnapshotId: latest.get(country.id)! };
  }
  return { passport: { id: p.id, name: p.name, categorySlug }, levers: [...matched], cells };
}
