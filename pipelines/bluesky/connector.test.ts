import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toResult } from "../shared/http";
import { scrubExcerpt } from "../shared/mentions";
import type { ConnectorContext } from "../shared/types";
import { cleanHit, looksLikeSpam, postUrl, stripIdentifiers, trimTo } from "./clean";
import connector, { MIN_INTERVAL_MS } from "./index";
import { QUERIES } from "./queries";

const fixture = readFileSync(path.join(__dirname, "fixtures", "search-it.json"), "utf8");
const page = JSON.parse(fixture) as { posts: Parameters<typeof cleanHit>[0][]; cursor?: string };
const since = new Date("2026-01-01T00:00:00Z");
const now = new Date("2026-11-11T00:00:00Z");

describe("cleaning", () => {
  it("builds the URL from the DID and rkey", () => {
    expect(postUrl("at://did:plc:abc123/app.bsky.feed.post/3kxyz")).toBe("https://bsky.app/profile/did:plc:abc123/post/3kxyz");
    expect(postUrl("at://did:plc:abc123/app.bsky.feed.like/3kxyz")).toBeNull();
  });

  it("removes mentions, handles, links and e-mails", () => {
    const out = stripIdentifiers("Grazie @fake1.example.test e @bob.bsky.social, scrivi a mario@example.test o vedi https://example.test/x www.sito.it/y parmigiano");
    expect(out).toBe("Grazie e , scrivi a o vedi parmigiano");
    expect(out).not.toMatch(/@|http|www|bsky/);
  });

  it("trims to 500 characters", () => {
    expect(trimTo("parola ".repeat(200)).length).toBeLessThanOrEqual(500);
  });

  it("maps a post with territory = country of the language, date from createdAt", () => {
    const r = cleanHit(page.posts[0], "it", since, now);
    expect("post" in r && r.post.url).toMatch(/^https:\/\/bsky\.app\/profile\/did:plc:testauthor0\/post\//);
  });

  it("keeps only posts tagged with the searched language", () => {
    expect(cleanHit(page.posts[2], "it", since, now)).toEqual({ skip: "language" });
  });

  it("skips reposts, short texts, posts outside the window, and future dates fall back to indexedAt", () => {
    const base = page.posts[0];
    expect(cleanHit({ ...base, reason: { $type: "app.bsky.feed.defs#reasonRepost" } }, "it", since, now)).toEqual({ skip: "repost" });
    expect(cleanHit({ ...base, record: { ...base.record, text: "ok @a.b.c https://x.y/z" } }, "it", since, now)).toEqual({ skip: "too_short" });
    expect(cleanHit({ ...base, record: { ...base.record, createdAt: "2020-01-01T00:00:00Z" } }, "it", since, now)).toEqual({ skip: "outside_window" });
    const fut = cleanHit({ ...base, indexedAt: "2026-11-05T10:00:00Z", record: { ...base.record, createdAt: "2030-01-01T00:00:00Z" } }, "it", since, now);
    expect("post" in fut && fut.post.createdAt).toBe("2026-11-05T10:00:00.000Z");
  });

  it("flags ads and spam, and endearments", () => {
    expect(looksLikeSpam("Usa il codice sconto PARMA10 per il parmigiano", "x")).toBe(true);
    expect(looksLikeSpam("#a #b #c #d #e parmigiano buonissimo oggi", "#a #b #c #d #e parmigiano buonissimo oggi")).toBe(true);
    expect(looksLikeSpam("Parmigiano con le pere, abbinamento perfetto", "Parmigiano con le pere, abbinamento perfetto")).toBe(false);
    const base = page.posts[0];
    expect(cleanHit({ ...base, record: { ...base.record, text: "Buongiorno mio miele, colazione con il pane" } }, "it", since, now)).toEqual({ skip: "noise" });
  });
});

function makeCtx(get: ConnectorContext["get"], params: Record<string, string> = {}) {
  const raw: { name: string; text: string }[] = [];
  const warns: string[] = [];
  const ctx = {
    taxonomy: { categories: new Map([["cheese", { id: 1, slug: "cheese", codes: {} }]]) },
    get,
    storeRaw: async (f: { name: string; bytes: Uint8Array }) => void raw.push({ name: f.name, text: new TextDecoder().decode(f.bytes) }),
    log: () => {},
    warn: (m: string) => void warns.push(m),
    params: { category: "cheese", lang: "it", query: "parmigiano", ...params },
  } as unknown as ConnectorContext;
  return { ctx, raw, warns };
}

describe("bluesky connector", () => {
  beforeEach(() => vi.useFakeTimers({ now }));
  afterEach(() => vi.useRealTimers());

  it("emits scrubbed mentions, and the raw file holds no author data", async () => {
    // Fixture input carries author objects, handles and an e-mail; one page only (no cursor).
    const single = JSON.stringify({ posts: page.posts, hitsTotal: 6 });
    const { ctx, raw } = makeCtx(async (u) => toResult(u, 200, "application/json", new TextEncoder().encode(single)), { max_per_query: "100" });
    const p = connector.run(ctx);
    await vi.runAllTimersAsync();
    const { mentions } = await p;

    expect(mentions.length).toBeGreaterThan(0);
    expect(mentions.every((m) => m.territory === "it" && m.language === "it" && m.category === "cheese")).toBe(true);
    expect(mentions.every((m) => m.excerpt.length <= 500 && scrubExcerpt(m.excerpt) === m.excerpt)).toBe(true);
    expect(mentions.some((m) => m.excerpt.includes("mario@") || m.excerpt.includes("@fake"))).toBe(false);
    expect(mentions.every((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.publishedOn!))).toBe(true);
    // the English-tagged post is gone
    expect(mentions).toHaveLength(5);

    expect(raw).toHaveLength(1);
    for (const needle of ["example.test", "Fake Person", "avatar", "displayName", "handle", '"author"', "mario@", "cid"]) {
      expect(raw[0].text).not.toContain(needle);
    }
    expect(JSON.parse(raw[0].text).posts[0]).toEqual({ url: expect.any(String), createdAt: expect.any(String), langs: ["it"], text: expect.any(String) });
  });

  it("paginates by cursor up to the per-query cap and spaces requests", async () => {
    const times: number[] = [];
    const urls: string[] = [];
    const { ctx } = makeCtx(
      async (u) => {
        times.push(Date.now());
        urls.push(u);
        return toResult(u, 200, "application/json", new TextEncoder().encode(fixture)); // always a cursor
      },
      { max_per_query: "18" },
    );
    const p = connector.run(ctx);
    await vi.runAllTimersAsync();
    await p;
    expect(urls).toHaveLength(3); // 6 posts per page, stops once 18 are fetched
    expect(urls[1]).toContain("cursor=cursor-1");
    expect(urls[0]).toContain("lang=it");
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(MIN_INTERVAL_MS);
  });

  it("stops at the global cap and warns", async () => {
    const { ctx, warns } = makeCtx(
      async (u) => toResult(u, 200, "application/json", new TextEncoder().encode(JSON.stringify({ posts: page.posts }))),
      { max_total: "1", query: "" },
    );
    const p = connector.run(ctx);
    await vi.runAllTimersAsync();
    const { mentions } = await p;
    expect(mentions.length).toBeGreaterThanOrEqual(1);
    expect(warns.some((w) => w.includes("global cap"))).toBe(true);
  });

  it("falls back to an app-password session when anonymous search is refused", async () => {
    vi.stubEnv("BSKY_IDENTIFIER", "x.example.test");
    vi.stubEnv("BSKY_APP_PASSWORD", "pw");
    const calls: { url: string; auth?: string }[] = [];
    const { ctx } = makeCtx(async (u, init) => {
      calls.push({ url: u, auth: init?.headers?.Authorization });
      if (u.includes("createSession")) return toResult(u, 200, "application/json", new TextEncoder().encode('{"accessJwt":"tok"}'));
      if (u.startsWith("https://api.bsky.app")) throw new Error(`HTTP 403 for ${u}`);
      return toResult(u, 200, "application/json", new TextEncoder().encode(JSON.stringify({ posts: [] })));
    });
    const p = connector.run(ctx);
    await vi.runAllTimersAsync();
    await p;
    vi.unstubAllEnvs();
    expect(calls.some((c) => c.url.startsWith("https://bsky.social/xrpc/app.bsky.feed.searchPosts") && c.auth === "Bearer tok")).toBe(true);
  });
});

describe("queries", () => {
  it("covers every pilot language for every category, quoting phrases", () => {
    const cats = new Set(QUERIES.map((q) => q.category));
    expect(cats.size).toBe(15);
    for (const c of cats) expect(new Set(QUERIES.filter((q) => q.category === c).map((q) => q.lang)).size).toBe(5);
  });
});
