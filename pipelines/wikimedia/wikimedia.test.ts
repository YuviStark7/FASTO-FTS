import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toResult } from "../shared/http";
import type { ConnectorContext, RawFile } from "../shared/types";
import { articlePath, monthPeriod, run, window, wikidataUrl } from "./index";
import { ITEMS, LANGUAGES } from "./items";

// Fixtures are real responses (recorded 11 Nov 2026) trimmed to two items and three months.
const fx = (name: string) => readFileSync(path.join(__dirname, "fixtures", name));

function fakeCtx() {
  const urls: string[] = [];
  const raw: RawFile[] = [];
  const warnings: string[] = [];
  const ctx: ConnectorContext = {
    taxonomy: undefined as never,
    get: async (url) => {
      urls.push(url);
      if (url.startsWith("https://www.wikidata.org/")) return toResult(url, 200, "application/json", fx("wikidata_sitelinks.json"));
      const m = url.match(/per-article\/(\w+)\.wikipedia\/all-access\/user\/([^/]+)\//);
      const files: Record<string, string> = { "it:Formaggio": "pageviews_it_Q10943.json", "de:K%C3%A4se": "pageviews_de_Q10943.json", "it:Prosciutto_crudo": "pageviews_it_Q1065033.json" };
      const file = m && files[`${m[1]}:${m[2]}`];
      if (!file) throw new Error(`HTTP 404 for ${url}: not found`);
      return toResult(url, 200, "application/json", fx(file));
    },
    storeRaw: async (f) => void raw.push(f),
    log: () => {},
    warn: (m) => void warnings.push(m),
    params: {},
  };
  return { ctx, urls, raw, warnings };
}

const NOW = new Date("2026-11-11T12:00:00Z");

describe("window and periods", () => {
  it("covers the 36 complete months before today", () => {
    expect(window(NOW)).toEqual({ start: "20231101", end: "20261031" });
    expect(window(new Date("2027-01-01T00:00:00Z"))).toEqual({ start: "20240101", end: "20261231" });
  });
  it("turns a monthly timestamp into first..last day", () => {
    expect(monthPeriod("2026100100")).toEqual({ periodStart: "2026-10-01", periodEnd: "2026-10-31" });
    expect(monthPeriod("2024020100")).toEqual({ periodStart: "2024-02-01", periodEnd: "2024-02-29" });
  });
  it("encodes titles with underscores and percent escapes", () => {
    expect(articlePath("de", "Käse", "20231101", "20261031")).toBe("de.wikipedia/all-access/user/K%C3%A4se/monthly/20231101/20261031");
    expect(articlePath("it", "Prosciutto crudo", "a", "b")).toContain("/Prosciutto_crudo/");
  });
  it("asks Wikidata for sitelinks of every item in the pilot languages only", () => {
    const u = new URL(wikidataUrl(["Q1", "Q2"]));
    expect(u.searchParams.get("ids")).toBe("Q1|Q2");
    expect(u.searchParams.get("sitefilter")).toBe("itwiki|frwiki|dewiki|eswiki|nlwiki");
  });
});

describe("items", () => {
  it("covers all 15 categories with unique Q-ids", () => {
    expect(new Set(ITEMS.map((i) => i.category)).size).toBe(15);
    expect(new Set(ITEMS.map((i) => i.qid)).size).toBe(ITEMS.length);
  });
  it("assigns views to it, fr, de, es, nl only: no Belgium, no Austria", () => {
    expect(LANGUAGES.map((l) => l.territory)).toEqual(["it", "fr", "de", "es", "nl"]);
  });
});

describe("wikimedia connector", () => {
  it("maps sitelinks to articles, emits monthly grade C rows pinned to the API path", async () => {
    const { ctx, urls } = fakeCtx();
    const rows = await run(ctx, NOW);
    const cheeseIt = rows.filter((r) => r.seriesKey === "it:Q10943");
    expect(cheeseIt.map((r) => [r.periodStart, r.periodEnd, r.value])).toEqual([
      ["2026-08-01", "2026-08-31", 1607],
      ["2026-09-01", "2026-09-30", 1559],
      ["2026-10-01", "2026-10-31", 1542],
    ]);
    expect(cheeseIt[0]).toMatchObject({
      category: "cheese",
      territory: "it",
      indicator: "pageviews",
      grade: "C",
      sourceRef: "it.wikipedia/all-access/user/Formaggio/monthly/20231101/20261031",
    });
    expect(urls).toContain("https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/de.wikipedia/all-access/user/K%C3%A4se/monthly/20231101/20261031");
    expect(rows.find((r) => r.seriesKey === "de:Q10943")?.territory).toBe("de");
  });

  it("writes no row for a missing article or a 404, and warns instead of storing zero", async () => {
    const { ctx, warnings, urls } = fakeCtx();
    const rows = await run(ctx, NOW);
    expect(warnings.some((w) => w.includes("Q1065033") && w.includes("no nl.wikipedia"))).toBe(true); // no nl sitelink
    expect(warnings.some((w) => w.includes("fr:Q10943") && w.includes("404"))).toBe(true); // title exists, API 404
    expect(rows.some((r) => r.seriesKey === "nl:Q1065033")).toBe(false);
    expect(rows.some((r) => r.seriesKey === "fr:Q10943")).toBe(false);
    expect(rows.every((r) => r.value > 0)).toBe(true);
    expect(urls.some((u) => u.includes("nl.wikipedia") && u.includes("Prosciutto"))).toBe(false);
    // items Wikidata did not return are skipped with a warning
    expect(warnings.some((w) => w.includes("Q93165") && w.includes("not returned"))).toBe(true);
  });

  it("never emits Belgian or Austrian territories", async () => {
    const { ctx } = fakeCtx();
    const rows = await run(ctx, NOW);
    expect(new Set(rows.map((r) => r.territory))).toEqual(new Set(["it", "de"]));
    expect(rows.some((r) => r.territory === "be" || r.territory === "at")).toBe(false);
  });

  it("adds a total series per category and language that sums the items", async () => {
    const { ctx } = fakeCtx();
    const rows = await run(ctx, NOW);
    const total = rows.filter((r) => r.seriesKey === "it:total");
    const byCat = (c: string) => total.filter((r) => r.category === c).map((r) => [r.periodStart, r.value]);
    expect(byCat("cheese")).toEqual([["2026-08-01", 1607], ["2026-09-01", 1559], ["2026-10-01", 1542]]);
    expect(byCat("cured-meats")).toEqual([["2026-08-01", 1193], ["2026-09-01", 1103], ["2026-10-01", 785]]);
    expect(total[0]).toMatchObject({ grade: "C", territory: "it", indicator: "pageviews" });
    expect(total[0].sourceRef).toContain("it.wikipedia");
  });

  it("stores every response raw", async () => {
    const { ctx, raw } = fakeCtx();
    await run(ctx, NOW);
    expect(raw.map((f) => f.name)).toContain("wikidata_sitelinks.json");
    expect(raw.map((f) => f.name)).toContain("pageviews_de_Q10943.json");
  });
});
