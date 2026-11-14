import { beforeEach, describe, expect, it, vi } from "vitest";
import { numbersIn } from "../brief/citation-check";
import { gradeTurn, REFERENCE_QUESTIONS } from "./reference-questions";

vi.mock("server-only", () => ({}));
vi.mock("node:fs", async (orig) => ({ ...(await orig<typeof import("node:fs")>()), readFileSync: () => "PROMPT" }));

const state = vi.hoisted(() => ({ gate: "ok", usage: [] as Record<string, unknown>[] }));

vi.mock("@/lib/auth", () => ({ requireUser: async () => ({ userId: "u1", supabase: {} }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain = (data: unknown) => {
      const c: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit"]) c[m] = () => c;
      c.in = async () => ({ data, error: null });
      c.maybeSingle = async () => ({ data: { org_id: "o1" }, error: null });
      c.then = (res: (v: unknown) => unknown) => res({ data, error: null });
      return c;
    };
    return {
      rpc: async () => ({ data: state.gate, error: null }),
      from(table: string) {
        if (table === "app_config") return chain([{ key: "ai.model.orchestrator", value: "claude-sonnet-5-5" }, { key: "ai.max_tokens_per_chat_turn", value: 2000 }]);
        if (table === "usage") return { insert: async (r: Record<string, unknown>) => (state.usage.push(r), { error: null }) };
        return chain([{ slug: "cheese", name_it: "Formaggi", name_en: "Cheese", level: "city", is_pilot: true }]);
      },
    };
  },
}));
vi.mock("./tools", async (orig) => {
  const real = await orig<typeof import("./tools")>();
  return {
    ...real,
    runTool: async (_name: string, _input: unknown, _locale: string, reg: InstanceType<typeof real.FactRegistry>) => {
      const f = reg.add({ section: "market", label: "Crescita reale", display: "+0,4%", grade: "B", period: "2017–2022", method: "trend-v1", source: "Eurostat", observationIds: [1], snapshotRef: "trend_snapshots:1" });
      return { facts: [{ id: f.id, value: f.display }] };
    },
  };
});

import { chatTurn } from "./orchestrator";

const usage = { input_tokens: 500, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
const toolUse = (id: string, name: string, input: unknown) => ({ stop_reason: "tool_use", usage, content: [{ type: "tool_use", id, name, input }] });
const answer = (id: string, text: string, facts: string[]) => toolUse(id, "answer", { sentences: [{ text, facts }], follow_ups: [] });

function client(replies: unknown[]) {
  const calls: { messages: unknown[] }[] = [];
  return {
    calls,
    messages: {
      create: async (req: { messages: unknown[] }) => {
        calls.push({ messages: [...req.messages] });
        return replies[calls.length - 1];
      },
    },
  };
}

beforeEach(() => {
  state.gate = "ok";
  state.usage = [];
});

describe("chatTurn", () => {
  it("calls a tool, then accepts an answer whose figure is cited", async () => {
    const c = client([toolUse("a", "get_cell", { category: "cheese", territory: "roma" }), answer("b", "Il valore reale cresce del +0,4% annuo.", ["T1"])]);
    const r = await chatTurn("Formaggi a Roma?", [], "it", c as never);
    expect(r).toMatchObject({ ok: true, checked: "passed" });
    if (r.ok) {
      expect(r.facts.map((f) => f.id)).toEqual(["T1"]);
      expect(r.toolCalls).toEqual([{ name: "get_cell", input: { category: "cheese", territory: "roma" } }]);
    }
    expect(state.usage).toHaveLength(1);
    expect(state.usage[0]).toMatchObject({ kind: "chat_turn", input_tokens: 1000, output_tokens: 200 });
  });

  it("sends the failures back once, then accepts the corrected answer", async () => {
    const c = client([
      toolUse("a", "get_cell", { category: "cheese", territory: "roma" }),
      answer("b", "Il valore cresce del 2% annuo.", ["T1"]),
      answer("c", "Il valore reale cresce del +0,4% annuo.", ["T1"]),
    ]);
    const r = await chatTurn("Formaggi a Roma?", [], "it", c as never);
    expect(r).toMatchObject({ ok: true, checked: "passed" });
    expect(JSON.stringify(c.calls[2].messages.at(-1))).toMatch(/Rejected by the citation check/);
  });

  it("answers that the data is not available after a second failure", async () => {
    const c = client([answer("b", "Cresce del 7%.", []), answer("c", "Cresce del 7%.", [])]);
    const r = await chatTurn("Formaggi a Roma?", [], "it", c as never);
    expect(r).toMatchObject({ ok: true, checked: "unavailable" });
    if (r.ok) expect(numbersIn(r.answer.sentences[0].text)).toEqual([]);
  });

  it("does not call the model past the daily cap or the kill switch", async () => {
    state.gate = "user_limit";
    const c = client([]);
    expect(await chatTurn("Formaggi a Roma?", [], "it", c as never)).toEqual({ ok: false, reason: "user_limit" });
    expect(c.calls).toHaveLength(0);
  });
});

describe("gradeTurn", () => {
  const q1 = REFERENCE_QUESTIONS[0];
  it("passes a checked answer with the expected tool, slugs and kind of fact", () => {
    const r = gradeTurn(q1, { checked: "passed", answer: { sentences: [{ text: "x", facts: ["T1"] }] }, facts: [{ label: "Crescita annua del valore reale (CAGR)" }], toolCalls: [{ name: "get_cell", input: { category: "cheese", territory: "roma" } }] }, numbersIn);
    expect(r.passed).toBe(true);
  });
  it("fails a wrong city", () => {
    const r = gradeTurn(q1, { checked: "passed", answer: { sentences: [] }, facts: [{ label: "Crescita" }], toolCalls: [{ name: "get_cell", input: { category: "cheese", territory: "milano" } }] }, numbersIn);
    expect(r.reasons.join()).toMatch(/not called with/);
  });
  it("fails an out-of-scope answer that contains a figure", () => {
    const q10 = REFERENCE_QUESTIONS[9];
    const r = gradeTurn(q10, { checked: "unavailable", answer: { sentences: [{ text: "About 12 euros.", facts: [] }] }, facts: [], toolCalls: [] }, numbersIn);
    expect(r.passed).toBe(false);
  });
});

describe("strictSchema", () => {
  it("closes objects, requires every property and drops range keywords", async () => {
    const { strictSchema } = await import("./orchestrator");
    const { ToolInputs } = await import("./tools");
    const s = strictSchema(ToolInputs.rank_opportunities) as unknown as Record<string, unknown>;
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(["category", "country", "limit"]);
    expect(JSON.stringify(s)).not.toMatch(/maximum|pattern|\$schema/);
  });
});
