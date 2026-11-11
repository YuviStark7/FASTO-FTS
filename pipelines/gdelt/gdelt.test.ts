import { describe, expect, it } from "vitest";
import { toResult } from "../shared/http";
import { normalise } from "../shared/normalise";
import { buildTaxonomy, type TerritoryRow } from "../shared/taxonomy";
import type { ConnectorContext, ObservationInput } from "../shared/types";
import connector from "./index";
import { monthlyCounts, monthsBetween, type Timeline } from "./map";
import { buildQueryUrl, KEYWORDS, SCOPES, window12 } from "./queries";

// NOTE: api.gdeltproject.org answered 429 / connection reset from the build sandbox, so these
// timelines are NOT recorded responses. They are built by hand to the documented DOC 2.0
// timelinevolraw shape: {"timeline":[{"series":"Article Count","data":[{"date":"YYYYMMDDT000000Z","value":n}]}]}.
// Re-record against the live API in GitHub Actions and replace `timeline` with the raw file.
function timeline(from: string, to: string, value: (day: string) => number | null): Timeline {
  const data: { date: string; value: number }[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) {
    const iso = d.toISOString().slice(0, 10);
    const v = value(iso);
    if (v != null) data.push({ date: `${iso.replaceAll("-", "")}T000000Z`, value: v });
  }
  return { timeline: [{ series: "Article Count", data }] };
}

const TODAY = new Date("2026-11-11T00:00:00Z");
const MONTHS = monthsBetween(window12(TODAY).start, window12(TODAY).end);

describe("query building", () => {
  it("covers the last 12 complete months", () => {
    const { start, end } = window12(TODAY);
    expect(start.toISOString().slice(0, 10)).toBe("2025-11-01");
    expect(end.toISOString().slice(0, 10)).toBe("2026-10-31");
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[0]).toBe("2025-11");
    expect(MONTHS[11]).toBe("2026-10");
  });

  it("builds the exact URL with language, FIPS country and raw volume mode", () => {
    const url = buildQueryUrl(KEYWORDS["evo-oil"].it, "it", "IT", TODAY);
    const u = new URL(url);
    expect(u.searchParams.get("query")).toBe('"olio extravergine" sourcelang:italian sourcecountry:IT');
    expect(u.searchParams.get("mode")).toBe("timelinevolraw");
    expect(u.searchParams.get("format")).toBe("json");
    expect(u.searchParams.get("startdatetime")).toBe("20251101000000");
    expect(u.searchParams.get("enddatetime")).toBe("20261031235959");
  });

  it("has a query for every category and language, and Austria and Belgium scopes", () => {
    expect(Object.keys(KEYWORDS)).toHaveLength(15);
    for (const k of Object.values(KEYWORDS)) expect(Object.keys(k).sort()).toEqual(["de", "es", "fr", "it", "nl"]);
    expect(SCOPES.find((s) => s.territory === "at")).toMatchObject({ lang: "de", gdelt: "AU" });
    expect(SCOPES.filter((s) => s.territory === "be").map((s) => s.lang).sort()).toEqual(["fr", "nl"]);
    expect(SCOPES.find((s) => s.territory === "de")?.gdelt).toBe("GM");
    expect(SCOPES.find((s) => s.territory === "es")?.gdelt).toBe("SP");
  });
});

describe("monthlyCounts", () => {
  it("sums daily raw counts into calendar months with ISO period bounds", () => {
    const doc = timeline("2025-11-01", "2026-10-31", () => 2);
    const { counts, incomplete } = monthlyCounts(doc, MONTHS);
    expect(incomplete).toEqual([]);
    expect(counts).toHaveLength(12);
    expect(counts[0]).toEqual({ month: "2025-11", periodStart: "2025-11-01", periodEnd: "2025-11-30", value: 60 });
    expect(counts[3]).toMatchObject({ month: "2026-02", periodEnd: "2026-02-28", value: 56 });
  });

  it("keeps an explicit zero month as 0", () => {
    const doc = timeline("2025-11-01", "2026-10-31", (d) => (d.startsWith("2026-03") ? 0 : 1));
    const march = monthlyCounts(doc, MONTHS).counts.find((c) => c.month === "2026-03");
    expect(march?.value).toBe(0);
  });

  it("emits no row for a month with missing days, never a zero", () => {
    const doc = timeline("2025-11-01", "2026-10-31", (d) => (d === "2026-01-15" ? null : 1));
    const { counts, incomplete } = monthlyCounts(doc, MONTHS);
    expect(incomplete).toEqual(["2026-01"]);
    expect(counts.find((c) => c.month === "2026-01")).toBeUndefined();
    expect(counts).toHaveLength(11);
  });

  it("returns nothing for an empty timeline", () => {
    expect(monthlyCounts({}, MONTHS).counts).toEqual([]);
    expect(monthlyCounts({ timeline: [{ data: [] }] }, MONTHS).incomplete).toHaveLength(12);
  });
});

