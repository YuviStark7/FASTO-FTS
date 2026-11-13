import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeMos } from "./compute";

type Row = Record<string, unknown>;

function fakeDb() {
  const inserted: Row[] = [];
  const cellUpdates: Row[] = [];
  const db = {
    from(table: string) {
      if (table === "weight_sets") {
        const c: Record<string, unknown> = {};
        for (const m of ["select", "is", "eq"]) c[m] = () => c;
        c.single = async () => ({ data: { id: 1, weights: { growth: 0.3, size: 0.2, csi: 0.2, pressure: 0.15, fit: 0.15 } }, error: null });
        return c;
      }
      if (table === "mos_snapshots")
        return {
          insert: (rows: Row[]) => {
            inserted.push(...rows);
            return { select: async () => ({ data: rows.map((r, i) => ({ id: i + 1, category_id: r.category_id, territory_id: r.territory_id })), error: null }) };
          },
        };
      if (table === "cells")
        return {
          update: (row: Row) => {
            cellUpdates.push(row);
            const c = { eq: () => c, then: (res: (v: unknown) => unknown) => res({ error: null }) };
            return c;
          },
        };
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { db: db as unknown as SupabaseClient, inserted, cellUpdates };
}

const cell = (key: string, o: { cagr?: number; size?: number; csi?: number; barriers?: number; competitors?: number | null }) => ({
  catId: 1,
  cityId: Number(key.slice(1)),
  key,
  trend: { id: 10, grade: o.cagr == null ? null : ("B" as const), realCagr: o.cagr ?? null },
  geo: o.size == null ? null : { id: 20, value: o.size },
  csi: o.csi == null ? undefined : { id: 30, published: true, csi: o.csi, barrierRate: o.barriers ?? null },
  competitors: o.competitors ?? null,
});

describe("computeMos", () => {
  it("scores cells with growth and size, labels partial ones, and never scores without size", async () => {
    const { db, inserted, cellUpdates } = fakeDb();
    await computeMos(
      db,
      [
        cell("c1", { cagr: 0.05, size: 300, csi: 70, barriers: 0.1, competitors: 40 }),
        cell("c2", { cagr: 0.01, size: 100, competitors: 10 }),
        cell("c3", { cagr: 0.03 }),
      ],
      () => {},
    );
    expect(inserted).toHaveLength(3);
    const [a, b, c] = inserted;
    expect(a.mos).not.toBeNull();
    expect(a.grade).toBe("C"); // CSI and pressure are grade C
    expect(b.is_partial).toBe(true);
    expect(b.grade).toBe("C"); // pressure present
    expect(c.mos).toBeNull();
    expect(c.grade).toBeNull();
    expect(c.rank).toBeNull();
    expect((c.components as { size: { present: boolean } }).size.present).toBe(false);
    expect((a.components as { fit: { present: boolean } }).fit.present).toBe(false);
    expect(a.rank).toBe(1);
    expect(cellUpdates[2]).toMatchObject({ mos: null, mos_is_partial: null, mos_grade: null });
  });

  it("does not let an unpublished CSI count", async () => {
    const { db, inserted } = fakeDb();
    const x = cell("c1", { cagr: 0.02, size: 10, csi: 90 });
    x.csi!.published = false;
    await computeMos(db, [x, cell("c2", { cagr: 0.01, size: 20 })], () => {});
    expect((inserted[0].components as { csi: { present: boolean } }).csi.present).toBe(false);
    expect((inserted[0].input_snapshot_ids as { csi_snapshot_id: number | null }).csi_snapshot_id).toBeNull();
  });
});
