import { describe, expect, it } from "vitest";
import { configNumber, diffRows, isLastAdminError, parsePage, shareOf, summariseUsage, utcDayStart, validateCaps, type UsageRow } from "./admin-ops";

const valid = { chatTurns: "20", briefs: "3", globalSpend: "25", classification: "3", maxTokens: "2000" };

describe("validateCaps", () => {
  it("accepts values inside every range, decimals for the two budgets", () => {
    expect(validateCaps({ ...valid, globalSpend: "12.5", classification: "0,75" })).toEqual({
      ok: true,
      values: { chatTurns: 20, briefs: 3, globalSpend: 12.5, classification: 0.75, maxTokens: 2000 },
    });
  });
  it("accepts the bounds", () => {
    expect(validateCaps({ chatTurns: "0", briefs: "20", globalSpend: "500", classification: "0", maxTokens: "256" }).ok).toBe(true);
    expect(validateCaps({ chatTurns: "200", briefs: "0", globalSpend: "0", classification: "100", maxTokens: "8000" }).ok).toBe(true);
  });
  it("refuses values outside the range, field by field", () => {
    expect(validateCaps({ chatTurns: "201", briefs: "21", globalSpend: "500.01", classification: "-1", maxTokens: "255" })).toEqual({
      ok: false,
      errors: { chatTurns: "range", briefs: "range", globalSpend: "range", classification: "range", maxTokens: "range" },
    });
    expect(validateCaps({ ...valid, maxTokens: "8001" })).toEqual({ ok: false, errors: { maxTokens: "range" } });
  });
  it("refuses fractions where a whole number is needed, blanks and non-numbers", () => {
    expect(validateCaps({ ...valid, chatTurns: "2.5", briefs: "", maxTokens: "1e3" })).toEqual({
      ok: false,
      errors: { chatTurns: "integer", briefs: "required", maxTokens: "required" },
    });
    expect(validateCaps({})).toMatchObject({ ok: false });
  });
});

describe("summariseUsage", () => {
  const now = new Date("2026-11-15T10:00:00Z");
  const row = (over: Partial<UsageRow>): UsageRow => ({
    created_at: "2026-11-15T08:00:00Z",
    user_id: "u1",
    module: "chat",
    kind: "chat_turn",
    cost_usd: "0.010000",
    input_tokens: 100,
    output_tokens: 50,
    ...over,
  });
  const rows = [
    row({}),
    row({ cost_usd: 0.02 }),
    row({ kind: "brief", module: "advisor", cost_usd: "0.300000", user_id: "u2" }),
    row({ kind: "classification", module: "consumer_feeling", cost_usd: "0.001500", user_id: null }),
    row({ created_at: "2026-11-14T23:59:59Z", cost_usd: "1.000000" }),
    row({ created_at: "2026-10-01T00:00:00Z", cost_usd: "9.000000" }),
  ];
  const s = summariseUsage(rows, now);

  it("totals today on the UTC day, without float drift", () => {
    expect(s.today.cost).toBe(0.3315);
    expect(s.today.calls).toBe(4);
    expect(s.today.classificationCost).toBe(0.0015);
  });
  it("groups today by module and kind, most expensive first", () => {
    expect(s.today.byModuleKind).toEqual([
      { module: "advisor", kind: "brief", calls: 1, inputTokens: 100, outputTokens: 50, cost: 0.3 },
      { module: "chat", kind: "chat_turn", calls: 2, inputTokens: 200, outputTokens: 100, cost: 0.03 },
      { module: "consumer_feeling", kind: "classification", calls: 1, inputTokens: 100, outputTokens: 50, cost: 0.0015 },
    ]);
  });
  it("counts turns and briefs per user, and leaves out rows with no user", () => {
    expect(s.today.byUser).toEqual([
      { userId: "u1", chatTurns: 2, briefs: 0, cost: 0.03 },
      { userId: "u2", chatTurns: 0, briefs: 1, cost: 0.3 },
    ]);
  });
  it("returns 14 days oldest first, empty days included, older rows ignored", () => {
    expect(s.days).toHaveLength(14);
    expect(s.days[0].day).toBe("2026-11-02");
    expect(s.days[13]).toMatchObject({ day: "2026-11-15", calls: 4, cost: 0.3315 });
    expect(s.days[12]).toMatchObject({ day: "2026-11-14", calls: 1, cost: 1 });
    expect(s.days[12].byKind.chat_turn).toBe(1);
    expect(s.days[0]).toMatchObject({ calls: 0, cost: 0 });
  });
  it("utcDayStart crosses month boundaries", () => {
    expect(utcDayStart(new Date("2026-11-02T05:00:00Z"), 3).toISOString()).toBe("2026-10-30T00:00:00.000Z");
  });
});

describe("shareOf and configNumber", () => {
  it("clamps and refuses a missing or zero limit", () => {
    expect(shareOf(5, 20)).toBe(0.25);
    expect(shareOf(30, 20)).toBe(1);
    expect(shareOf(1, 0)).toBeNull();
    expect(shareOf(1, null)).toBeNull();
  });
  it("reads numbers only", () => {
    expect(configNumber({ a: 3, b: "3", c: true }, "a")).toBe(3);
    expect(configNumber({ a: 3, b: "3", c: true }, "b")).toBeNull();
    expect(configNumber({}, "x")).toBeNull();
  });
});

describe("diffRows", () => {
  it("keeps only the keys that differ", () => {
    expect(diffRows({ key: "ai.enabled", value: true, n: { a: 1 } }, { key: "ai.enabled", value: false, n: { a: 1 } })).toEqual([
      { key: "value", before: "true", after: "false" },
    ]);
  });
  it("shows every key of an insert or a delete against nothing", () => {
    expect(diffRows(null, { role: "member" })).toEqual([{ key: "role", before: null, after: "member" }]);
    expect(diffRows({ role: "member" }, null)).toEqual([{ key: "role", before: "member", after: null }]);
  });
  it("shortens long values", () => {
    const [c] = diffRows({ body: "" }, { body: "x".repeat(1000) });
    expect(c.after).toHaveLength(241);
  });
});

describe("parsePage and isLastAdminError", () => {
  it("falls back to page 1", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2", "9"])).toBe(2);
    for (const bad of [undefined, "0", "-1", "abc", "1.5"]) expect(parsePage(bad)).toBe(1);
  });
  it("recognises the trigger's message", () => {
    expect(isLastAdminError("the last admin cannot be demoted or removed")).toBe(true);
    expect(isLastAdminError("permission denied")).toBe(false);
    expect(isLastAdminError(null)).toBe(false);
  });
});
