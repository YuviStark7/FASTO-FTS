import type { TagKind } from "./query";

/**
 * Verified against the OFF taxonomies (categories.full.json, labels.json) and live counts on 11 Nov 2026.
 * This list, not categories.codes.off_tags, drives the connector. Differences from the migration:
 *  - cured-meats: en:prepared-meats (75k, includes cooked ham, terrines, plain sausages) replaced by the
 *    narrower raw-cured-meats, cured-hams and salami. en:cured-meats does not exist.
 *  - organic: en:organic is a label, not a category, so it is queried with labels_tags.
 */
export type OffTag = { category: string; kind: TagKind; tag: string };

export const TAGS: OffTag[] = [
  { category: "evo-oil", kind: "categories", tag: "en:extra-virgin-olive-oils" },
  { category: "cheese", kind: "categories", tag: "en:cheeses" },
  { category: "cured-meats", kind: "categories", tag: "en:raw-cured-meats" },
  { category: "cured-meats", kind: "categories", tag: "en:cured-hams" },
  { category: "cured-meats", kind: "categories", tag: "en:salami" },
  { category: "pasta", kind: "categories", tag: "en:pastas" },
  { category: "bakery", kind: "categories", tag: "en:breads" },
  { category: "bakery", kind: "categories", tag: "en:viennoiseries" },
  { category: "cereals-legumes", kind: "categories", tag: "en:cereal-grains" },
  { category: "cereals-legumes", kind: "categories", tag: "en:legumes" },
  { category: "preserves", kind: "categories", tag: "en:canned-vegetables" },
  { category: "preserves", kind: "categories", tag: "en:tomato-sauces" },
  { category: "processed-fruit-veg", kind: "categories", tag: "en:dried-fruits" },
  { category: "processed-fruit-veg", kind: "categories", tag: "en:fruit-preserves" },
  { category: "processed-fruit-veg", kind: "categories", tag: "en:fruit-juices" },
  { category: "honey", kind: "categories", tag: "en:honeys" },
  { category: "traditional-sweets", kind: "categories", tag: "en:confectioneries" },
  { category: "premium-soft-drinks", kind: "categories", tag: "en:sodas" },
  { category: "organic", kind: "labels", tag: "en:organic" },
  { category: "coffee", kind: "categories", tag: "en:coffees" },
  { category: "chocolate", kind: "categories", tag: "en:chocolates" },
  { category: "vinegar-condiments", kind: "categories", tag: "en:vinegars" },
  { category: "vinegar-condiments", kind: "categories", tag: "en:condiments" },
];

/** Territory slug to OFF countries_tags value, for the 7 countries of the pilot cities. */
export const COUNTRY_TAGS: Record<string, string> = {
  it: "en:italy",
  fr: "en:france",
  de: "en:germany",
  es: "en:spain",
  at: "en:austria",
  nl: "en:netherlands",
  be: "en:belgium",
};
