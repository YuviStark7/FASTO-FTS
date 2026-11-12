import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toResult } from "../shared/http";
import type { ConnectorContext } from "../shared/types";
import { AREAS, type CityArea } from "./areas";
import connector, { shopValues } from "./index";
import { buildQuery, parseCity } from "./parse";

// SYNTHETIC fixture in the Overpass out:json shape. Counts are test values, not OSM data.
const ok = JSON.parse(readFileSync(new URL("./fixtures/synthetic-ok.json", import.meta.url), "utf8"));
const area: CityArea = { wikidata: "Q1", adminLevel: 8, names: ["Testville"], note: "test" };
const shops = ["bakery", "cheese", "deli"];
const clone = () => JSON.parse(JSON.stringify(ok));

describe("parseCity", () => {
  it("reads counts per shop in query order, zero included", () => {
    const p = parseCity(ok, area, shops);
    expect(p.relation).toMatchObject({ id: 1, name: "Testville", adminLevel: "8" });
    expect([...p.counts]).toEqual([
      ["bakery", 10],
      ["cheese", 0],
      ["deli", 3],
    ]);
  });

  it("rejects a runtime error remark instead of returning zeros", () => {
    const j = clone();
    j.remark = 'runtime error: Query timed out in "query" at line 4 after 181 seconds.';
    expect(() => parseCity(j, area, shops)).toThrow(/remark/);
  });

  it("rejects missing count blocks", () => {
    const j = clone();
    j.elements.pop();
    expect(() => parseCity(j, area, shops)).toThrow(/count blocks/);
  });

  it("rejects no relation, two relations, wrong level, name or wikidata", () => {
    const none = clone();
    none.elements = none.elements.filter((e: { type: string }) => e.type !== "relation");
    expect(() => parseCity(none, area, shops)).toThrow(/exactly one/);
    const two = clone();
    two.elements.unshift({ ...two.elements[0], id: 2 });
    expect(() => parseCity(two, area, shops)).toThrow(/exactly one/);
    for (const [k, v, re] of [
      ["admin_level", "6", /admin_level/],
      ["name", "Other", /named/],
      ["wikidata", "Q2", /wikidata/],
    ] as const) {
      const j = clone();
      j.elements[0].tags[k] = v;
      expect(() => parseCity(j, area, shops)).toThrow(re);
    }
  });

  it("rejects malformed or inconsistent counts", () => {
    const j = clone();
    j.elements[1].tags.total = "11";
    expect(() => parseCity(j, area, shops)).toThrow(/add up/);
    const k = clone();
    delete k.elements[1].tags.ways;
    expect(() => parseCity(k, area, shops)).toThrow(/malformed/);
  });
});

describe("query and shop list", () => {
  it("builds one count statement per shop and selects the area by admin_level and wikidata", () => {
    const q = buildQuery(area, shops);
    expect(q).toContain('rel["boundary"="administrative"]["admin_level"="8"]["wikidata"="Q1"]->.r;');
    expect(q.match(/out count;/g)).toHaveLength(3);
    expect(q).toContain('nwr["shop"="cheese"](area.a);out count;');
  });
  it("uses the relation id when one is verified", () => {
    expect(buildQuery({ ...area, relationId: 99 }, shops)).toContain("rel(99)->.r;");
  });
  it("unions category shops with the baseline, sorted and unique", () => {
    expect(shopValues([{ codes: { osm_shop: ["deli", "cheese"] } }, { codes: {} }], ["bakery", "deli"])).toEqual(["bakery", "cheese", "deli"]);
  });
  it("defines an area for each of the 20 pilot cities", () => {
    expect(Object.keys(AREAS)).toHaveLength(20);
  });
});

function fakeCtx(respond: (body: string, url: string) => Uint8Array | Error, params: Record<string, string> = {}) {
  const logs: string[] = [];
  const calls: string[] = [];
  const ctx = {
    taxonomy: {
      categories: new Map([["x", { codes: { osm_shop: ["bakery", "cheese"] } }]]),
      pilotCities: [{ slug: "roma" }, { slug: "milano" }],
    },
    get: async (url: string, init?: { body?: string }) => {
      calls.push(url);
      const r = respond(decodeURIComponent(init?.body ?? ""), url);
      if (r instanceof Error) throw r;
      return toResult(url, 200, "application/json", r);
    },
    storeRaw: async () => {},
    log: (m: string) => logs.push(m),
    warn: (m: string) => logs.push(m),
    params: { baseline_shops: "deli", endpoints: "https://a.test/api,https://b.test/api", ...params },
  } as unknown as ConnectorContext;
  return { ctx, logs, calls };
}

describe("connector", () => {
  const answer = (wikidata: string, name: string) => {
    const j = {
      elements: [
        { type: "relation", id: 5, tags: { boundary: "administrative", admin_level: "8", name, wikidata } },
        ...["3", "0", "4"].map((t) => ({ type: "count", id: 0, tags: { nodes: t, ways: "0", relations: "0", total: t } })),
      ],
    };
    return new TextEncoder().encode(JSON.stringify(j));
  };

  it("emits pos_count rows with seriesKey shop=<value>, a real zero, and no row for a failed city", async () => {
    // Shops sorted: bakery, cheese, deli -> 3, 0, 4. Rome answers; Milan fails.
    const { ctx, logs } = fakeCtx((body) => (body.includes("Q220") ? answer("Q220", "Roma") : new Error("HTTP 504")));
    const rows = await connector.run(ctx);
    expect(rows.map((r) => [r.territory, r.seriesKey, r.value])).toEqual([
      ["roma", "shop=bakery", 3],
      ["roma", "shop=cheese", 0],
      ["roma", "shop=deli", 4],
    ]);
    expect(rows[0]).toMatchObject({ category: null, indicator: "pos_count" });
    expect(rows[0].periodStart).toBe(rows[0].periodEnd);
    expect(rows[0].sourceRef).toBe("overpass:a.test:area=relation=5,wikidata=Q220,admin_level=8;shop=bakery");
    expect(logs.some((l) => l.includes("milano: FAILED"))).toBe(true);
  }, 15000);

  it("falls back to the next Overpass endpoint and keeps using the one that answered", async () => {
    const { ctx, calls } = fakeCtx((body, url) =>
      url.startsWith("https://a.test") ? new Error("HTTP 406") : body.includes("Q220") ? answer("Q220", "Roma") : answer("Q490", "Milano"),
    );
    const rows = await connector.run(ctx);
    expect(rows.some((r) => r.territory === "roma")).toBe(true);
    expect(rows[0].sourceRef).toContain("overpass:b.test:");
    // Roma: a fails, b answers. Milano: starts with b directly.
    expect(calls).toEqual(["https://a.test/api", "https://b.test/api", "https://b.test/api"]);
  }, 15000);

  it("throws when every city fails", async () => {
    const { ctx } = fakeCtx(() => new Error("HTTP 429"));
    await expect(connector.run(ctx)).rejects.toThrow(/no city produced data/);
  }, 15000);
});
