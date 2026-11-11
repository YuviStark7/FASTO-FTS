import { describe, expect, it } from "vitest";
import { readJsonStat, type JsonStat } from "./jsonstat";

// 2 x 3 cube: geo (IT, DE) x time (2020, 2021, 2022). Flat index = geo * 3 + time.
//   IT: 10 11 12     DE: 20 21 22
const dims: JsonStat["dimension"] = {
  geo: { label: "geo", category: { index: { IT: 0, DE: 1 }, label: { IT: "Italy", DE: "Germany" } } },
  time: { label: "time", category: { index: { "2020": 0, "2021": 1, "2022": 2 } } },
};
const base = { id: ["geo", "time"], size: [2, 3], dimension: dims };

describe("readJsonStat", () => {
  it("reads the object form of value", () => {
    const { rows } = readJsonStat({ ...base, value: { "0": 10, "1": 11, "2": 12, "3": 20, "4": 21, "5": 22 } });
    expect(rows).toHaveLength(6);
    expect(rows).toContainEqual({ geo: "IT", time: "2020", value: 10 });
    expect(rows).toContainEqual({ geo: "IT", time: "2022", value: 12 });
    expect(rows).toContainEqual({ geo: "DE", time: "2020", value: 20 });
    expect(rows).toContainEqual({ geo: "DE", time: "2022", value: 22 });
  });

  it("reads the array form of value and skips nulls", () => {
    const { rows } = readJsonStat({ ...base, value: [10, null, 12, 20, 21, null] as unknown as number[] });
    expect(rows.map((r) => `${r.geo}/${r.time}=${r.value}`)).toEqual(["IT/2020=10", "IT/2022=12", "DE/2020=20", "DE/2021=21"]);
  });

  it("object form with missing keys yields only present cells", () => {
    const { rows } = readJsonStat({ ...base, value: { "4": 21 } });
    expect(rows).toEqual([{ geo: "DE", time: "2021", value: 21 }]);
  });

  it("carries status flags by flat index; rows without a flag have no flag key", () => {
    const { rows } = readJsonStat({ ...base, value: { "0": 10, "4": 21 }, status: { "4": "p", "0": "e" } });
    expect(rows.find((r) => r.geo === "IT")).toMatchObject({ value: 10, flag: "e" });
    expect(rows.find((r) => r.geo === "DE")).toMatchObject({ value: 21, flag: "p" });
    const noFlag = readJsonStat({ ...base, value: { "1": 11 } }).rows[0];
    expect("flag" in noFlag).toBe(false);
  });

  it("status flags work with the array form too", () => {
    const { rows } = readJsonStat({ ...base, value: [1, 2, 3, 4, 5, 6], status: { "5": "b" } });
    expect(rows.filter((r) => r.flag)).toEqual([{ geo: "DE", time: "2022", value: 6, flag: "b" }]);
  });

  it("keeps a real zero value in the array form", () => {
    const { rows } = readJsonStat({ ...base, value: [0, null, null, null, null, null] as unknown as number[] });
    expect(rows).toEqual([{ geo: "IT", time: "2020", value: 0 }]);
  });

  it("resolves positions by index, not by key order", () => {
    const doc: JsonStat = {
      id: ["geo"],
      size: [2],
      value: { "0": 1, "1": 2 },
      dimension: { geo: { category: { index: { DE: 1, IT: 0 } } } },
    };
    expect(readJsonStat(doc).rows).toEqual([
      { geo: "IT", value: 1 },
      { geo: "DE", value: 2 },
    ]);
  });

  it("returns labels per dimension, {} when absent", () => {
    const { labels } = readJsonStat({ ...base, value: {} });
    expect(labels.geo).toEqual({ IT: "Italy", DE: "Germany" });
    expect(labels.time).toEqual({});
  });
});
