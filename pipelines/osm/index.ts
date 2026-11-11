/**
 * OpenStreetMap point-of-sale counts per pilot city (indicator pos_count, series "shop=<value>").
 * Source: Overpass API, ODbL 1.0, "© OpenStreetMap contributors". Fair use: one query at a time,
 * a pause between queries, the project User-Agent, retries with backoff on 429/5xx (httpGet).
 */
import { dayPeriod, type Connector, type ObservationInput } from "../shared/types";
import { AREAS } from "./areas";
import { buildQuery, parseCity } from "./parse";

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const PAUSE_MS = 2000;

/**
 * Mirror of app_config 'pipelines.osm_baseline_shops'. The connector context has no database
 * access, so the list is held here; override per run with --param baseline_shops=a,b,c.
 */
export const BASELINE_SHOPS = ["supermarket", "convenience", "greengrocer", "butcher", "bakery", "deli"];

export function shopValues(categories: Iterable<{ codes: { osm_shop?: string[] } }>, baseline: string[]): string[] {
  const set = new Set<string>(baseline);
  for (const c of categories) for (const s of c.codes.osm_shop ?? []) set.add(s);
  return [...set].sort();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const connector: Connector = {
  source: "osm",
  async run(ctx) {
    const baseline = ctx.params.baseline_shops ? ctx.params.baseline_shops.split(",").map((s) => s.trim()).filter(Boolean) : BASELINE_SHOPS;
    const shops = shopValues(ctx.taxonomy.categories.values(), baseline);
    const date = new Date().toISOString().slice(0, 10);
    const out: ObservationInput[] = [];
    const failed: string[] = [];
    let first = true;

    for (const city of ctx.taxonomy.pilotCities) {
      const area = AREAS[city.slug];
      if (!area) {
        ctx.warn(`no area defined for ${city.slug}; skipped`);
        failed.push(city.slug);
        continue;
      }
      if (!first) await sleep(PAUSE_MS);
      first = false;
      try {
        const res = await ctx.get(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ data: buildQuery(area, shops) }).toString(),
        });
        await ctx.storeRaw({ name: `overpass-${city.slug}-${date}.json`, bytes: res.bytes, contentType: "application/json", url: ENDPOINT });
        const parsed = parseCity(res.json(), area, shops);
        const areaRef = `relation=${parsed.relation.id},wikidata=${area.wikidata},admin_level=${area.adminLevel}`;
        for (const [shop, count] of parsed.counts) {
          out.push({
            category: null,
            territory: city.slug,
            indicator: "pos_count",
            seriesKey: `shop=${shop}`,
            ...dayPeriod(date),
            value: count,
            sourceRef: `overpass:area=${areaRef};shop=${shop}`,
          });
        }
        ctx.log(`${city.slug}: relation ${parsed.relation.id} "${parsed.relation.name}" admin_level ${parsed.relation.adminLevel}, ${parsed.counts.size} shop values`);
      } catch (e) {
        failed.push(city.slug);
        ctx.warn(`${city.slug}: FAILED, no rows written: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (failed.length) ctx.log(`cities without data: ${failed.join(", ")}`);
    if (!out.length) throw new Error(`no city produced data (${failed.length} failed)`);
    return out;
  },
};

export default connector;
