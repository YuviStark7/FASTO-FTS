/**
 * Module 03, Geo Market. Method geo-v1 (docs/METHODS.md).
 * Local demand is always a model estimate (grade B) with an interval.
 */

export type Range = { low: number; mid: number; high: number };

export type GeoParams = {
  income_elasticity: Range;
  tourist_food_share: Range;
  pos_elasticity: Range;
  days_per_year: number;
};

export type GeoInputs = {
  /** National category spending for the year, EUR. */
  nationalSpend: number;
  nationalPopulation: number;
  cityPopulation: number;
  /** Disposable income per capita of the city's region and of the country. */
  regionalIncomePc?: number | null;
  nationalIncomePc?: number | null;
  /** Nights spent in tourist accommodation in the city's tourism unit. */
  touristNights?: number | null;
  /** Relevant shops per 10,000 residents in the city, and the reference (national pilot median). */
  cityPosDensity?: number | null;
  refPosDensity?: number | null;
};

export type Factor = { value: number; low: number; high: number; basis: string; missing?: boolean };

export type GeoResult = {
  value: number;
  low: number;
  high: number;
  base: number;
  perCapita: number;
  factors: { income: Factor; tourism: Factor; pos: Factor };
  missing: string[];
};

const neutral = (basis: string): Factor => ({ value: 1, low: 1, high: 1, basis, missing: true });

function spread(f: (x: number) => number, r: Range, basis: string): Factor {
  const a = f(r.low);
  const b = f(r.high);
  return { value: f(r.mid), low: Math.min(a, b), high: Math.max(a, b), basis };
}

/** Returns null when the core inputs (national spend and both populations) are missing. */
export function estimateLocalDemand(inp: GeoInputs, p: GeoParams): GeoResult | null {
  const ok = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x) && x > 0;
  if (!ok(inp.nationalSpend) || !ok(inp.nationalPopulation) || !ok(inp.cityPopulation)) return null;

  const perCapita = inp.nationalSpend / inp.nationalPopulation;
  const base = perCapita * inp.cityPopulation;
  const missing: string[] = [];

  let income: Factor;
  if (ok(inp.regionalIncomePc) && ok(inp.nationalIncomePc)) {
    const ratio = inp.regionalIncomePc / inp.nationalIncomePc;
    income = spread((e) => Math.pow(ratio, e), p.income_elasticity, `regional/national income ratio ${ratio.toFixed(3)}`);
  } else {
    income = neutral("regional income not available");
    missing.push("income");
  }

  let tourism: Factor;
  if (typeof inp.touristNights === "number" && Number.isFinite(inp.touristNights) && inp.touristNights >= 0) {
    const share = inp.touristNights / (p.days_per_year * inp.cityPopulation);
    tourism = spread((s) => 1 + s * share, p.tourist_food_share, `tourist presence ${(share * 100).toFixed(2)}% of resident-days`);
  } else {
    tourism = neutral("tourist nights not available");
    missing.push("tourism");
  }

  let pos: Factor;
  if (ok(inp.cityPosDensity) && ok(inp.refPosDensity)) {
    const ratio = inp.cityPosDensity / inp.refPosDensity;
    pos = spread((g) => Math.pow(ratio, g), p.pos_elasticity, `shop density ratio ${ratio.toFixed(3)}`);
  } else {
    pos = neutral("shop density not available");
    missing.push("pos");
  }

  const fs = [income, tourism, pos];
  return {
    value: base * fs.reduce((a, f) => a * f.value, 1),
    low: base * fs.reduce((a, f) => a * f.low, 1),
    high: base * fs.reduce((a, f) => a * f.high, 1),
    base,
    perCapita,
    factors: { income, tourism, pos },
    missing,
  };
}

export function median(xs: number[]): number | null {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
