import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildQuery, createSpacer, MIN_INTERVAL_MS, parseCount, slugifyTag } from "./query";
import { COUNTRY_TAGS, TAGS } from "./tags";

const fixture = (name: string) => JSON.parse(readFileSync(path.join(__dirname, "fixtures", name), "utf8"));

describe("parseCount", () => {
  it("reads count from a recorded v2 search response", () => {
    expect(parseCount(fixture("cheeses-italy.json"))).toBe(6452);
  });
  it("accepts zero", () => {
    expect(parseCount({ count: 0, products: [] })).toBe(0);
  });
  it("throws instead of guessing when count is missing or malformed", () => {
    expect(() => parseCount({ products: [] })).toThrow(/count/);
    expect(() => parseCount({ count: "12" })).toThrow(/count/);
    expect(() => parseCount({ count: -1 })).toThrow(/count/);
    expect(() => parseCount(null)).toThrow(/count/);
  });
});

describe("buildQuery", () => {
  it("uses categories_tags for categories", () => {
    expect(buildQuery("categories", "en:cheeses", "en:italy")).toBe(
      "/api/v2/search?categories_tags=en:cheeses&countries_tags=en:italy&page_size=1&fields=code",
    );
  });
  it("uses labels_tags for labels, never categories_tags", () => {
    const q = buildQuery("labels", "en:organic", "en:france");
    expect(q).toContain("labels_tags=en:organic");
    expect(q).not.toContain("categories_tags");
  });
});

describe("tag list", () => {
  it("covers the 7 pilot countries", () => {
    expect(Object.keys(COUNTRY_TAGS).sort()).toEqual(["at", "be", "de", "es", "fr", "it", "nl"]);
  });
  it("organic is queried as a label", () => {
    expect(TAGS.filter((t) => t.category === "organic").every((t) => t.kind === "labels")).toBe(true);
  });
  it("has no duplicate (category, tag)", () => {
    const keys = TAGS.map((t) => `${t.category}|${t.kind}|${t.tag}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("createSpacer", () => {
  it("waits so that request starts are at least the interval apart", async () => {
    let clock = 1_000;
    const sleeps: number[] = [];
    const wait = createSpacer(
      MIN_INTERVAL_MS,
      () => clock,
      async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    );
    expect(await wait()).toBe(0); // first call does not wait
    clock += 1_000; // request took 1 s
    expect(await wait()).toBe(MIN_INTERVAL_MS - 1_000);
    clock += MIN_INTERVAL_MS + 500; // slow request: no extra wait
    expect(await wait()).toBe(0);
    expect(sleeps).toEqual([MIN_INTERVAL_MS - 1_000]);
  });
  it("stays under 10 requests per minute", () => {
    expect(60_000 / MIN_INTERVAL_MS).toBeLessThan(10);
  });
});

describe("slugifyTag", () => {
  it("makes a file-safe name", () => {
    expect(slugifyTag("en:extra-virgin-olive-oils")).toBe("en-extra-virgin-olive-oils");
  });
});