const terr = (id: number, slug: string, cc: string): TerritoryRow => ({
  id, slug, level: "country", country_code: cc, nuts_code: null, parent_id: null, is_pilot: false, stat_codes: {}, name_it: slug, name_en: slug, centroid: null,
});
const taxonomy = buildTaxonomy(
  [{ id: 1, slug: "evo-oil", codes: {} }],
  ["it", "fr", "de", "es", "nl", "at", "be"].map((s, i) => terr(i + 1, s, s.toUpperCase())),
  [{ id: 1, slug: "media_attention", unit: "articles" }],
  [{ id: 1, slug: "gdelt", default_grade: "C" }],
);

function ctxWith(respond: (url: string) => ReturnType<typeof toResult> | Error) {
  const warnings: string[] = [];
  const raw: string[] = [];
  const urls: string[] = [];
  const ctx: ConnectorContext = {
    taxonomy,
    get: async (url) => {
      urls.push(url);
      const r = respond(url);
      if (r instanceof Error) throw r;
      return r;
    },
    storeRaw: async (f) => void raw.push(f.name),
    log: () => {},
    warn: (m) => void warnings.push(m),
    params: { spacing_ms: "0", today: "2026-11-11" },
  };
  return { ctx, warnings, raw, urls };
}

const ok = (url: string, doc: Timeline) => toResult(url, 200, "application/json", new TextEncoder().encode(JSON.stringify(doc)));

describe("gdelt connector", () => {
  it("maps each scope to media_attention rows, grade C, series lang:country, sourceRef = query URL", async () => {
    const { ctx, urls, raw } = ctxWith((url) => ok(url, timeline("2025-11-01", "2026-10-31", () => 3)));
    const rows = (await connector.run(ctx)) as ObservationInput[];
    // only evo-oil exists in the test taxonomy; the other 11 categories are skipped with a warning
    expect(urls).toHaveLength(SCOPES.length);
    expect(raw).toHaveLength(SCOPES.length);
    expect(rows).toHaveLength(SCOPES.length * 12);
    const be = rows.filter((r) => r.territory === "be");
    expect(new Set(be.map((r) => r.seriesKey))).toEqual(new Set(["fr:be", "nl:be"]));
    const first = rows[0];
    expect(first).toMatchObject({ category: "evo-oil", territory: "it", indicator: "media_attention", seriesKey: "it:it", grade: "C", periodStart: "2025-11-01", periodEnd: "2025-11-30", value: 90 });
    expect(first.sourceRef).toBe(urls[0]);
    const { rows: norm, rejected } = normalise(rows, taxonomy, { source: "gdelt", runId: null });
    expect(rejected).toEqual([]);
    expect(norm).toHaveLength(rows.length);
  });

  it("on 429 gives a warning and no rows, and stops after repeated failures", async () => {
    const { ctx, warnings, urls } = ctxWith(() => new Error("HTTP 429 for x: Please limit requests to one every 5 seconds"));
    const rows = (await connector.run(ctx)) as ObservationInput[];
    expect(rows).toEqual([]);
    expect(warnings.some((w) => w.includes("request failed"))).toBe(true);
    expect(warnings.some((w) => w.includes("stopped after 4 consecutive failures"))).toBe(true);
    expect(urls).toHaveLength(4);
  });

  it("treats a plain-text rate-limit body as a failure, not as zero", async () => {
    const { ctx, warnings } = ctxWith((url) => toResult(url, 200, "text/html", new TextEncoder().encode("Please limit requests to one every 5 seconds")));
    const rows = (await connector.run(ctx)) as ObservationInput[];
    expect(rows).toEqual([]);
    expect(warnings[0]).toContain("not JSON");
  });

  it("warns on an empty timeline and writes no row", async () => {
    const { ctx, warnings } = ctxWith((url) => ok(url, {}));
    const rows = (await connector.run(ctx)) as ObservationInput[];
    expect(rows).toEqual([]);
    expect(warnings.some((w) => w.includes("empty timeline"))).toBe(true);
  });
});
