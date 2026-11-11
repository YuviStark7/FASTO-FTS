import type { Taxonomy } from "./taxonomy";
import type { Grade, ObservationInput } from "./types";

export const NORMALISE_METHOD = "normalise-v1";

export type ObservationRow = {
  category_id: number | null;
  territory_id: number;
  indicator_id: number;
  series_key: string;
  period_start: string;
  period_end: string;
  value: number;
  low: number | null;
  high: number | null;
  unit: string;
  grade: Grade;
  source_id: number;
  run_id: number | null;
  method_version_id: string;
  is_demo: boolean;
  source_ref: string;
};

export type Rejected = { input: ObservationInput; reason: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates connector output and maps it onto the observations table.
 * Never repairs a value: anything doubtful is rejected with a reason and logged on the run.
 */
export function normalise(
  inputs: ObservationInput[],
  taxonomy: Taxonomy,
  ctx: { source: string; runId: number | null; isDemo?: boolean },
): { rows: ObservationRow[]; rejected: Rejected[] } {
  const source = taxonomy.sources.get(ctx.source);
  if (!source) throw new Error(`unknown source ${ctx.source}`);
  const rows = new Map<string, ObservationRow>();
  const rejected: Rejected[] = [];

  for (const input of inputs) {
    const reason = check(input, taxonomy);
    if (reason) {
      rejected.push({ input, reason });
      continue;
    }
    const indicator = taxonomy.indicators.get(input.indicator)!;
    const row: ObservationRow = {
      category_id: input.category ? taxonomy.categories.get(input.category)!.id : null,
      territory_id: taxonomy.territories.get(input.territory)!.id,
      indicator_id: indicator.id,
      series_key: input.seriesKey ?? "",
      period_start: input.periodStart,
      period_end: input.periodEnd,
      value: input.value,
      low: input.low ?? null,
      high: input.high ?? null,
      unit: input.unit ?? indicator.unit,
      grade: input.grade ?? source.default_grade,
      source_id: source.id,
      run_id: ctx.runId,
      method_version_id: NORMALISE_METHOD,
      is_demo: ctx.isDemo ?? false,
      source_ref: input.sourceRef,
    };
    // Deduplicate inside one batch on the natural key; the last value wins.
    const key = [row.category_id, row.territory_id, row.indicator_id, row.series_key, row.period_start, row.period_end].join("|");
    rows.set(key, row);
  }
  return { rows: [...rows.values()], rejected };
}

function check(o: ObservationInput, t: Taxonomy): string | null {
  if (o.category !== null && !t.categories.has(o.category)) return `unknown category ${o.category}`;
  if (!t.territories.has(o.territory)) return `unknown territory ${o.territory}`;
  if (!t.indicators.has(o.indicator)) return `unknown indicator ${o.indicator}`;
  if (!ISO.test(o.periodStart) || !ISO.test(o.periodEnd)) return "period is not an ISO date";
  if (o.periodEnd < o.periodStart) return "period ends before it starts";
  if (typeof o.value !== "number" || !Number.isFinite(o.value)) return "value is not a finite number";
  if (o.low != null && (!Number.isFinite(o.low) || o.low > o.value)) return "low bound above value";
  if (o.high != null && (!Number.isFinite(o.high) || o.high < o.value)) return "high bound below value";
  if (o.grade && !["A", "B", "C"].includes(o.grade)) return `bad grade ${o.grade}`;
  if (!o.sourceRef || o.sourceRef.length > 1000) return "missing or oversized sourceRef";
  return null;
}
