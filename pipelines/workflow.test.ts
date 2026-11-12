import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONNECTORS } from "./connectors";

const yml = readFileSync(".github/workflows/pipelines.yml", "utf8");

describe("pipelines workflow", () => {
  it("runs every registered connector in the full refresh", () => {
    const all = /ALL='(\[[^']*\])'/.exec(yml)?.[1];
    expect(all).toBeDefined();
    expect([...(JSON.parse(all!) as string[])].sort()).toEqual([...CONNECTORS].sort());
  });

  it("accepts every connector as a single-source mode", () => {
    for (const slug of CONNECTORS) expect(yml).toMatch(new RegExp(`[|( ]${slug}[|)]`));
  });

  it("gives the Anthropic key only to scoring, eval and admin reruns", () => {
    const lines = yml.split("\n").filter((l) => l.includes("secrets.ANTHROPIC_API_KEY"));
    expect(lines).toHaveLength(2); // finish/Score mentions and other (queued, eval)
  });
});
