import { dayPeriod, type Connector, type ConnectorContext, type ObservationInput } from "../shared/types";
import { sleep } from "../shared/http";
import { buildQuery, createSpacer, MIN_INTERVAL_MS, OFF_BASE, parseCount, slugifyTag } from "./query";
import { COUNTRY_TAGS, TAGS } from "./tags";

const ATTEMPTS = 4;
const RETRY_WAIT_MS = 20_000;

/** One count request, spaced, with extra retries because OFF answers 503 under load. */
async function fetchCount(
  ctx: ConnectorContext,
  wait: () => Promise<number>,
  query: string,
): Promise<{ count: number; bytes: Uint8Array }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    await wait();
    try {
      const res = await ctx.get(OFF_BASE + query);
      return { count: parseCount(res.json()), bytes: res.bytes };
    } catch (e) {
      lastError = e;
      ctx.log(`attempt ${attempt}/${ATTEMPTS} failed for ${query}: ${e instanceof Error ? e.message.slice(0, 120) : e}`);
      if (attempt < ATTEMPTS) await sleep(RETRY_WAIT_MS);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

const connector: Connector = {
  source: "openfoodfacts",
  async run(ctx) {
    const period = dayPeriod(new Date().toISOString().slice(0, 10));
    const wait = createSpacer(MIN_INTERVAL_MS);
    const out: ObservationInput[] = [];
    let skipped = 0;

    for (const t of TAGS) {
      if (!ctx.taxonomy.categories.has(t.category)) {
        ctx.log(`category ${t.category} is not in the taxonomy, skipped`);
        continue;
      }
      for (const [territory, countryTag] of Object.entries(COUNTRY_TAGS)) {
        const query = buildQuery(t.kind, t.tag, countryTag);
        let got;
        try {
          got = await fetchCount(ctx, wait, query);
        } catch (e) {
          // Never fill a gap: a failed count is simply absent, and the run log says so.
          skipped++;
          ctx.log(`ERROR no count for ${query}: ${e instanceof Error ? e.message.slice(0, 160) : e}`);
          continue;
        }
        // Raw storage is mandatory (product rule 4): a storage error fails the run.
        const rawName = `${t.category}_${slugifyTag(t.tag)}_${territory}.json`;
        await ctx.storeRaw({ name: rawName, bytes: got.bytes, contentType: "application/json", url: OFF_BASE + query });
        out.push({
          category: t.category,
          territory,
          indicator: "product_count",
          seriesKey: t.tag,
          ...period,
          value: got.count,
          grade: "C",
          sourceRef: query.replace(/^\//, ""),
        });
      }
    }
    ctx.log(`${out.length} counts, ${skipped} skipped`);
    return out;
  },
};

export default connector;
