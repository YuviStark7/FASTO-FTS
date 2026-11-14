import "server-only";
import { requireUser } from "@/lib/auth";
import type { LeverCode } from "@/lib/scoring/fit";
import { PRICE_BANDS, type PriceBand } from "@/lib/passport/input";
import { toPassport, type PassportFit } from "./passport-fit";

export type CategoryOption = { id: number; slug: string; name_it: string; name_en: string; color: string; icon: string };

export type PassportDetail = {
  id: number;
  name: string;
  category: CategoryOption;
  priceBand: PriceBand | null;
  certifications: string[];
  /** Claims the firm ticked (attributes.claims), known lever codes only. */
  claims: LeverCode[];
  format: string | null;
  capacity: string | null;
  story: string | null;
  updatedAt: string;
  /** False for viewers of the owning organisation: RLS would refuse the write. */
  canWrite: boolean;
};

export type PassportScreen = {
  passports: PassportDetail[];
  categories: CategoryOption[];
  /** The user has an organisation where their role may write. */
  canCreate: boolean;
};

const COLUMNS = "id, org_id, name, price_band, certifications, attributes, format, capacity, story, updated_at, categories(id, slug, name_it, name_en, color, icon)";

type Row = {
  id: number;
  org_id: string;
  name: string;
  price_band: string | null;
  certifications: string[];
  attributes: unknown;
  format: string | null;
  capacity: string | null;
  story: string | null;
  updated_at: string;
  categories: CategoryOption;
};

function toDetail(row: Row, writable: Set<string>): PassportDetail {
  const p = toPassport(row);
  return {
    id: row.id,
    name: row.name,
    category: row.categories,
    priceBand: (PRICE_BANDS as readonly string[]).includes(p.priceBand ?? "") ? p.priceBand : null,
    certifications: p.certifications,
    claims: p.claims,
    format: row.format,
    capacity: row.capacity,
    story: row.story,
    updatedAt: row.updated_at,
    canWrite: writable.has(row.org_id),
  };
}

async function context() {
  const { supabase, userId } = await requireUser();
  const [memberships, categories] = await Promise.all([
    supabase.from("memberships").select("org_id, role").eq("user_id", userId),
    supabase.from("categories").select("id, slug, name_it, name_en, color, icon").order("sort_order", { ascending: true }),
  ]);
  const error = memberships.error ?? categories.error;
  if (error) throw new Error(error.message);
  const writable = new Set((memberships.data ?? []).filter((m) => m.role !== "viewer").map((m) => m.org_id));
  return { supabase, writable, categories: (categories.data ?? []) as CategoryOption[] };
}

/** The passports the user can read (RLS: members of the owning organisation), newest change first. */
export async function getPassportScreen(): Promise<PassportScreen> {
  const { supabase, writable, categories } = await context();
  const { data, error } = await supabase.from("product_passports").select(COLUMNS).order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { passports: ((data ?? []) as unknown as Row[]).map((r) => toDetail(r, writable)), categories, canCreate: writable.size > 0 };
}

/** One passport, or null when it does not exist or belongs to another organisation (RLS shows neither). */
export async function getPassportDetail(id: number): Promise<{ passport: PassportDetail; categories: CategoryOption[] } | null> {
  const { supabase, writable, categories } = await context();
  const { data, error } = await supabase.from("product_passports").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { passport: toDetail(data as unknown as Row, writable), categories };
}

export type FitReading = { id: number; periodStart: string; periodEnd: string; mentions: number; methodVersion: string };
export type FitCity = {
  slug: string;
  name_it: string;
  name_en: string;
  countryCode: string;
  /** Null: no published consumer reading for the category in the city's country. Never a zero. */
  fit: { raw: number; pct: number; grade: "C"; isDemo: boolean; reading: FitReading | null } | null;
};
export type FitTable = { levers: LeverCode[]; cities: FitCity[]; methodVersion: string };

/**
 * The Fit of a passport laid out for every pilot city of its category. The figures are the ones
 * `getPassportFit` computed (fit-v1); this only adds the city names and the CSI reading each
 * figure was read from, so a figure can name its source and period.
 */
export async function getFitTable(fit: PassportFit): Promise<FitTable> {
  const { supabase } = await requireUser();
  const readingIds = [...new Set(Object.values(fit.cells).map((c) => c.csiSnapshotId))];
  const [cities, readings] = await Promise.all([
    supabase.from("territories").select("slug, name_it, name_en, country_code, sort_order").eq("is_pilot", true).order("sort_order", { ascending: true }),
    readingIds.length
      ? supabase.from("csi_snapshots").select("id, period_start, period_end, n_mentions, method_version_id").in("id", readingIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const error = cities.error ?? readings.error;
  if (error) throw new Error(error.message);
  const byId = new Map((readings.data ?? []).map((r) => [r.id, r]));
  return {
    levers: fit.levers,
    methodVersion: fit.methodVersion,
    cities: (cities.data ?? []).map((c) => {
      const cell = fit.cells[`${fit.passport.categorySlug}:${c.slug}`];
      const r = cell ? byId.get(cell.csiSnapshotId) : undefined;
      return {
        slug: c.slug,
        name_it: c.name_it,
        name_en: c.name_en,
        countryCode: c.country_code,
        fit: cell
          ? {
              raw: cell.raw,
              pct: cell.pct,
              grade: cell.grade,
              isDemo: cell.isDemo,
              reading: r ? { id: r.id, periodStart: r.period_start, periodEnd: r.period_end, mentions: r.n_mentions, methodVersion: r.method_version_id } : null,
            }
          : null,
      };
    }),
  };
}


