import { describe, expect, it } from "vitest";
import { acceptanceState, barGeometry, projectMet, summariseAcceptance, validateManual } from "./acceptance";

const row = (release_target: number, project_target: number, current_value: number | null) => ({ release_target, project_target, current_value });

describe("acceptanceState", () => {
  it("compares the value with the release target", () => {
    expect(acceptanceState(row(15, 15, 15))).toBe("met");
    expect(acceptanceState(row(5, 30, 7))).toBe("met");
    expect(acceptanceState(row(5, 30, 2))).toBe("inProgress");
    expect(acceptanceState(row(300, 300, 0))).toBe("notStarted");
  });
  it("never calls a target with release target 0 met or missed", () => {
    expect(acceptanceState(row(0, 15, null))).toBe("afterRelease");
    expect(acceptanceState(row(0, 15, 0))).toBe("afterRelease");
    expect(acceptanceState(row(0, 15, 40))).toBe("afterRelease");
  });
  it("keeps a missing value apart from zero", () => {
    expect(acceptanceState(row(3, 10, null))).toBe("notRecorded");
  });
});

describe("projectMet", () => {
  it("needs a value at or above the 12-month target", () => {
    expect(projectMet(row(0, 15, 15))).toBe(true);
    expect(projectMet(row(5, 30, 29))).toBe(false);
    expect(projectMet(row(0, 15, null))).toBe(false);
    expect(projectMet(row(0, 0, 0))).toBe(false);
  });
});

describe("barGeometry", () => {
  it("spans the project target and marks the release target inside it", () => {
    expect(barGeometry(row(5, 30, 3))).toEqual({ fill: 0.1, release: 5 / 30 });
  });
  it("has no separate release marker when both targets coincide or the release asks nothing", () => {
    expect(barGeometry(row(15, 15, 15))).toEqual({ fill: 1, release: null });
    expect(barGeometry(row(0, 20, 5))).toEqual({ fill: 0.25, release: null });
  });
  it("clamps, and draws nothing for a missing value or no target", () => {
    expect(barGeometry(row(5, 8, 12)).fill).toBe(1);
    expect(barGeometry(row(0, 15, null)).fill).toBe(0);
    expect(barGeometry(row(0, 0, 4))).toEqual({ fill: 0, release: null });
  });
});

describe("summariseAcceptance", () => {
  it("counts met targets only among those the release asks for", () => {
    expect(summariseAcceptance([row(15, 15, 15), row(20, 20, 20), row(300, 300, 0), row(5, 30, 1), row(0, 15, 99), row(0, 20, null)])).toEqual({ due: 4, met: 2, afterRelease: 2 });
    expect(summariseAcceptance([])).toEqual({ due: 0, met: 0, afterRelease: 0 });
  });
});

describe("validateManual", () => {
  it("accepts whole numbers from zero and trims the note", () => {
    expect(validateManual({ value: "2", note: "  aziende pilota  " })).toEqual({ ok: true, value: 2, note: "aziende pilota" });
    expect(validateManual({ value: "0", note: "" })).toEqual({ ok: true, value: 0, note: null });
    expect(validateManual({ value: 100000 })).toEqual({ ok: true, value: 100000, note: null });
  });
  it("reads a blank value as not recorded, never as zero", () => {
    expect(validateManual({ value: "  ", note: "x" })).toEqual({ ok: true, value: null, note: "x" });
  });
  it("refuses negatives, fractions, non-numbers and values over the ceiling", () => {
    for (const value of ["-1", "2.5", "2,5", "1e3", "abc", "100001", "12345678"]) expect(validateManual({ value })).toEqual({ ok: false, errors: { value: true } });
  });
  it("refuses a note over 500 characters or of the wrong type", () => {
    expect(validateManual({ value: "1", note: "a".repeat(500) }).ok).toBe(true);
    expect(validateManual({ value: "1", note: "a".repeat(501) })).toEqual({ ok: false, errors: { note: true } });
    expect(validateManual({ value: "1", note: 7 })).toEqual({ ok: false, errors: { note: true } });
  });
});
