/**
 * Administrative areas counted for each pilot city.
 *
 * The unit is the municipality itself (comune, commune, Gemeinde, municipio, gemeente) and, for the
 * city-states Berlin, Wien and Bruxelles, the state-level unit that matches
 * territories.stat_codes.population_unit (Bruxelles: nuts3 = Brussels-Capital Region, not the City of Brussels).
 *
 * Selection is by the Wikidata id of the boundary relation plus admin_level, resolved inside each
 * Overpass query (`rel[boundary=administrative][admin_level=N][wikidata=Q..]`). The connector then
 * checks that exactly one relation came back and that its name, admin_level and wikidata match this
 * table, so a renamed, split or duplicated boundary makes the city fail loudly (no rows) instead of
 * counting the wrong area. `relationId` is the OSM relation id once verified with Overpass; when set
 * it is used for selection instead of the Wikidata id.
 */
export type CityArea = {
  wikidata: string;
  adminLevel: number;
  /** Accepted values of the relation's `name` tag. */
  names: string[];
  /** Verified OSM relation id; selection by id when set. */
  relationId?: number;
  note: string;
};

export const AREAS: Record<string, CityArea> = {
  roma: { wikidata: "Q220", adminLevel: 8, names: ["Roma", "Roma Capitale"], note: "Comune di Roma" },
  milano: { wikidata: "Q490", adminLevel: 8, names: ["Milano"], note: "Comune di Milano (not the greater city)" },
  napoli: { wikidata: "Q2634", adminLevel: 8, names: ["Napoli"], note: "Comune di Napoli" },
  torino: { wikidata: "Q495", adminLevel: 8, names: ["Torino"], note: "Comune di Torino" },
  palermo: { wikidata: "Q2656", adminLevel: 8, names: ["Palermo"], note: "Comune di Palermo" },
  genova: { wikidata: "Q1449", adminLevel: 8, names: ["Genova"], note: "Comune di Genova" },
  bologna: { wikidata: "Q1891", adminLevel: 8, names: ["Bologna"], note: "Comune di Bologna" },
  firenze: { wikidata: "Q2044", adminLevel: 8, names: ["Firenze"], note: "Comune di Firenze" },
  bari: { wikidata: "Q3519", adminLevel: 8, names: ["Bari"], note: "Comune di Bari (relation 41038, seen 12 Nov 2026)" },
  venezia: { wikidata: "Q641", adminLevel: 8, names: ["Venezia"], note: "Comune di Venezia (mainland and lagoon)" },
  verona: { wikidata: "Q2028", adminLevel: 8, names: ["Verona"], note: "Comune di Verona (relation 44830, seen 13 Nov 2026)" },
  cagliari: { wikidata: "Q1897", adminLevel: 8, names: ["Cagliari", "Casteddu/Cagliari"], note: "Comune di Cagliari (not the greater city)" },
  paris: { wikidata: "Q90", adminLevel: 8, names: ["Paris"], note: "Commune de Paris (= departement 75)" },
  berlin: { wikidata: "Q64", adminLevel: 4, names: ["Berlin"], note: "City-state; matches NUTS3 DE300" },
  muenchen: { wikidata: "Q1726", adminLevel: 6, names: ["München"], note: "Kreisfreie Stadt; matches NUTS3 DE212" },
  madrid: { wikidata: "Q2807", adminLevel: 8, names: ["Madrid"], note: "Municipio de Madrid (not the Comunidad)" },
  barcelona: { wikidata: "Q1492", adminLevel: 8, names: ["Barcelona"], note: "Municipio de Barcelona (not the province)" },
  wien: { wikidata: "Q1741", adminLevel: 4, names: ["Wien"], note: "City-state; matches NUTS3 AT130" },
  amsterdam: { wikidata: "Q9899", adminLevel: 8, names: ["Amsterdam", "Gemeente Amsterdam"], note: "Gemeente Amsterdam (not Groot-Amsterdam)" },
  bruxelles: {
    wikidata: "Q240",
    adminLevel: 4,
    names: ["Bruxelles - Brussel", "Région de Bruxelles-Capitale - Brussels Hoofdstedelijk Gewest", "Brussels-Capital Region"],
    note: "Brussels-Capital Region (19 communes); population_unit is nuts3 = BE100, not the City of Brussels",
  },
};
