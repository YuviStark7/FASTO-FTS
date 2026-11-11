/** Pure helpers for the Open Food Facts search API (v2). No I/O here, so they are unit-testable. */

export const OFF_BASE = "https://world.openfoodfacts.org";

/** OFF asks for at most 10 search requests per minute; 6.5 s between requests stays under it. */
export const MIN_INTERVAL_MS = 6_500;

export type TagKind = "categories" | "labels";

/** Path and query pinning one count: products with `tag` (category or label) sold in `countryTag`. */
export function buildQuery(kind: TagKind, tag: string, countryTag: string): string {
  return `/api/v2/search?${kind}_tags=${tag}&countries_tags=${countryTag}&page_size=1&fields=code`;
}

/** The `count` field of an OFF search response. Throws rather than guessing when it is absent. */
export function parseCount(body: unknown): number {
  const count = (body as { count?: unknown } | null)?.count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    throw new Error(`OFF response has no valid "count": ${JSON.stringify(body)?.slice(0, 200)}`);
  }
  return count;
}

/** Enforces a minimum gap between request starts. Clock and sleep are injectable for tests. */
export function createSpacer(
  minIntervalMs: number,
  now: () => number = Date.now,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
) {
  let last: number | null = null;
  return async function wait(): Promise<number> {
    let waited = 0;
    if (last !== null) {
      waited = Math.max(0, last + minIntervalMs - now());
      if (waited > 0) await sleep(waited);
    }
    last = now();
    return waited;
  };
}

export const slugifyTag = (tag: string) => tag.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
