import { LEVER_CODES, type LeverCode } from "@/lib/scoring/fit";

/**
 * Product passport form: the fixed vocabularies and the validation shared by the form and the
 * server action. Client-safe and pure; the database repeats the hard limits (name, price band, story).
 */
export const PRICE_BANDS = ["entry", "mid", "premium", "luxury"] as const;
export type PriceBand = (typeof PRICE_BANDS)[number];

/** Certifications offered as checkboxes. fit-v1 reads them: DOP, IGP, STG imply origin; BIO implies organic. */
export const FIXED_CERTIFICATIONS = ["DOP", "IGP", "STG", "BIO"] as const;

export const LIMITS = { name: 120, story: 2000, otherCertifications: 5, certificationLength: 20, shortText: 120 } as const;

export type PassportInput = {
  name: string;
  categoryId: number;
  priceBand: PriceBand | null;
  certifications: string[];
  claims: LeverCode[];
  format: string | null;
  capacity: string | null;
  story: string | null;
};

export type PassportField = "name" | "category" | "priceBand" | "certifications" | "claims" | "format" | "capacity" | "story";
export type ParseResult = { ok: true; value: PassportInput } | { ok: false; field: PassportField };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : null);
const isFixed = (c: string) => (FIXED_CERTIFICATIONS as readonly string[]).includes(c.toUpperCase());
// Control characters and angle brackets have no place in a certification name.
const UNSAFE = /[\p{Cc}<>]/u;

/** Free-text certifications as typed in one field: separated by commas, semicolons or new lines. */
export const splitCertifications = (s: string) =>
  s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** The stored list split back into the checkboxes and the free-text field. */
export function splitStoredCertifications(list: string[]) {
  return {
    fixed: FIXED_CERTIFICATIONS.filter((f) => list.some((c) => c.trim().toUpperCase() === f)),
    other: list.filter((c) => !isFixed(c.trim())),
  };
}

/**
 * Validates what the form sent. Nothing is repaired silently except whitespace, duplicate
 * certifications and the case of the four fixed ones: anything else out of bounds is refused,
 * naming the field.
 */
export function parsePassportInput(raw: unknown): ParseResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bad = (field: PassportField): ParseResult => ({ ok: false, field });

  const name = text(r.name);
  if (!name || name.length > LIMITS.name) return bad("name");

  const categoryId = r.categoryId;
  if (typeof categoryId !== "number" || !Number.isInteger(categoryId) || categoryId <= 0) return bad("category");

  const band = r.priceBand == null || r.priceBand === "" ? null : r.priceBand;
  if (band !== null && !(PRICE_BANDS as readonly unknown[]).includes(band)) return bad("priceBand");

  if (!Array.isArray(r.certifications) || r.certifications.some((c) => typeof c !== "string")) return bad("certifications");
  const fixed = new Set<string>();
  const other = new Map<string, string>();
  for (const c of (r.certifications as string[]).map((x) => x.trim()).filter(Boolean)) {
    if (isFixed(c)) fixed.add(c.toUpperCase());
    else if (c.length > LIMITS.certificationLength || UNSAFE.test(c)) return bad("certifications");
    else if (!other.has(c.toUpperCase())) other.set(c.toUpperCase(), c);
  }
  if (other.size > LIMITS.otherCertifications) return bad("certifications");
  const certifications = [...FIXED_CERTIFICATIONS.filter((f) => fixed.has(f)), ...other.values()];

  if (!Array.isArray(r.claims) || r.claims.some((c) => !(LEVER_CODES as readonly unknown[]).includes(c))) return bad("claims");
  const claims = LEVER_CODES.filter((c) => (r.claims as unknown[]).includes(c));

  const short = (v: unknown): string | null | false => {
    if (v == null) return null;
    const s = text(v);
    if (s == null || s.length > LIMITS.shortText) return false;
    return s || null;
  };
  const format = short(r.format);
  if (format === false) return bad("format");
  const capacity = short(r.capacity);
  if (capacity === false) return bad("capacity");

  let story: string | null = null;
  if (r.story != null) {
    const s = text(r.story);
    if (s == null || s.length > LIMITS.story) return bad("story");
    story = s || null;
  }

  return { ok: true, value: { name, categoryId, priceBand: band as PriceBand | null, certifications, claims, format, capacity, story } };
}
