import { readJsonStat, type JsonStat } from "../shared/jsonstat";
import { dayPeriod, yearPeriod, type ObservationInput } from "../shared/types";

export const FIRST_YEAR = 2015;

/**
 * Eurostat observation flags we do NOT turn into observations even when a value is present:
 * c confidential, z not applicable, f forecast (not a measurement). Everything else
 * (p provisional, e/s estimated, b break in series, d definition differs, u low reliability, ...)
 * is kept: the figure is Eurostat's own and the flag is stored with it (observations.status_flag).
 */
const SKIPPED_FLAGS = new Set(["c", "z", "f"]);

export type MapOptions = {
  dataset: string;
  indicator: string;
  /** Territory slug for the row, or null when the geography is not one we asked for (ignored). */
  territory: (row: Record<string, string>) => string | null;
  seriesKey: (row: Record<string, string>) => string;
  period: (year: number) => { periodStart: string; periodEnd: string };
  /** Multiplier applied to the Eurostat value when its unit differs from the indicator unit. */
  scale?: number;
  /** Seen flags are counted here so the connector can report them. */
  flags?: Map<string, number>;
};

/** Dimensions that identify the figure, in dataset order, without frequency and time. */
function pinnedFilters(doc: JsonStat, row: Record<string, string>) {
  return doc.id
    .filter((d) => d !== "freq" && d !== "time")
    .map((d) => `${d}=${row[d]}`)
    .concat(`time=${row.time}`)
    .join("&");
}

export function mapJsonStat(doc: JsonStat, o: MapOptions): ObservationInput[] {
  const { rows } = readJsonStat(doc);
  const out: ObservationInput[] = [];
  for (const row of rows) {
    if (row.flag && o.flags) {
      const k = `${o.dataset}:${row.flag}`;
      o.flags.set(k, (o.flags.get(k) ?? 0) + 1);
    }
    if (row.flag && SKIPPED_FLAGS.has(row.flag)) continue;
    if (!/^\d{4}$/.test(row.time)) continue; // not an annual period
    const year = Number(row.time);
    if (year < FIRST_YEAR) continue;
    const territory = o.territory(row);
    if (!territory) continue;
    out.push({
      category: null,
      territory,
      indicator: o.indicator,
      seriesKey: o.seriesKey(row),
      ...o.period(year),
      value: o.scale ? row.value * o.scale : row.value,
      grade: "A",
      ...(row.flag ? { flag: row.flag } : {}),
      sourceRef: `${o.dataset}?${pinnedFilters(doc, row)}`,
    });
  }
  return out;
}

export const annual = (year: number) => yearPeriod(year);
export const firstOfJanuary = (year: number) => dayPeriod(`${year}-01-01`);
