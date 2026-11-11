/**
 * ISTAT SDMX web service (esploradati.istat.it), CC BY 4.0, credit ISTAT.
 * Resident population on 1 January by comune, total (DCIS_POPRES1), for the pilot cities.
 * Values flagged as estimates (OBS_STATUS e/p) are not grade A and are left out.
 */
import { dayPeriod, type Connector, type ObservationInput } from "../shared/types";
import { BASE, COMUNI, keyFor } from "./comuni";
import { parsePopulation } from "./parse";

const YEARS = 5;

const connector: Connector = {
  source: "istat",
  async run(ctx) {
    const out: ObservationInput[] = [];
    const startPeriod = Number(ctx.params.startYear ?? new Date().getFullYear() - 8);
    for (const c of COMUNI) {
      const key = keyFor(c.code);
      const url = `${BASE}/data/${c.flow}/${key}?startPeriod=${startPeriod}`;
      const res = await ctx.get(url, {
        // The service answers HTTP 500 "languageTag1" to Node's default "Accept-Language: *".
        headers: { Accept: "application/vnd.sdmx.data+json;version=1.0.0-wd", "Accept-Language": "en" },
      });
      await ctx.storeRaw({ name: `${c.flow}_${key}.json`, bytes: res.bytes, contentType: "application/json", url });
      const parsed = parsePopulation(res.json());
      if (parsed.refArea.id !== c.code || parsed.refArea.name !== c.label) {
        ctx.log(`SKIP ${c.slug}: service returned ${parsed.refArea.id} "${parsed.refArea.name}", expected ${c.code} "${c.label}"`);
        continue;
      }
      const measured = parsed.points.filter((p) => !p.estimate);
      const estimates = parsed.points.length - measured.length;
      if (estimates || parsed.skipped) ctx.log(`${c.slug}: left out ${estimates} estimate-flagged and ${parsed.skipped} missing values`);
      for (const p of measured.slice(-YEARS)) {
        out.push({
          category: null,
          territory: c.slug,
          indicator: "population",
          seriesKey: "istat_comune",
          ...dayPeriod(`${p.year}-01-01`),
          value: p.value,
          grade: "A",
          sourceRef: `${c.flow}/${key}?time=${p.year}`,
        });
      }
    }
    return out;
  },
};

export default connector;
