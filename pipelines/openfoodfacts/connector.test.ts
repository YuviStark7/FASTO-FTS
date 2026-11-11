import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toResult } from "../shared/http";
import type { ConnectorContext } from "../shared/types";
import connector from "./index";
import { MIN_INTERVAL_MS } from "./query";
import { COUNTRY_TAGS, TAGS } from "./tags";

const body = readFileSync(path.join(__dirname, "fixtures", "cheeses-italy.json"));

function makeCtx(get: ConnectorContext["get"]) {
  const stored: string[] = [];
  const times: number[] = [];
  const ctx = {
    taxonomy: { categories: new Map(TAGS.map((t) => [t.category, { id: 1, slug: t.category, codes: {} }])) },
    get: async (url: string) => {
      times.push(Date.now());
      return get(url);
    },
    storeRaw: async (f: { name: string }) => void stored.push(f.name),
    log: () => {},
    params: {},
  } as unknown as ConnectorContext;
  return { ctx, stored, times };
}

describe("openfoodfacts connector", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("emits one grade C product_count per tag and country, spaced under the rate limit", async () => {
    const urls: string[] = [];
    const { ctx, stored, times } = makeCtx(async (url) => {
      urls.push(url);
      return toResult(url, 200, "application/json", new Uint8Array(body));
    });
    const promise = connector.run(ctx);
    await vi.runAllTimersAsync();
    const rows = await promise;

    expect(rows).toHaveLength(TAGS.length * Object.keys(COUNTRY_TAGS).length);
    expect(stored).toHaveLength(rows.length);
    expect(rows[0]).toMatchObject({
      category: "evo-oil",
      territory: "it",
      indicator: "product_count",
      seriesKey: "en:extra-virgin-olive-oils",
      value: 6452,
      grade: "C",
      sourceRef: "api/v2/search?categories_tags=en:extra-virgin-olive-oils&countries_tags=en:italy&page_size=1&fields=code",
    });
    expect(rows.every((r) => r.periodStart === r.periodEnd)).toBe(true);
    expect(urls.filter((u) => u.includes("labels_tags=en:organic"))).toHaveLength(7);
    expect(urls.some((u) => u.includes("categories_tags=en:organic"))).toBe(false);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(MIN_INTERVAL_MS);
  });

  it("retries a 503 page and never invents a value when a count stays unavailable", async () => {
    let calls = 0;
    const { ctx } = makeCtx(async (url) => {
      calls++;
      if (url.includes("categories_tags=en:cheeses&countries_tags=en:france")) {
        return toResult(url, 200, "text/html", new TextEncoder().encode("<html>Page temporarily unavailable</html>"));
      }
      return toResult(url, 200, "application/json", new Uint8Array(body));
    });
    const promise = connector.run(ctx);
    await vi.runAllTimersAsync();
    const rows = await promise;

    const total = TAGS.length * Object.keys(COUNTRY_TAGS).length;
    expect(rows).toHaveLength(total - 1);
    expect(rows.find((r) => r.category === "cheese" && r.territory === "fr")).toBeUndefined();
    expect(calls).toBe(total - 1 + 4); // 4 attempts for the failing one
  });
});
