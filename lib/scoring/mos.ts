/**
 * Market Opportunity Score, `mos-v1` (module 06). Pure functions, shared by the compute pipeline
 * and the Opportunities screen's what-if re-ranking (the only arithmetic the browser does).
 *
 * MOS = sum(w_k * p_k) / sum(w_k) over the components k that are present, where p_k is the
 * component's percentile rank (0-100) among the cells that have it, and Pressure enters as
 * 100 - p. MOS exists only when Growth and Size are present. See docs/METHODS.md.
 */
import { derivedGrade, type Grade } from "./trend";

export const COMPONENTS = ["growth", "size", "csi", "pressure", "fit"] as const;
export type ComponentKey = (typeof COMPONENTS)[number];
export type Weights = Record<ComponentKey, number>;

export const DEFAULT_WEIGHTS: Weights = { growth: 0.3, size: 0.2, csi: 0.2, pressure: 0.15, fit: 0.15 };
export const REQUIRED: readonly ComponentKey[] = ["growth", "size"];

/** One component of one cell: its percentile rank and the grade of the figure behind it. */
export type ComponentValue = { pct: number; grade: Grade };
export type CellComponents = Partial<Record<ComponentKey, ComponentValue>>;

export type MosResult = {
  /** Null when a required component is missing. One decimal. */
  mos: number | null;
  /** Share of the total weight carried by present components, 0-100, one decimal. */
  coveragePct: number;
  isPartial: boolean;
  /** Weakest grade among the present weighted components, never better than B. Null when MOS is null. */
  grade: Grade | null;
  missing: ComponentKey[];
  /** Weighted points each present component adds to MOS, after renormalisation. */
  contributions: Partial<Record<ComponentKey, number>>;
};

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Percentile rank of each value among all values, 0-100, using mid-ranks for ties:
 * p = 100 * (below + (equal - 1) / 2) / (n - 1). A single value gets 50.
 */
export function percentileRanks<K>(values: Map<K, number>): Map<K, number> {
  const entries = [...values.entries()].filter(([, v]) => Number.isFinite(v));
  const n = entries.length;
  const out = new Map<K, number>();
  if (!n) return out;
  if (n === 1) {
    out.set(entries[0][0], 50);
    return out;
  }
  const sorted = entries.map(([, v]) => v).sort((a, b) => a - b);
  for (const [k, v] of entries) {
    let lo = 0;
    while (lo < n && sorted[lo] < v) lo++;
    let hi = lo;
    while (hi < n && sorted[hi] === v) hi++;
    const midRank = lo + (hi - lo - 1) / 2;
    out.set(k, round1((100 * midRank) / (n - 1)));
  }
  return out;
}

/** Validates a weight set: the five keys, each in [0, 1], summing to 1. */
export function validWeights(w: Partial<Weights>): w is Weights {
  if (!COMPONENTS.every((k) => typeof w[k] === "number" && w[k]! >= 0 && w[k]! <= 1)) return false;
  const sum = COMPONENTS.reduce((s, k) => s + (w[k] as number), 0);
  return Math.abs(sum - 1) < 1e-4;
}

export function scoreMos(c: CellComponents, weights: Weights = DEFAULT_WEIGHTS, required: readonly ComponentKey[] = REQUIRED): MosResult {
  const present = COMPONENTS.filter((k) => c[k] != null);
  const missing = COMPONENTS.filter((k) => c[k] == null);
  const totalWeight = COMPONENTS.reduce((s, k) => s + weights[k], 0);
  const presentWeight = present.reduce((s, k) => s + weights[k], 0);
  const coveragePct = totalWeight > 0 ? round1((100 * presentWeight) / totalWeight) : 0;

  if (required.some((k) => c[k] == null) || presentWeight <= 0) {
    return { mos: null, coveragePct, isPartial: true, grade: null, missing, contributions: {} };
  }
  const contributions: Partial<Record<ComponentKey, number>> = {};
  let sum = 0;
  for (const k of present) {
    const p = k === "pressure" ? 100 - c[k]!.pct : c[k]!.pct;
    const part = (weights[k] * p) / presentWeight;
    contributions[k] = round1(part);
    sum += part;
  }
  // Partial and grade follow the components that carry weight: a missing component with zero
  // weight changes nothing, and a zero-weight component does not lower the grade.
  return {
    mos: round1(sum),
    coveragePct,
    isPartial: missing.some((k) => weights[k] > 0),
    grade: derivedGrade(present.filter((k) => weights[k] > 0).map((k) => c[k]!.grade)),
    missing,
    contributions,
  };
}

/** Ranks cells by MOS, highest first; cells without a MOS are left out. Ties share a rank. */
export function rankByMos<K>(scores: Map<K, number | null>): Map<K, number> {
  const list = [...scores.entries()].filter((e): e is [K, number] => e[1] != null).sort((a, b) => b[1] - a[1]);
  const out = new Map<K, number>();
  list.forEach(([k, v], i) => out.set(k, i > 0 && v === list[i - 1][1] ? out.get(list[i - 1][0])! : i + 1));
  return out;
}
