import { COMPONENTS, type ComponentKey, type Weights } from "@/lib/scoring/mos";

/** Slider positions, 0-100 each. They are relative: only their proportions matter. */
export type Sliders = Record<ComponentKey, number>;

const UNITS = 10_000; // weights are kept to four decimals

export const toSliders = (w: Weights): Sliders =>
  Object.fromEntries(COMPONENTS.map((k) => [k, Math.round(w[k] * UNITS) / (UNITS / 100)])) as Sliders;

/**
 * Slider positions as weights that sum to exactly 1 (four decimals, the rounding remainder goes to
 * the largest weight), so a saved set passes `validWeights` and the table's check. Null when every
 * slider is at zero: there is nothing to weigh.
 */
export function normaliseWeights(s: Sliders): Weights | null {
  const sum = COMPONENTS.reduce((a, k) => a + Math.max(0, s[k]), 0);
  if (!(sum > 0)) return null;
  const units = COMPONENTS.map((k) => Math.round((Math.max(0, s[k]) / sum) * UNITS));
  const largest = units.indexOf(Math.max(...units));
  units[largest] += UNITS - units.reduce((a, b) => a + b, 0);
  return Object.fromEntries(COMPONENTS.map((k, i) => [k, units[i] / UNITS])) as Weights;
}

export const sameWeights = (a: Weights, b: Weights) => COMPONENTS.every((k) => Math.abs(a[k] - b[k]) < 1 / UNITS / 2);

/** Fill of each component in the stacked bar and beside its name. The words and points carry the meaning. */
export const SEGMENT: Record<ComponentKey, string> = {
  growth: "bg-[var(--chart-1)]",
  size: "bg-[var(--chart-3)]",
  csi: "bg-[var(--chart-2)]",
  pressure: "bg-muted",
  fit: "bg-border-strong",
};
