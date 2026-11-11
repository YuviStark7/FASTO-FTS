import type { CityArea } from "./areas";

type Element = { type: string; id?: number; tags?: Record<string, string> };
type OverpassJson = { elements?: Element[]; remark?: string };

export type ParsedCity = {
  relation: { id: number; name: string; adminLevel: string; wikidata: string };
  /** shop value -> number of nodes, ways and relations. */
  counts: Map<string, number>;
};

function areaSelector(a: CityArea): string {
  return a.relationId
    ? `rel(${a.relationId})`
    : `rel["boundary"="administrative"]["admin_level"="${a.adminLevel}"]["wikidata"="${a.wikidata}"]`;
}

/** One request per city: the area relation's tags first, then one `out count` per shop value, in order. */
export function buildQuery(area: CityArea, shops: string[]): string {
  return [
    "[out:json][timeout:180];",
    `${areaSelector(area)}->.r;`,
    ".r map_to_area->.a;",
    ".r out tags;",
    ...shops.map((s) => `nwr["shop"="${s}"](area.a);out count;`),
  ].join("\n");
}

/**
 * Parses one Overpass response. Throws on anything that is not a complete, successful answer:
 * a runtime error remark, a wrong or ambiguous area, or a missing count. A failed query must never
 * turn into zeros.
 */
export function parseCity(raw: unknown, area: CityArea, shops: string[]): ParsedCity {
  const json = raw as OverpassJson;
  if (!json || !Array.isArray(json.elements)) throw new Error("response has no elements array");
  if (json.remark && /error|timed out|out of memory/i.test(json.remark)) throw new Error(`overpass remark: ${json.remark}`);
  const rels = json.elements.filter((e) => e.type === "relation");
  const counts = json.elements.filter((e) => e.type === "count");
  if (rels.length !== 1) throw new Error(`expected exactly one area relation, got ${rels.length}`);
  const rel = rels[0];
  const t = rel.tags ?? {};
  if (t.boundary !== "administrative") throw new Error(`relation ${rel.id} is not boundary=administrative`);
  if (t.admin_level !== String(area.adminLevel)) throw new Error(`relation ${rel.id} has admin_level ${t.admin_level}, expected ${area.adminLevel}`);
  if (!area.names.includes(t.name ?? "")) throw new Error(`relation ${rel.id} is named "${t.name}", expected one of ${area.names.join(" | ")}`);
  if (t.wikidata !== area.wikidata) throw new Error(`relation ${rel.id} has wikidata ${t.wikidata}, expected ${area.wikidata}`);
  if (counts.length !== shops.length) throw new Error(`expected ${shops.length} count blocks, got ${counts.length}`);

  const out = new Map<string, number>();
  shops.forEach((shop, i) => {
    const c = counts[i].tags ?? {};
    const [n, w, r, total] = [c.nodes, c.ways, c.relations, c.total].map((v) => (v !== undefined && /^\d+$/.test(v) ? Number(v) : NaN));
    if ([n, w, r, total].some(Number.isNaN)) throw new Error(`count block ${i} (${shop}) is malformed`);
    if (n + w + r !== total) throw new Error(`count block ${i} (${shop}): parts do not add up to total`);
    out.set(shop, total);
  });
  return { relation: { id: rel.id!, name: t.name, adminLevel: t.admin_level, wikidata: t.wikidata }, counts: out };
}
