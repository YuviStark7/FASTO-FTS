/**
 * Module 02, Trend Analyzer. Method trend-v1 (docs/METHODS.md).
 * Pure functions: no I/O, no model calls. Every number in a trend snapshot comes from here.
 */

export type Grade = "A" | "B" | "C";
export type TrendStatus = "expanding" | "consolidated" | "threatened" | "insufficient_data";

export type TrendParams = {
  expanding_min_real_cagr: number;
  threatened_max_cagr: number;
  min_annual_points: number;
  max_years: number;
};

/** Year -> value. */
export type Series = Map<number, number>;

export type ClassInputs = {
  /** ECOICOP class, e.g. "CP01153". */
  coicop: string;
  /** HFCE group the class belongs to, e.g. "CP011". */
  group: string;
  /** HICP weight of the class, per mille, by year. */
  weight: Series;
  /** HICP annual average index of the class, by year. */
  price: Series;
};

export type CategoryInputs = {
  classes: ClassInputs[];
  /** Household final consumption, current prices, by HFCE group code, by year (EUR million). */
  hfceByGroup: Map<string, Series>;
  /** HICP weight of each HFCE group, per mille, by year. */
  groupWeight: Map<string, Series>;
  /** All-items HICP, by year: the general deflator for real value. */
  allItemsPrice: Series;
};

export type TrendPoint = {
  year: number;
  /** Category spending, current prices, EUR million (model estimate). */
  nominal: number;
  /** Nominal deflated by all-items HICP, base = index base year. */
  real: number;
  /** Nominal deflated by the category's own HICP: a constant-price volume. */
  volume: number;
  /** Category price index (weight-averaged across its classes). */
  priceIndex: number;
};

export type TrendResult = {
  status: TrendStatus;
  grade: Grade | null;
  realCagr: number | null;
  volumeCagr: number | null;
  nominalCagr: number | null;
  firstYear: number | null;
  lastYear: number | null;
  reason: string;
  series: TrendPoint[];
};

/**
 * Category spending series. For each year where every input exists:
 *   nominal = sum over classes of HFCE[group] x weight[class] / weight[group]
 *   priceIndex = weight-averaged class price index
 */
export function buildCategorySeries(inp: CategoryInputs): TrendPoint[] {
  if (!inp.classes.length) return [];
  const years = [...inp.allItemsPrice.keys()].sort((a, b) => a - b);
  const out: TrendPoint[] = [];
  for (const y of years) {
    let nominal = 0;
    let wSum = 0;
    let pSum = 0;
    let complete = true;
    for (const c of inp.classes) {
      const hfce = inp.hfceByGroup.get(c.group)?.get(y);
      const gw = inp.groupWeight.get(c.group)?.get(y);
      const w = c.weight.get(y);
      const p = c.price.get(y);
      if (hfce == null || gw == null || w == null || p == null || gw <= 0 || p <= 0) {
        complete = false;
        break;
      }
      nominal += (hfce * w) / gw;
      wSum += w;
      pSum += w * p;
    }
    const all = inp.allItemsPrice.get(y);
    if (!complete || all == null || all <= 0 || wSum <= 0) continue;
    const priceIndex = pSum / wSum;
    out.push({ year: y, nominal, real: (nominal / all) * 100, volume: (nominal / priceIndex) * 100, priceIndex });
  }
  return out;
}

export function cagr(first: number, last: number, years: number): number | null {
  if (years <= 0 || first <= 0 || last <= 0) return null;
  return Math.pow(last / first, 1 / years) - 1;
}

/** The latest run of consecutive years, capped at max_years + 1 points (max_years of growth). */
export function latestWindow(points: TrendPoint[], maxYears: number): TrendPoint[] {
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const run: TrendPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (run.length && sorted[i].year !== run[0].year - 1) break;
    run.unshift(sorted[i]);
    if (run.length === maxYears + 1) break;
  }
  return run;
}

const GRADE_RANK: Record<Grade, number> = { A: 0, B: 1, C: 2 };

/** The weakest grade of the inputs, and never better than B for a derived figure. */
export function derivedGrade(inputGrades: Grade[]): Grade | null {
  if (!inputGrades.length) return null;
  const worst = inputGrades.reduce((a, b) => (GRADE_RANK[b] > GRADE_RANK[a] ? b : a));
  return GRADE_RANK[worst] < GRADE_RANK.B ? "B" : worst;
}

export function classifyTrend(points: TrendPoint[], inputGrades: Grade[], p: TrendParams): TrendResult {
  const window = latestWindow(points, p.max_years);
  const empty = {
    realCagr: null,
    volumeCagr: null,
    nominalCagr: null,
    firstYear: window[0]?.year ?? null,
    lastYear: window.at(-1)?.year ?? null,
    series: points,
  };
  if (inputGrades.length && inputGrades.every((g) => g === "C")) {
    return { ...empty, status: "insufficient_data", grade: null, reason: "only grade C inputs" };
  }
  if (window.length < p.min_annual_points) {
    return {
      ...empty,
      status: "insufficient_data",
      grade: null,
      reason: `${window.length} consecutive annual points, at least ${p.min_annual_points} needed`,
    };
  }
  const first = window[0];
  const last = window.at(-1)!;
  const years = last.year - first.year;
  const realCagr = cagr(first.real, last.real, years);
  const volumeCagr = cagr(first.volume, last.volume, years);
  const nominalCagr = cagr(first.nominal, last.nominal, years);
  if (realCagr == null || volumeCagr == null) {
    return { ...empty, status: "insufficient_data", grade: null, reason: "non-positive values in the window" };
  }

  let status: TrendStatus;
  let reason: string;
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
  if (realCagr >= p.expanding_min_real_cagr && volumeCagr >= 0) {
    status = "expanding";
    reason = `real value CAGR ${pct(realCagr)} >= ${pct(p.expanding_min_real_cagr)} and volume CAGR ${pct(volumeCagr)} not falling`;
  } else if (realCagr <= p.threatened_max_cagr || volumeCagr <= p.threatened_max_cagr) {
    status = "threatened";
    reason = `${realCagr <= p.threatened_max_cagr ? `real value CAGR ${pct(realCagr)}` : `volume CAGR ${pct(volumeCagr)}`} <= ${pct(p.threatened_max_cagr)}`;
  } else {
    status = "consolidated";
    reason = `real value CAGR ${pct(realCagr)}, volume CAGR ${pct(volumeCagr)}: between the thresholds`;
  }
  return {
    status,
    grade: derivedGrade(inputGrades),
    realCagr,
    volumeCagr,
    nominalCagr,
    firstYear: first.year,
    lastYear: last.year,
    reason: `${reason} (${first.year}-${last.year})`,
    series: points,
  };
}
