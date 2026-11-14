/**
 * Fit, `fit-v1` (module 06): how well a product passport matches the purchase levers that matter
 * in a territory. Pure and deterministic; the passport's claims map to the fixed lever
 * vocabulary of mention-score.v1, and Fit is the share of lever citations the product answers.
 *
 *   fit_raw = Σ share(levers the product matches) / Σ share(all levers), in [0, 1]
 *
 * It needs a published CSI reading (levers come from it), so it is grade C. MOS uses its
 * percentile rank among the cells that have it, like every other component.
 */
export const LEVER_CODES = [
  "origin_territory", "quality_taste", "artisanal_tradition", "certification", "organic_natural", "health_nutrition",
  "price_value", "convenience", "sustainability", "gift_occasion", "brand_trust", "novelty",
] as const;
export type LeverCode = (typeof LEVER_CODES)[number];

export type Passport = {
  priceBand: "entry" | "mid" | "premium" | "luxury" | null;
  certifications: string[]; // "DOP", "IGP", "STG", "BIO", ...
  /** Claims the firm states it can support, from the passport form. */
  claims: LeverCode[];
};

const ORIGIN_CERTS = new Set(["DOP", "IGP", "STG", "PDO", "PGI", "TSG"]);
const ORGANIC_CERTS = new Set(["BIO", "ORGANIC", "EU ORGANIC"]);

/** Levers a passport answers. Certifications imply their levers; everything else is a stated claim. */
export function passportLevers(p: Passport): Set<LeverCode> {
  const out = new Set<LeverCode>(p.claims.filter((c) => (LEVER_CODES as readonly string[]).includes(c)));
  const certs = p.certifications.map((c) => c.trim().toUpperCase());
  if (certs.some((c) => ORIGIN_CERTS.has(c))) {
    out.add("certification");
    out.add("origin_territory");
  }
  if (certs.some((c) => ORGANIC_CERTS.has(c))) {
    out.add("certification");
    out.add("organic_natural");
  }
  if (p.priceBand === "entry") out.add("price_value");
  return out;
}

/** Share of lever citations in the territory that the product answers; null without levers. */
export function fitRaw(matched: Set<LeverCode>, levers: { code: LeverCode; share: number }[]): number | null {
  const total = levers.reduce((s, l) => s + Math.max(0, l.share), 0);
  if (total <= 0) return null;
  const hit = levers.filter((l) => matched.has(l.code)).reduce((s, l) => s + Math.max(0, l.share), 0);
  return Math.round((hit / total) * 1000) / 1000;
}
