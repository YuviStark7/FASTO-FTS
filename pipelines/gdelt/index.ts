/**
 * GDELT connector: DOC 2.0 API, timelinevolraw (raw article counts), monthly, one request per
 * category x scope (queries.ts). Terms: free for any use, citation to the GDELT Project with a
 * link to https://www.gdeltproject.org/ (docs/SOURCES.md). Media attention only, never demand.
 *
 * The API allows about one request per 5 s and answers 429 beyond that, so requests are strictly
 * sequential with spacing. A failed request gives a warning and no row; nothing is ever zero-filled.
 */
import { sleep } from "../shared/http";
import type { Connector, ConnectorContext, ObservationInput } from "../shared/types";
import { monthlyCounts, monthsBetween, type Timeline } from "./map";
import { buildQueryUrl, KEYWORDS, SCOPES, window12 } from "./queries";

const SPACING_MS = 6_000;
const COOLDOWN_MS = 60_000;
const MAX_CONSECUTIVE_FAILURES = 4;

export async function run(ctx: ConnectorContext): Promise<ObservationInput[]> {
  const fast = ctx.params.spacing_ms != null;
  const spacing = fast ? Number(ctx.params.spacing_ms) : SPACING_MS;
  const cooldown = fast ? 0 : COOLDOWN_MS;
  const today = ctx.params.today ? new Date(`${ctx.params.today}T00:00:00Z`) : new Date();
  const { start, end } = window12(today);
  const months = monthsBetween(start, end);
  const out: ObservationInput[] = [];
  let n = 0;
  let failures = 0;
  let first = true;

  for (const [category, byLang] of Object.entries(KEYWORDS)) {
    if (!ctx.taxonomy.categories.has(category)) {
      ctx.warn(`${category}: category not in taxonomy, skipped`);
      continue;
    }
    for (const scope of SCOPES) {
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        ctx.warn(`stopped after ${failures} consecutive failures (rate limit?); remaining queries not run`);
        return out;
      }
      if (!first) await sleep(spacing);
      first = false;
      const url = buildQueryUrl(byLang[scope.lang], scope.lang, scope.gdelt, today);
      const label = `${category} ${scope.lang}:${scope.territory}`;
      n++;
      try {
        const res = await ctx.get(url);
        let doc: Timeline;
        try {
          doc = res.json<Timeline>();
        } catch {
          throw new Error(`not JSON: ${res.text().slice(0, 120)}`);
        }
        await ctx.storeRaw({
          name: `${String(n).padStart(3, "0")}_${category}_${scope.lang}-${scope.territory}.json`,
          bytes: res.bytes,
          contentType: "application/json",
          url,
        });
        const { counts, incomplete } = monthlyCounts(doc, months);
        failures = 0;
        if (!counts.length) ctx.warn(`${label}: empty timeline, no rows`);
        else if (incomplete.length) ctx.warn(`${label}: months without full daily coverage, no row for ${incomplete.join(", ")}`);
        for (const c of counts) {
          out.push({
            category,
            territory: scope.territory,
            indicator: "media_attention",
            seriesKey: `${scope.lang}:${scope.territory}`,
            periodStart: c.periodStart,
            periodEnd: c.periodEnd,
            value: c.value,
            grade: "C",
            sourceRef: url,
          });
        }
      } catch (e) {
        failures++;
        ctx.warn(`${label}: request failed, no rows (${(e instanceof Error ? e.message : String(e)).slice(0, 160)})`);
        if (cooldown) await sleep(cooldown);
      }
    }
  }
  ctx.log(`${n} requests, ${out.length} rows`);
  return out;
}

const connector: Connector<ObservationInput[]> = { source: "gdelt", run };
export default connector;
