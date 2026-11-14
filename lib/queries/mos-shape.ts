import { COMPONENTS, type CellComponents, type ComponentKey, type Weights } from "@/lib/scoring/mos";
import type { Database } from "@/lib/database.types";

/**
 * Shape of `mos_snapshots.components` (written by pipelines/compute, mos-v1) and of a weight set,
 * parsed defensively. Nothing is computed here: a field that is absent stays null (product rule 2).
 * Client-safe: no database access.
 */
export type Grade = Database["public"]["Enums"]["grade"];

export type MosPart = { raw: number | null; pct: number | null };
export type MosComponent = {
  present: boolean;
  /** Percentile rank 0-100 among the cells that have the component. */
  pct: number | null;
  /** The figure behind the percentile, in its own unit. Pressure has two parts instead. */
  raw: number | null;
  grade: Grade | null;
  /** Points the component adds to the stored MOS (default weights, after renormalisation). */
  contribution: number | null;
};
export type MosComponents = Record<ComponentKey, MosComponent> & {
  pressureParts: { competitors: MosPart; barriersPerMention: MosPart };
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const grade = (v: unknown): Grade | null => (v === "A" || v === "B" || v === "C" ? v : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const part = (v: unknown): MosPart => ({ raw: num(obj(v).raw), pct: num(obj(v).pct) });

export function parseMosComponents(json: unknown): MosComponents {
  const root = obj(json);
  const one = (k: ComponentKey): MosComponent => {
    const c = obj(root[k]);
    const pct = num(c.pct);
    const g = grade(c.grade);
    // Present only with both a percentile and a grade: a number without a grade is not shown.
    return { present: c.present === true && pct != null && g != null, pct, raw: num(c.raw), grade: g, contribution: num(c.contribution) };
  };
  const pressure = obj(root.pressure);
  return {
    growth: one("growth"),
    size: one("size"),
    csi: one("csi"),
    pressure: one("pressure"),
    fit: one("fit"),
    pressureParts: { competitors: part(pressure.competitors), barriersPerMention: part(pressure.barriers_per_mention) },
  };
}

/** The input of `scoreMos`: only the components that are present. */
export function toCellComponents(c: MosComponents): CellComponents {
  const out: CellComponents = {};
  for (const k of COMPONENTS) {
    const x = c[k];
    if (x.present && x.pct != null && x.grade != null) out[k] = { pct: x.pct, grade: x.grade };
  }
  return out;
}

/** A stored weight set, or null when it is not the five numbers the method expects. */
export function parseWeights(json: unknown): Weights | null {
  const w = obj(json);
  const out = {} as Weights;
  for (const k of COMPONENTS) {
    const v = w[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
    out[k] = v;
  }
  return out;
}
