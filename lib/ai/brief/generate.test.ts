import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FactPack } from "./types";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  role: "analyst" as "analyst" | "admin" | null,
  gate: "ok",
  inserts: {} as Record<string, Record<string, unknown>[]>,
  updates: [] as Record<string, unknown>[],
  existing: null as null | { id: number; status: string },
  pack: null as FactPack | null,
}));

vi.mock("@/lib/admin", () => ({ getStaffRole: async () => ({ userId: "u1", role: state.role }) }));
vi.mock("./facts", () => ({ buildFactPack: async () => state.pack }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain = (data: unknown) => {
      const c: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit"]) c[m] = () => c;
      c.single = async () => ({ data, error: null });
      c.maybeSingle = async () => ({ data, error: null });
      return c;
    };
    return {
      rpc: async () => ({ data: state.gate, error: null }),
      from(table: string) {
        const base =
          table === "app_config" ? chain({ value: "claude-sonnet-5-5" })
          : table === "memberships" ? chain({ org_id: "o1" })
          : table === "categories" || table === "territories" ? chain({ id: 7 })
          : table === "briefs" ? chain(state.existing)
          : chain(null);
        return Object.assign(base, {
          insert: (row: Record<string, unknown> | Record<string, unknown>[]) => {
            (state.inserts[table] ??= []).push(...(Array.isArray(row) ? row : [row]));
            const id = state.inserts[table].length;
            const r = { select: () => ({ single: async () => ({ data: { id }, error: null }) }), then: (res: (v: unknown) => unknown) => res({ error: null }) };
            return r;
          },
          update: (row: Record<string, unknown>) => {
            state.updates.push(row);
            return { eq: async () => ({ error: null }) };
          },
        });
      },
    };
  },
}));

import { generateBrief } from "./generate";

const pack: FactPack = {
  locale: "it",
  category: "Formaggi",
  territory: "Roma",
  country: "Italia",
  status: "consolidated",
  statusRule: "between thresholds",
  missingInputs: [],
  representativenessNote: null,
  isDemo: false,
  facts: [
    { id: "F1", section: "market", label: "Crescita reale", display: "+1,2%", grade: "B", period: "2019–2024", method: "trend-v1", source: "Eurostat", observationIds: [11, 12], snapshotRef: "trend_snapshots:3" },
    { id: "F2", section: "entry", label: "MOS", display: "62", grade: "C", period: "2026-11-13", method: "mos-v1", source: "mos-v1", observationIds: [], snapshotRef: "mos_snapshots:4" },
  ],
};

const reply = (sentences: { text: string; facts: string[] }[]) => ({
  stop_reason: "end_turn",
  usage: { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  content: [{ type: "text", text: JSON.stringify({ sections: [{ key: "market", heading: "Mercato", sentences }] }) }],
});

function client(replies: ReturnType<typeof reply>[]) {
  const calls: unknown[] = [];
  return { calls, messages: { create: async (req: unknown) => (calls.push(req), replies[Math.min(calls.length - 1, replies.length - 1)]) } };
}

beforeEach(() => {
  state.role = "analyst";
  state.gate = "ok";
  state.inserts = {};
  state.updates = [];
  state.existing = null;
  state.pack = pack;
});

describe("generateBrief", () => {
  it("retries once with the failures, drops what still fails, and stores a version that passes", async () => {
    const c = client([
      reply([{ text: "Il valore reale cresce del 5%.", facts: ["F1"] }]),
      reply([
        { text: "Il valore reale cresce del +1,2% annuo dal 2019 al 2024.", facts: ["F1"] },
        { text: "Il punteggio è circa 60.", facts: ["F2"] },
      ]),
    ]);
    const r = await generateBrief("cheese", "roma", "it", c as never);
    expect(r).toMatchObject({ ok: true, version: 1, dropped: 1 });
    expect(c.calls).toHaveLength(2);
    expect(JSON.stringify((c.calls[1] as { messages: { content: string }[] }).messages[0].content)).toMatch(/failed the citation check/);

    const v = state.inserts.brief_versions[0];
    expect(v.citation_check_passed).toBe(true);
    expect(v.prompt_version).toBe("brief.v1");
    const content = v.content as { sections: { sentences: unknown[] }[]; dropped: unknown[] };
    expect(content.sections[0].sentences).toHaveLength(1);
    expect(content.dropped).toHaveLength(1);

    // One usage row for both calls, priced, counted once against the daily cap.
    expect(state.inserts.usage).toHaveLength(1);
    expect(state.inserts.usage[0]).toMatchObject({ kind: "brief", module: "06", input_tokens: 2000, output_tokens: 1000 });
    expect(Number(state.inserts.usage[0].cost_usd)).toBeGreaterThan(0);

    // Citations: the snapshot and each input observation of the cited fact.
    const cites = state.inserts.brief_citations;
    expect(cites.map((x) => x.snapshot_ref ?? x.observation_id)).toEqual(["trend_snapshots:3", 11, 12]);
    expect(state.updates.at(-1)).toMatchObject({ status: "draft" });
  });

  it("refuses non-staff users before any call", async () => {
    state.role = null;
    const c = client([reply([])]);
    expect(await generateBrief("cheese", "roma", "it", c as never)).toEqual({ ok: false, reason: "not_staff" });
    expect(c.calls).toHaveLength(0);
  });

  it("stops at the daily cap or the kill switch without a call", async () => {
    state.gate = "user_limit";
    const c = client([reply([])]);
    expect(await generateBrief("cheese", "roma", "it", c as never)).toEqual({ ok: false, reason: "user_limit" });
    expect(c.calls).toHaveLength(0);
  });

  it("does not call the model for a cell with no facts", async () => {
    state.pack = { ...pack, facts: [] };
    const c = client([reply([])]);
    expect(await generateBrief("cheese", "roma", "it", c as never)).toEqual({ ok: false, reason: "no_facts" });
    expect(c.calls).toHaveLength(0);
  });

  it("keeps a published brief on its published version", async () => {
    state.existing = { id: 5, status: "published" };
    const c = client([reply([{ text: "Il mercato è stabile.", facts: [] }])]);
    const r = await generateBrief("cheese", "roma", "it", c as never);
    expect(r.ok).toBe(true);
    expect(state.updates).toHaveLength(0);
  });
});
