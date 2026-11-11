import { createHash } from "node:crypto";
import type { Taxonomy } from "./taxonomy";
import type { MentionInput, OfferInput } from "./types";

/** Defensive second pass: no handle, e-mail or profile link survives, whatever the connector did. */
export function scrubExcerpt(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/\bwww\.\S+\.\S+/gi, "[link]")
    .replace(/\bdid:[a-z0-9]+:[A-Za-z0-9._:%-]+/g, "[id]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/(^|[^\w])@[\w.-]+/g, "$1@…")
    .replace(/\b[\w-]+\.bsky\.social\b/gi, "[handle]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export function contentHash(excerpt: string): string {
  return createHash("sha256").update(excerpt.toLowerCase()).digest("hex");
}

export type MentionRow = {
  source_id: number;
  run_id: number | null;
  category_id: number;
  territory_id: number | null;
  language: string;
  published_on: string | null;
  excerpt: string;
  url: string | null;
  content_hash: string;
  is_demo: boolean;
};

export function normaliseMentions(
  inputs: MentionInput[],
  t: Taxonomy,
  ctx: { source: string; runId: number | null },
): { rows: MentionRow[]; rejected: { input: MentionInput; reason: string }[] } {
  const source = t.sources.get(ctx.source)!;
  const rows = new Map<string, MentionRow>();
  const rejected: { input: MentionInput; reason: string }[] = [];
  for (const m of inputs) {
    const cat = t.categories.get(m.category);
    if (!cat) { rejected.push({ input: m, reason: `unknown category ${m.category}` }); continue; }
    if (m.territory && !t.territories.has(m.territory)) { rejected.push({ input: m, reason: `unknown territory ${m.territory}` }); continue; }
    if (!/^[a-z]{2}$/.test(m.language)) { rejected.push({ input: m, reason: `bad language ${m.language}` }); continue; }
    if (m.publishedOn && !/^\d{4}-\d{2}-\d{2}$/.test(m.publishedOn)) { rejected.push({ input: m, reason: "bad date" }); continue; }
    const excerpt = scrubExcerpt(m.excerpt);
    if (excerpt.length < 20) { rejected.push({ input: m, reason: "excerpt too short" }); continue; }
    const hash = contentHash(excerpt);
    rows.set(hash, {
      source_id: source.id,
      run_id: ctx.runId,
      category_id: cat.id,
      territory_id: m.territory ? t.territories.get(m.territory)!.id : null,
      language: m.language,
      published_on: m.publishedOn,
      excerpt,
      url: m.url ?? null,
      content_hash: hash,
      is_demo: false,
    });
  }
  return { rows: [...rows.values()], rejected };
}

export function checkOffer(o: OfferInput, t: Taxonomy): string | null {
  if (!t.categories.has(o.category)) return `unknown category ${o.category}`;
  if (o.territory && !t.territories.has(o.territory)) return `unknown territory ${o.territory}`;
  if (!o.productName || !o.externalId) return "missing product name or id";
  if (o.price != null && (!Number.isFinite(o.price) || o.price < 0)) return "bad price";
  if (o.packSize != null && (!Number.isFinite(o.packSize) || o.packSize <= 0)) return "bad pack size";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.observedOn)) return "bad observedOn";
  return null;
}
