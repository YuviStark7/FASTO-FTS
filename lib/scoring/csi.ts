/**
 * Module 04, Consumer Sentiment Index. Method csi-v1 (docs/METHODS.md).
 * CSI = weighted mean of the five dimensions over the relevant mentions of the period.
 * Always grade C. Not published below min_mentions.
 */
export type CsiParams = {
  weights: { liking: number; desirability: number; trust: number; perceived_value: number; purchase_intent: number };
  min_mentions: number;
  window_days: number;
};

export type ScoredMention = {
  id: number;
  language: string;
  publishedOn: string | null;
  sourceId: number;
  liking: number;
  desirability: number;
  trust: number;
  perceived_value: number;
  purchase_intent: number;
  levers: string[];
  barriers: string[];
};

export type CsiResult = {
  n: number;
  published: boolean;
  csi: number | null;
  components: Record<keyof CsiParams["weights"], number | null>;
  languages: string[];
  sourceIds: number[];
  levers: { code: string; count: number; share: number; examples: number[] }[];
  barriers: { code: string; count: number; share: number; examples: number[] }[];
};

const DIMS = ["liking", "desirability", "trust", "perceived_value", "purchase_intent"] as const;

export function computeCsi(mentions: ScoredMention[], p: CsiParams): CsiResult {
  const n = mentions.length;
  const mean = (k: (typeof DIMS)[number]) => (n ? mentions.reduce((a, m) => a + m[k], 0) / n : null);
  const components = Object.fromEntries(DIMS.map((k) => [k, mean(k)])) as CsiResult["components"];
  const wSum = DIMS.reduce((a, k) => a + p.weights[k], 0);
  const published = n >= p.min_mentions;
  const csi = published && wSum > 0 ? DIMS.reduce((a, k) => a + p.weights[k] * (components[k] as number), 0) / wSum : null;
  const tally = (pick: (m: ScoredMention) => string[]) => {
    const by = new Map<string, number[]>();
    for (const m of mentions) for (const code of new Set(pick(m))) by.set(code, [...(by.get(code) ?? []), m.id]);
    return [...by.entries()]
      .map(([code, ids]) => ({ code, count: ids.length, share: n ? ids.length / n : 0, examples: ids.slice(0, 3) }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  };
  return {
    n,
    published,
    csi,
    components,
    languages: [...new Set(mentions.map((m) => m.language))].sort(),
    sourceIds: [...new Set(mentions.map((m) => m.sourceId))].sort((a, b) => a - b),
    levers: tally((m) => m.levers),
    barriers: tally((m) => m.barriers),
  };
}

export function representativenessNote(r: CsiResult, sourceNames: string[], period: { start: string; end: string }, minMentions: number): string {
  const base = `${r.n} public posts (${sourceNames.join(", ")}), languages ${r.languages.join(", ") || "none"}, ${period.start} to ${period.end}. Online posts are not a representative sample of consumers.`;
  return r.published ? base : `${base} Below the minimum of ${minMentions} mentions: the index is not published.`;
}
