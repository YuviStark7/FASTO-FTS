import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONCURRENCY, scoreMentions } from "./score";

type Row = Record<string, unknown>;

/** Just enough of the Supabase client for scoreMentions: every chain resolves to { data, error }. */
function fakeDb(opts: { mentions: number; gate?: string; budget?: number; spentToday?: number; model?: string }) {
  const usage: Row[] = opts.spentToday ? [{ cost_usd: opts.spentToday }] : [];
  const scores: Row[] = [];
  const config = [
    { key: "ai.model.classifier", value: opts.model ?? "claude-haiku-5-5" },
    { key: "ai.daily_classification_budget_usd", value: opts.budget ?? 3 },
  ];
  const mentions = Array.from({ length: opts.mentions }, (_, i) => ({
    id: i + 1,
    language: "it",
    excerpt: `testo ${i + 1}`,
    categories: { slug: "cheese" },
  }));
  const chain = (data: unknown) => {
    const c: Record<string, unknown> = {};
    let after = -Infinity;
    let max = Infinity;
    for (const m of ["select", "in", "is", "order", "eq", "gte"]) c[m] = () => c;
    c.gt = (_col: string, v: number) => ((after = v), c);
    c.limit = (n: number) => ((max = n), c);
    c.then = (res: (v: unknown) => unknown) => {
      const rows = Array.isArray(data) ? (data as { id?: number }[]).filter((r) => r.id == null || r.id > after).slice(0, max) : data;
      return res({ data: rows, error: null });
    };
    return c;
  };
  const db = {
    from(table: string) {
      if (table === "app_config") return chain(config);
      if (table === "mentions") return chain(mentions);
      if (table === "usage")
        return Object.assign(chain(usage), {
          insert: async (row: Row) => {
            usage.push(row);
            return { error: null };
          },
        });
      if (table === "mention_scores")
        return {
          upsert: async (rows: Row[]) => {
            scores.push(...rows);
            return { error: null };
          },
        };
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async () => ({ data: opts.gate ?? "ok", error: null }),
  };
  return { db: db as unknown as SupabaseClient, usage, scores };
}

const usageBlock = { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

function client(reply: (ids: number[]) => { stop_reason: string; text: string }) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    messages: {
      create: async (req: { messages: { content: string }[] }) => {
        calls++;
        const ids = (JSON.parse(req.messages[0].content) as { id: number }[]).map((m) => m.id);
        const r = reply(ids);
        return { stop_reason: r.stop_reason, usage: usageBlock, content: [{ type: "text", text: r.text }] };
      },
    },
  };
}

const good = (ids: number[]) => ({
  stop_reason: "end_turn",
  text: JSON.stringify({
    results: ids.map((id) => ({ id, relevant: true, liking: 70, desirability: 60, trust: 55, perceived_value: 50, purchase_intent: 65, levers: [], barriers: [] })),
  }),
});

describe("scoreMentions", () => {
  it("scores in batches of 20 and logs spend for every call", async () => {
    const { db, usage, scores } = fakeDb({ mentions: 45 });
    const c = client(good);
    const r = await scoreMentions(db, () => {}, 2000, c as never);
    expect(r).toEqual({ scored: 45, skipped: null });
    expect(c.calls).toBe(3);
    expect(usage).toHaveLength(3);
    expect(scores).toHaveLength(45);
    expect(Number(usage[0].cost_usd)).toBeGreaterThan(0);
  });

  it("logs spend for billed calls whose output is unusable, and stops after repeated failures", async () => {
    const { db, usage, scores } = fakeDb({ mentions: 200 });
    const c = client(() => ({ stop_reason: "max_tokens", text: "{" }));
    const r = await scoreMentions(db, () => {}, 2000, c as never);
    expect(r.skipped).toBe("failures");
    // One round of parallel batches, every billed call logged, then the run stops.
    expect(c.calls).toBe(CONCURRENCY);
    expect(usage).toHaveLength(CONCURRENCY);
    expect(scores).toHaveLength(0);
  });

  it("treats schema mismatches as failures with logged spend", async () => {
    const { db, usage } = fakeDb({ mentions: 20 });
    const c = client(() => ({ stop_reason: "end_turn", text: JSON.stringify({ results: [{ id: 1 }] }) }));
    await scoreMentions(db, () => {}, 2000, c as never);
    expect(usage).toHaveLength(1);
  });

  it("pages past 1000 mentions with an id cursor", async () => {
    const { db, scores } = fakeDb({ mentions: 2300 });
    const c = client(good);
    const r = await scoreMentions(db, () => {}, 50_000, c as never);
    expect(r).toEqual({ scored: 2300, skipped: null });
    expect(scores).toHaveLength(2300);
    expect(new Set(scores.map((x) => x.mention_id)).size).toBe(2300);
  });

  it("does not call the model when the kill switch or global limit says no", async () => {
    const { db, usage } = fakeDb({ mentions: 20, gate: "disabled" });
    const c = client(good);
    const r = await scoreMentions(db, () => {}, 2000, c as never);
    expect(r).toEqual({ scored: 0, skipped: "disabled" });
    expect(c.calls).toBe(0);
    expect(usage).toHaveLength(0);
  });

  it("stops at the daily classification budget", async () => {
    const { db } = fakeDb({ mentions: 20, budget: 3, spentToday: 3 });
    const c = client(good);
    const r = await scoreMentions(db, () => {}, 2000, c as never);
    expect(r.skipped).toBe("classification_budget");
    expect(c.calls).toBe(0);
  });

  it("refuses a model with no known price before any call", async () => {
    const { db } = fakeDb({ mentions: 20, model: "claude-unknown" });
    const c = client(good);
    await expect(scoreMentions(db, () => {}, 2000, c as never)).rejects.toThrow(/no price/);
    expect(c.calls).toBe(0);
  });

  it("does nothing without a key or client", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const { db } = fakeDb({ mentions: 20 });
    expect(await scoreMentions(db, () => {})).toEqual({ scored: 0, skipped: "no_key" });
    if (saved) process.env.ANTHROPIC_API_KEY = saved;
  });
});
