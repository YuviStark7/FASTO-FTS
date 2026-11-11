/** PostgREST returns a PostGIS point as GeoJSON ({type:"Point",coordinates:[lon,lat]}); anything else becomes null. */
export function parsePoint(v: unknown): [number, number] | null {
  let g = v;
  if (typeof g === "string") {
    try {
      g = JSON.parse(g);
    } catch {
      return null;
    }
  }
  const c = (g as { coordinates?: unknown } | null)?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const [lon, lat] = c.map(Number);
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

/** Circle radius in px from local demand: area proportional to value, within [min, max]. No estimate gives the small fallback size. */
export function radiusFor(value: number | null, maxValue: number, min = 12, max = 34, none = 9): number {
  if (value === null || !(maxValue > 0)) return none;
  return Math.round(min + (max - min) * Math.sqrt(Math.max(0, value) / maxValue));
}
