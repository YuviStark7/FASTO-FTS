import { NOISE_PATTERNS, COUNTRY_OF, type Lang } from "./queries";
import type { MentionInput } from "../shared/types";

/**
 * What is kept from a search hit. Everything else on the hit (author object with handle, display
 * name, avatar, follower counts, labels, embeds, facets, cid, like and repost counts) is dropped
 * here and never reaches a mention or a raw file. The only identifier left is the DID inside the
 * post URL, which is needed to link to the post itself.
 */
export type CleanPost = { url: string; createdAt: string; langs: string[]; text: string };

type RawHit = {
  uri?: string;
  author?: unknown;
  indexedAt?: string;
  reason?: { $type?: string };
  record?: { $type?: string; text?: string; createdAt?: string; langs?: string[] };
};

export const MIN_LENGTH = 20;
export const MAX_LENGTH = 500;

/** Remove links, e-mails, @mentions and bare handles (name.bsky.social, name.tld after an @). */
export function stripIdentifiers(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b(?:www\.)\S+\.\S+/gi, " ")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, " ")
    .replace(/(^|[^\w])@[\w.-]+/g, "$1 ")
    .replace(/\b[\w-]+\.bsky\.social\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function trimTo(text: string, max = MAX_LENGTH): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.8 ? cut.slice(0, space) : cut).trim();
}

/** at://did:plc:xxx/app.bsky.feed.post/rkey to https://bsky.app/profile/did:plc:xxx/post/rkey */
export function postUrl(uri: string | undefined): string | null {
  const m = /^at:\/\/(did:[a-z0-9]+:[A-Za-z0-9._:%-]+)\/app\.bsky\.feed\.post\/([A-Za-z0-9]+)$/.exec(uri ?? "");
  return m ? `https://bsky.app/profile/${m[1]}/post/${m[2]}` : null;
}

const AD_PHRASES = [
  /codice sconto|\bsconto\b.*%|offerta (?:speciale|limitata)|\bcompra ora\b|\bacquista (?:ora|subito)\b|link in bio/i,
  /code promo|\bpromo\b.*%|\bbon de réduction\b|\bachetez\b|\bpublicité\b|\bsponsorisé\b/i,
  /rabattcode|gutscheincode|jetzt kaufen|\bjetzt bestellen\b|\bwerbung\b|\banzeige\b/i,
  /código (?:de )?descuento|cupón|compra ya|\bpublicidad\b|\bpatrocinado\b/i,
  /kortingscode|bestel nu|\badvertentie\b|\bgesponsord\b/i,
  /\b(?:affiliate|sponsored|giveaway)\b|#ad\b|#sponsored\b/i,
];

/**
 * Simple documented spam and ad rules; a post is dropped when any matches:
 * ad phrases in the five languages (discount codes, "buy now"), more than 4 hashtags,
 * more than 2 links in the original text, mostly capital letters, or fewer than 50% letters.
 */
export function looksLikeSpam(original: string, scrubbed: string): boolean {
  if (AD_PHRASES.some((r) => r.test(original))) return true;
  if ((original.match(/#\w+/g) ?? []).length > 4) return true;
  if ((original.match(/https?:\/\/\S+/g) ?? []).length > 2) return true;
  const letters = scrubbed.replace(/[^\p{L}]/gu, "");
  if (letters.length < scrubbed.replace(/\s/g, "").length * 0.5) return true;
  const upper = letters.replace(/[^\p{Lu}]/gu, "");
  return letters.length > 20 && upper.length / letters.length > 0.6;
}

export type Skip = "repost" | "no_url" | "language" | "too_short" | "spam" | "noise" | "outside_window" | "bad_date";

/** One search hit to a CleanPost, or the reason it is skipped. The author object is never read. */
export function cleanHit(hit: RawHit, lang: Lang, since: Date, now = new Date()): { post: CleanPost } | { skip: Skip } {
  if (hit.reason?.$type?.includes("Repost")) return { skip: "repost" };
  const url = postUrl(hit.uri);
  if (!url) return { skip: "no_url" };
  const rec = hit.record;
  const langs = (rec?.langs ?? []).map((l) => l.toLowerCase().slice(0, 2));
  if (!langs.includes(lang)) return { skip: "language" };
  let created = new Date(rec?.createdAt ?? "");
  // A client can claim any createdAt; one in the future falls back to the date the network indexed it.
  if (Number.isNaN(created.getTime()) || created > now) created = new Date(hit.indexedAt ?? "");
  if (Number.isNaN(created.getTime())) return { skip: "bad_date" };
  if (created < since) return { skip: "outside_window" };
  const original = rec?.text ?? "";
  const scrubbed = trimTo(stripIdentifiers(original));
  if (scrubbed.length < MIN_LENGTH) return { skip: "too_short" };
  if (looksLikeSpam(original, scrubbed)) return { skip: "spam" };
  if (NOISE_PATTERNS.some((r) => r.test(scrubbed))) return { skip: "noise" };
  return { post: { url, createdAt: created.toISOString(), langs, text: scrubbed } };
}

export function toMention(p: CleanPost, category: string, lang: Lang): MentionInput {
  return {
    category,
    territory: COUNTRY_OF[lang],
    language: lang,
    publishedOn: p.createdAt.slice(0, 10),
    excerpt: p.text,
    url: p.url,
  };
}
