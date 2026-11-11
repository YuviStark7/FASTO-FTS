import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { toResult } from "../shared/http";
import type { ConnectorContext } from "../shared/types";
import { COMUNI, keyFor } from "./comuni";
import connector from "./index";
import { parsePopulation } from "./parse";

const fx = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf8");
const roma = () => JSON.parse(fx("roma.json"));

describe("parsePopulation", () => {
  it("reads the comune, years and values, and flags the estimate", () => {
    const p = parsePopulation(roma());
    expect(p.refArea).toEqual({ id: "058091", name: "Roma" });
    expect(p.points).toHaveLength(8);
    expect(p.points[2]).toEqual({ year: 2021, value: 2770226, estimate: false });
    expect(p.points[7]).toEqual({ year: 2026, value: 2745062, estimate: true });
  });

  it("skips missing values instead of filling them", () => {
    const doc = roma();
    const obs = doc.data.dataSets[0].series["0:0:0:0:0:0"].observations;
    obs["3"] = [null];
    delete obs["4"][0];
    obs["4"] = [""];
    const p = parsePopulation(doc);
    expect(p.skipped).toBe(2);
    expect(p.points.map((x) => x.year)).not.toContain(2022);
    expect(p.points.map((x) => x.year)).not.toContain(2023);
  });
});

describe("comune mapping", () => {
  it("covers the 12 pilot cities with unique slugs and 6-digit codes", () => {
    expect(COMUNI).toHaveLength(12);
    expect(new Set(COMUNI.map((c) => c.slug)).size).toBe(12);
    for (const c of COMUNI) expect(c.code).toMatch(/^\d{6}$/);
    expect(COMUNI.find((c) => c.slug === "roma")).toMatchObject({ code: "058091", label: "Roma" });
    expect(keyFor("058091")).toBe("A.058091.JAN.9.TOTAL.99");
  });

  it("the verona fixture carries the verona code and label", () => {
    const p = parsePopulation(JSON.parse(fx("verona.json")));
    const v = COMUNI.find((c) => c.slug === "verona")!;
    expect(p.refArea).toEqual({ id: v.code, name: v.label });
  });
});

function makeCtx(responder: (url: string) => string) {
  const stored: string[] = [];
  const logs: string[] = [];
  const ctx = {
    taxonomy: {},
    params: {},
    log: (m: string) => logs.push(m),
    warn: (m: string) => logs.push(m),
    storeRaw: async (f: { name: string }) => void stored.push(f.name),
    get: async (url: string) => toResult(url, 200, "application/json", new TextEncoder().encode(responder(url))),
  } as unknown as ConnectorContext;
  return { ctx, stored, logs };
}

describe("connector.run", () => {
  it("emits the latest 5 measured years as grade A population rows and stores every response", async () => {
    // every city gets the Roma payload; only Roma's label matches, the others must be left out
    const { ctx, stored, logs } = makeCtx(() => fx("roma.json"));
    const rows = await connector.run(ctx);
    expect(stored).toHaveLength(12);
    expect(logs.filter((l) => l.startsWith("SKIP"))).toHaveLength(11);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.periodStart)).toEqual(["2021-01-01", "2022-01-01", "2023-01-01", "2024-01-01", "2025-01-01"]);
    expect(rows.every((r) => r.periodStart === r.periodEnd)).toBe(true);
    expect(rows[0]).toMatchObject({
      category: null,
      territory: "roma",
      indicator: "population",
      seriesKey: "istat_comune",
      value: 2770226,
      grade: "A",
      sourceRef: "22_289_DF_DCIS_POPRES1_15/A.058091.JAN.9.TOTAL.99?time=2021",
    });
    expect(rows.map((r) => r.value)).not.toContain(2745062); // the 2026 estimate
  });
});
