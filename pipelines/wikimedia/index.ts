/**
 * Wikimedia pageviews connector. Licence CC0 1.0, User-Agent with contact required, one request
 * at a time (docs/SOURCES.md). Pageviews are an interest signal, grade C, never demand.
 *
 * Flow: one Wikidata call maps every item to its article title per language (sitelinks), then one
 * Analytics API call per article returns 36 complete months of user pageviews.
 * A missing article or a 404 produces a warning and no row, never a zero.
 */
import { sleep } from "../shared/http";
import type { Connector, ConnectorContext, ObservationInput } from "../shared/types";
import { ITEMS, LANGUAGES, type WikiItem } from "./items";

const WIKIDATA = "https://www.wikidata.org/w/api.php";
const AQS = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article";
export const MONTHS = 36;
const DELAY_MS = 150;

type Sitelinks = Record<string, { title: string }>;
type WikidataResponse = { entities?: Record<string, { sitelinks?: Sitelinks }> };
type PageviewsResponse = { items?: { timestamp: string; views: number }[] };

export function wikidataUrl(qids: string[]) {
  const sites = LANGUAGES.map((l) => `${l.lang}wiki`).join("|");
  return `${WIKIDATA}?action=wbgetentities&ids=${qids.join("|")}&props=sitelinks&sitefilter=${sites}&format=json`;
}

/** Window of the last MONTHS complete calendar months before `today`, as YYYYMMDD00 bounds. */
export function window(today: Date) {
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - MONTHS, 1));
  const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  const f = (d: Date) => d.toISOString().slice(0, 10).replaceAll("-", "");
  return { start: f(first), end: f(last) };
}

export function articlePath(lang: string, title: string, start: string, end: string) {
  const article = encodeURIComponent(title.replaceAll(" ", "_"));
  return `${lang}.wikipedia/all-access/user/${article}/monthly/${start}/${end}`;
}

/** "2024030100" -> { periodStart: "2024-03-01", periodEnd: "2024-03-31" } */
export function monthPeriod(timestamp: string) {
  const y = Number(timestamp.slice(0, 4));
  const m = Number(timestamp.slice(4, 6));
  if (!y || m < 1 || m > 12) throw new Error(`bad timestamp ${timestamp}`);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { periodStart: `${y}-${mm}-01`, periodEnd: `${y}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

export async function run(ctx: ConnectorContext, now: Date = ctx.params.today ? new Date(ctx.params.today) : new Date()): Promise<ObservationInput[]> {
  const { start, end } = window(now);

  // 1. Wikidata sitelinks for all items in one call.
  const wdUrl = wikidataUrl(ITEMS.map((i) => i.qid));
  const wd = await ctx.get(wdUrl);
  await ctx.storeRaw({ name: "wikidata_sitelinks.json", bytes: wd.bytes, contentType: "application/json", url: wdUrl });
  const entities = wd.json<WikidataResponse>().entities ?? {};

  const out: ObservationInput[] = [];
  // category|territory|period -> { views, items counted }; the aggregate is a plain sum of counts.
  const totals = new Map<string, { item: WikiItem; territory: string; lang: string; periodStart: string; periodEnd: string; views: number; qids: Set<string> }>();
  // Items with an article in each language: a monthly total is written only when every one of
  // them has a value for that month, so a gap never shows up as a drop in interest.
  const expected = new Map<string, Set<string>>();
  for (const item of ITEMS) {
    for (const { lang } of LANGUAGES) {
      if (entities[item.qid]?.sitelinks?.[`${lang}wiki`]?.title) {
        const k = `${item.category}|${lang}`;
        expected.set(k, (expected.get(k) ?? new Set()).add(item.qid));
      }
    }
  }

  for (const item of ITEMS) {
    if (!entities[item.qid]) {
      ctx.warn(`${item.qid} (${item.label}): not returned by Wikidata, skipped`);
      continue;
    }
    const sitelinks = entities[item.qid].sitelinks ?? {};
    for (const { lang, territory } of LANGUAGES) {
      const title = sitelinks[`${lang}wiki`]?.title;
      if (!title) {
        ctx.warn(`${item.qid} (${item.label}): no ${lang}.wikipedia article, no rows for ${lang}`);
        continue;
      }
      const path = articlePath(lang, title, start, end);
      const url = `${AQS}/${path}`;
      await sleep(DELAY_MS);
      let body: PageviewsResponse;
      try {
        const res = await ctx.get(url);
        await ctx.storeRaw({ name: `pageviews_${lang}_${item.qid}.json`, bytes: res.bytes, contentType: "application/json", url });
        body = res.json<PageviewsResponse>();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.startsWith("HTTP 404")) {
          ctx.warn(`${lang}:${item.qid} "${title}": 404 from the pageviews API, no rows`);
          continue;
        }
        throw e;
      }
      for (const m of body.items ?? []) {
        if (typeof m.views !== "number") continue;
        const period = monthPeriod(m.timestamp);
        out.push({
          category: item.category,
          territory,
          indicator: "pageviews",
          seriesKey: `${lang}:${item.qid}`,
          ...period,
          value: m.views,
          grade: "C",
          sourceRef: path,
        });
        // Sum of counts across the category's items for this language and month (allowed arithmetic in a connector).
        const k = `${item.category}|${lang}|${period.periodStart}`;
        const t = totals.get(k) ?? { item, territory, lang, ...period, views: 0, qids: new Set<string>() };
        t.views += m.views;
        t.qids.add(item.qid);
        totals.set(k, t);
      }
    }
    ctx.log(`${item.category}/${item.label}: ${out.length} rows so far`);
  }

  for (const t of totals.values()) {
    const want = expected.get(`${t.item.category}|${t.lang}`) ?? new Set<string>();
    if (t.qids.size !== want.size) {
      ctx.warn(`${t.item.category} ${t.lang} ${t.periodStart.slice(0, 7)}: ${t.qids.size}/${want.size} items have data, no total written`);
      continue;
    }
    out.push({
      category: t.item.category,
      territory: t.territory,
      indicator: "pageviews",
      seriesKey: `${t.lang}:total`,
      periodStart: t.periodStart,
      periodEnd: t.periodEnd,
      value: t.views,
      grade: "C",
      sourceRef: `sum of monthly user pageviews on ${t.lang}.wikipedia for ${[...t.qids].sort().join("+")} (${AQS})`,
    });
  }
  return out;
}

const connector: Connector<ObservationInput[]> = { source: "wikimedia", run: (ctx) => run(ctx) };
export default connector;
