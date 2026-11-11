/**
 * Connector contract. A connector turns one source into ObservationInput rows; the shared
 * runner validates them, attaches ids, grade, run and method version, and writes them.
 * Connectors never write to the database directly and never invent values.
 */

export type Grade = "A" | "B" | "C";

export type ObservationInput = {
  /** Category slug, or null for context indicators (population, income, all-items prices). */
  category: string | null;
  /** Territory slug (city, region or country), e.g. "roma", "lazio", "it". */
  territory: string;
  /** Indicator slug, e.g. "population", "price_index". */
  indicator: string;
  /** Sub-series inside the indicator, e.g. COICOP class "CP01153" or OSM tag "shop=cheese". */
  seriesKey?: string;
  /** ISO dates, inclusive. Use yearPeriod(2024) for annual data. */
  periodStart: string;
  periodEnd: string;
  value: number;
  low?: number | null;
  high?: number | null;
  /** Defaults to the indicator's unit. */
  unit?: string;
  /** Defaults to the source's default grade. */
  grade?: Grade;
  /** Status flag exactly as the source publishes it (Eurostat: p, e, b, d, u ...). */
  flag?: string;
  /** Dataset code plus filters that pin the exact figure, e.g. "demo_r_pjanaggr3?geo=ITI43&sex=T&age=TOTAL". */
  sourceRef: string;
};

/**
 * A short public text about a product. Connectors strip author identifiers before returning it
 * (handles, names, avatars, profile links); the runner scrubs again and hashes the excerpt.
 */
export type MentionInput = {
  category: string;
  /** Territory slug when the text is tied to a place; otherwise the country of its language, or null. */
  territory: string | null;
  /** ISO 639-1. */
  language: string;
  publishedOn: string | null;
  /** At most 500 characters, no author identifiers. */
  excerpt: string;
  /** Link to the post itself (allowed: it is public and needed for traceability). */
  url?: string;
};

export type OfferInput = {
  category: string;
  territory: string | null;
  competitor?: { name: string; kind?: "brand" | "producer" | "retailer" | "consortium" | "other"; url?: string };
  productName: string;
  externalId: string;
  price?: number | null;
  currency?: string;
  packSize?: number | null;
  packUnit?: "g" | "kg" | "ml" | "l" | "unit" | null;
  channel?: string | null;
  attributes?: Record<string, unknown>;
  url?: string;
  observedOn: string;
  grade?: Grade;
};

export type ConnectorOutput =
  | ObservationInput[]
  | { observations?: ObservationInput[]; mentions?: MentionInput[]; offers?: OfferInput[] };

export type RawFile = { name: string; bytes: Uint8Array; contentType: string; url?: string };

export type ConnectorContext = {
  taxonomy: import("./taxonomy").Taxonomy;
  /** HTTP GET with the project User-Agent, retries and timeout. */
  get: (url: string, init?: { headers?: Record<string, string>; method?: string; body?: string }) => Promise<HttpResult>;
  /** Keep the raw response (hashed, stored in the raw-files bucket, logged in raw_files). */
  storeRaw: (file: RawFile) => Promise<void>;
  log: (message: string) => void;
  /** Something is missing but the run still produced data (a city without an area, an empty
   *  dataset). Recorded in source_runs.errors and the run ends as "partial", never "succeeded". */
  warn: (message: string) => void;
  /** Free-form parameters from the source_runs row or the CLI (--param key=value). */
  params: Record<string, string>;
};

export type HttpResult = { url: string; status: number; contentType: string; bytes: Uint8Array; text: () => string; json: <T = unknown>() => T };

export type Connector<O extends ConnectorOutput = ConnectorOutput> = {
  /** sources.slug */
  source: string;
  run: (ctx: ConnectorContext) => Promise<O>;
};

export function yearPeriod(year: number | string) {
  const y = String(year);
  if (!/^\d{4}$/.test(y)) throw new Error(`not a year: ${year}`);
  return { periodStart: `${y}-01-01`, periodEnd: `${y}-12-31` };
}

/** A fixed point in time (stock on 1 January, a count on the day of retrieval). */
export function dayPeriod(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error(`not an ISO date: ${isoDate}`);
  return { periodStart: isoDate, periodEnd: isoDate };
}
