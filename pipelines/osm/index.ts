/**
 * OpenStreetMap point-of-sale counts per pilot city (indicator pos_count, series "shop=<value>").
 * Source: Overpass API, ODbL 1.0, "© OpenStreetMap contributors". Fair use: one query at a time,
 * a pause between queries, the project User-Agent, retries with backoff on 429/5xx (httpGet).
 */
import { dayPeriod, type Connector, type ObservationInput } from "../shared/types";
import { AREAS } from "./areas";
import { buildQuery, parseCity } from "./parse";

/**
 * Public Overpass instances, tried in order for each city; the first that answers is kept for the
 * next city. overpass-api.de refuses GitHub's runner addresses (HTTP 406, then connection refused),
 * so the others are fallbacks. All serve the same OpenStreetMap data under ODbL.
 */
export const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
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

const connector: Connector<ObservationInput[]> = {
  source: "osm",
  async run(ctx) {
    const baseline = ctx.params.baseline_shops ? ctx.params.baseline_shops.split(",").map((s) => s.trim()).filter(Boolean) : BASELINE_SHOPS;
    const shops = shopValues(ctx.taxonomy.categories.values(), baseline);
    const date = new Date().toISOString().slice(0, 10);
    const out: ObservationInput[] = [];
    const failed: string[] = [];
    let first = true;
    const endpoints = ctx.params.endpoints ? ctx.params.endpoints.split(",") : ENDPOINTS;
    let preferred = 0; // index of the last endpoint that answered

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
        const body = new URLSearchParams({ data: buildQuery(area, shops) }).toString();
        const order = [...endpoints.slice(preferred), ...endpoints.slice(0, preferred)];
        let res;
        let endpoint = order[0];
        const errors: string[] = [];
        for (const [k, url] of order.entries()) {
          try {
            res = await ctx.get(url, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body,
              retries: 1,
            });
            endpoint = url;
            preferred = (preferred + k) % endpoints.length;
            break;
          } catch (e) {
            errors.push(`${new URL(url).host}: ${(e instanceof Error ? e.message : String(e)).slice(0, 80)}`);
          }
        }
        if (!res) throw new Error(`every Overpass endpoint failed (${errors.join("; ")})`);
        if (errors.length) ctx.log(`${city.slug}: answered by ${new URL(endpoint).host} after ${errors.join("; ")}`);
        await ctx.storeRaw({ name: `overpass-${city.slug}-${date}.json`, bytes: res.bytes, contentType: "application/json", url: endpoint });
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
            sourceRef: `overpass:${new URL(endpoint).host}:area=${areaRef};shop=${shop}`,
          });
        }
        ctx.log(`${city.slug}: relation ${parsed.relation.id} "${parsed.relation.name}" admin_level ${parsed.relation.adminLevel}, ${parsed.counts.size} shop values`);
      } catch (e) {
        failed.push(city.slug);
        const msg = e instanceof Error ? e.message : String(e);
        ctx.warn(`${city.slug}: FAILED, no rows written: ${msg}`);
        // No boundary matched the table: list same-named boundaries so the table can be corrected
        // from evidence. Nothing is counted from these candidates.
        if (msg.includes("got 0")) {
          try {
            const q = `[out:json][timeout:60];rel["boundary"="administrative"]["name"~"^(${area.names.join("|")})$"];out tags;`;
            const res = await ctx.get(endpoints[preferred], {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({ data: q }).toString(),
              retries: 1,
            });
            const els = ((res.json() as { elements?: { id: number; tags?: Record<string, string> }[] }).elements ?? []).slice(0, 8);
            ctx.warn(
              `${city.slug}: candidates by name: ${els.map((x) => `relation ${x.id} admin_level=${x.tags?.admin_level} wikidata=${x.tags?.wikidata} name="${x.tags?.name}"`).join("; ") || "none"}`,
            );
          } catch {
            // Diagnostics only.
          }
        }
      }
    }
    if (failed.length) ctx.log(`cities without data: ${failed.join(", ")}`);
    if (!out.length) throw new Error(`no city produced data (${failed.length} failed)`);
    return out;
  },
};

export default connector;
