import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MESSAGE_FILES } from "./request";

const load = (locale: string, f: string) =>
  JSON.parse(readFileSync(path.join(__dirname, "../../messages", locale, `${f}.json`), "utf8")) as Record<string, unknown>;

const keys = (o: Record<string, unknown>, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`]));

describe("message catalogues", () => {
  it.each(MESSAGE_FILES)("%s has the same keys in Italian and English", (f) => {
    expect(keys(load("en", f)).sort()).toEqual(keys(load("it", f)).sort());
  });

  it("namespaces do not collide across files", () => {
    const seen = new Map<string, string>();
    for (const f of MESSAGE_FILES) {
      for (const top of Object.keys(load("it", f))) {
        expect(seen.get(top), `top-level key "${top}" in ${f} and ${seen.get(top)}`).toBeUndefined();
        seen.set(top, f);
      }
    }
  });
});
