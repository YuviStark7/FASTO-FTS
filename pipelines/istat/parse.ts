/** Reader for the SDMX-JSON data message of a single-series ISTAT query (only time left open). */
type SdmxJson = {
  data: {
    dataSets: { series: Record<string, { observations: Record<string, unknown[]> }> }[];
    structure: {
      dimensions: {
        series: { id: string; values: { id: string; name: string }[] }[];
        observation: { id: string; values: { id: string }[] }[];
      };
      attributes?: { observation?: { id: string; values: { id: string }[] }[] };
    };
  };
};

export type PopPoint = { year: number; value: number; estimate: boolean };
export type ParsedSeries = { refArea: { id: string; name: string }; points: PopPoint[]; skipped: number };

export function parsePopulation(doc: unknown): ParsedSeries {
  const d = (doc as SdmxJson).data;
  const dims = d.structure.dimensions;
  const area = dims.series.find((x) => x.id === "REF_AREA");
  if (!area || area.values.length !== 1) throw new Error("expected exactly one REF_AREA in the response");
  const times = dims.observation.find((x) => x.id === "TIME_PERIOD")?.values ?? [];
  const statusDef = d.structure.attributes?.observation?.find((a) => a.id === "OBS_STATUS");
  const series = Object.values(d.dataSets[0]?.series ?? {});
  if (series.length !== 1) throw new Error(`expected one series, got ${series.length}`);
  const points: PopPoint[] = [];
  let skipped = 0;
  for (const [idx, obs] of Object.entries(series[0].observations)) {
    const raw = obs[0];
    const value = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
    const year = Number(times[Number(idx)]?.id);
    if (!Number.isFinite(value) || !Number.isInteger(year)) {
      skipped++;
      continue;
    }
    const statusIdx = obs[1];
    const status = typeof statusIdx === "number" ? statusDef?.values[statusIdx]?.id : undefined;
    points.push({ year, value, estimate: status === "e" || status === "p" });
  }
  points.sort((a, b) => a.year - b.year);
  return { refArea: { id: area.values[0].id, name: area.values[0].name }, points, skipped };
}
