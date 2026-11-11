import type { OfferInput } from "../shared/types";

/** Pure mapping of an OFF product to an OfferInput. Never invents: missing parts stay null or the product is skipped. */

const NAME_FIELDS = ["product_name", "product_name_it", "product_name_fr", "product_name_de", "product_name_es", "product_name_nl", "product_name_en"];

/** Certification and quality labels worth showing; everything else (nutri-score, packaging, ...) is dropped. */
const LABEL_PATTERN =
  /^[a-z]{2}:(?:dop|pdo|igp|pgi|aop|aoc|doc|docg|igt|stg|tsg|protected-designation-of-origin|protected-geographical-indication|traditional-specialit(?:y|ies)-guaranteed|organic|eu-organic|bio|bio-.+|.+-bio|ab-agriculture-biologique|biologico|fairtrade.*|fair-trade.*|max-havelaar|rainforest-alliance.*|demeter|naturland|bioland|label-rouge|slow-food.*|vegan|vegetarian|non-gmo.*|no-gmo.*|ogm-free.*|pdo-.+|pgi-.+|dop-.+|igp-.+)$/;

export function filterLabels(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is string => typeof t === "string" && LABEL_PATTERN.test(t));
}

type Product = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function productName(p: Product): string | null {
  for (const f of NAME_FIELDS) {
    const v = str(p[f]);
    if (v) return v;
  }
  return null;
}

export function firstBrand(p: Product): string | null {
  const b = str(p.brands);
  if (!b) return null;
  return str(b.split(",")[0]);
}

export function parsePack(p: Product): { packSize: number | null; packUnit: "g" | "kg" | "ml" | "l" | null } {
  const raw = p.product_quantity;
  const size = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  const unit = typeof p.product_quantity_unit === "string" ? p.product_quantity_unit.trim().toLowerCase() : "";
  if (!Number.isFinite(size) || size <= 0 || !["g", "kg", "ml", "l"].includes(unit)) return { packSize: null, packUnit: null };
  return { packSize: size, packUnit: unit as "g" | "kg" | "ml" | "l" };
}

export function mapProduct(p: Product, category: string, territory: string, observedOn: string): OfferInput | null {
  const code = str(p.code);
  const name = productName(p);
  if (!code || !name) return null;
  const brand = firstBrand(p);
  const origins = Array.isArray(p.origins_tags) ? p.origins_tags.filter((t): t is string => typeof t === "string") : [];
  return {
    category,
    territory,
    ...(brand ? { competitor: { name: brand, kind: "brand" as const } } : {}),
    productName: name,
    externalId: code,
    price: null,
    ...parsePack(p),
    channel: null,
    attributes: { labels: filterLabels(p.labels_tags), origins },
    url: `https://world.openfoodfacts.org/product/${code}`,
    observedOn,
    grade: "A",
  };
}

/** Products of one response; tolerates a missing list (count-only answer) by returning nothing. */
export function mapProducts(body: unknown, category: string, territory: string, observedOn: string): OfferInput[] {
  const list = (body as { products?: unknown } | null)?.products;
  if (!Array.isArray(list)) return [];
  return list.flatMap((p) => {
    const o = p && typeof p === "object" ? mapProduct(p as Product, category, territory, observedOn) : null;
    return o ? [o] : [];
  });
}
