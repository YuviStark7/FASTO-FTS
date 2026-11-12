import { createHash } from "node:crypto";
import { sleep } from "../shared/http";
import type { Connector, ConnectorContext, MentionInput } from "../shared/types";
import { cleanHit, toMention, type CleanPost } from "./clean";
import { QUERIES, type QuerySpec } from "./queries";

/**
 * Bluesky public posts by keyword. Terms (docs/SOURCES.md): public AT Protocol data, read through the
 * official search endpoint. No author data is kept (see clean.ts); raw files hold only the cleaned posts.
 */
export const PUBLIC_BASE = "https://api.bsky.app";
export const AUTH_BASE = "https://bsky.social";
export const WINDOW_DAYS = 365;
export const PAGE_SIZE = 100;
export const MAX_PER_QUERY = 500;
export const MAX_TOTAL = 20_000;
export const MIN_INTERVAL_MS = 500;


type SearchResponse = { posts?: Parameters<typeof cleanHit>[0][]; cursor?: string };

function searchUrl(base: string, q: string, lang: string, since: Date, cursor?: string) {
  const p = new URLSearchParams({ q, lang, since: since.toISOString(), sort: "latest", limit: String(PAGE_SIZE) });
  if (cursor) p.set("cursor", cursor);
  return `${base}/xrpc/app.bsky.feed.searchPosts?${p}`;
}

/** App-password session, used only when the public endpoint refuses anonymous search. */
async function login(ctx: ConnectorContext, identifier: string, password: string): Promise<string> {
  const res = await ctx.get(`${AUTH_BASE}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const token = res.json<{ accessJwt?: string }>().accessJwt;
  if (!token) throw new Error("Bluesky createSession returned no accessJwt");
  return token;
}

const connector: Connector<{ mentions: MentionInput[] }> = {
  source: "bluesky",
  async run(ctx) {
    const now = new Date();
    const since = new Date(now.getTime() - Number(ctx.params.days ?? WINDOW_DAYS) * 86_400_000);
    const total = Number(ctx.params.max_total ?? MAX_TOTAL);
    const queries: QuerySpec[] = QUERIES.filter(
      (s) =>
        ctx.taxonomy.categories.has(s.category) &&
        (!ctx.params.category || s.category === ctx.params.category) &&
        (!ctx.params.lang || s.lang === ctx.params.lang) &&
        (!ctx.params.query || s.q === ctx.params.query),
    );

    // Share the total evenly across queries: with a flat 500 per query the first categories used
    // the whole budget (12 Nov run: only 5 of 15 categories got mentions).
    const perQuery = Number(ctx.params.max_per_query ?? Math.min(MAX_PER_QUERY, Math.max(1, Math.floor(total / Math.max(1, queries.length)))));
    ctx.log(`${queries.length} queries, up to ${perQuery} posts each, ${total} in total`);

    let base = PUBLIC_BASE;
    let headers: Record<string, string> = {};
    let last = 0;
    const get = async (url: string) => {
      const wait = last + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      return ctx.get(url, { headers });
    };

    const seen = new Set<string>();
    const out: MentionInput[] = [];
    const skips: Record<string, number> = {};
    let paginationWarned = false;

    for (const spec of queries) {
      if (out.length >= total) {
        ctx.warn(`global cap of ${total} mentions reached; remaining queries not run`);
        break;
      }
      const kept: CleanPost[] = [];
      let fetched = 0;
      let cursor: string | undefined;
      let authTried = false;
      try {
        while (fetched < perQuery) {
          let res;
          try {
            res = await get(searchUrl(base, spec.q, spec.lang, since, cursor));
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            const id = process.env.BSKY_IDENTIFIER;
            const pw = process.env.BSKY_APP_PASSWORD;
            if (/HTTP (401|403)/.test(msg) && !authTried && base === PUBLIC_BASE && id && pw) {
              authTried = true;
              headers = { Authorization: `Bearer ${await login(ctx, id, pw)}` };
              base = AUTH_BASE;
              ctx.log("anonymous search refused, using an app-password session");
              continue;
            }
            if (/HTTP (401|403)/.test(msg) && cursor && !authTried) {
              // Measured 11 Nov 2026: api.bsky.app serves page 1 anonymously and refuses cursor pages (403).
              if (!paginationWarned) {
                ctx.warn("anonymous search is limited to the first page (100 posts) per query; set BSKY_IDENTIFIER and BSKY_APP_PASSWORD for full pagination");
                paginationWarned = true;
              }
              break;
            }
            throw e;
          }
          const body = res.json<SearchResponse>();
          const hits = body.posts ?? [];
          fetched += hits.length;
          for (const h of hits) {
            const r = cleanHit(h, spec.lang, since, now);
            if ("skip" in r) skips[r.skip] = (skips[r.skip] ?? 0) + 1;
            else {
              const key = createHash("sha256").update(r.post.text.toLowerCase()).digest("hex");
              if (seen.has(key)) skips.duplicate = (skips.duplicate ?? 0) + 1;
              else {
                seen.add(key);
                kept.push(r.post);
              }
            }
          }
          cursor = body.cursor;
          if (!cursor || hits.length === 0) break;
        }
      } catch (e) {
        // A failed query is reported and left out, never filled.
        ctx.warn(`query ${spec.lang} ${spec.q} failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`);
        continue;
      }

      // Raw file: cleaned posts only. The author object, cid, counts, facets and embeds are not copied.
      const name = `${spec.category}_${spec.lang}_${spec.q.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}.json`;
      const raw = { query: spec.q, lang: spec.lang, since: since.toISOString(), fetched, posts: kept };
      await ctx.storeRaw({
        name,
        bytes: new TextEncoder().encode(JSON.stringify(raw)),
        contentType: "application/json",
        url: searchUrl(PUBLIC_BASE, spec.q, spec.lang, since),
      });
      for (const p of kept) out.push(toMention(p, spec.category, spec.lang));
      ctx.log(`${spec.category} ${spec.lang} ${spec.q}: ${fetched} fetched, ${kept.length} kept`);
    }
    ctx.log(`${out.length} mentions; skipped ${JSON.stringify(skips)}`);
    return { mentions: out };
  },
};

export default connector;
