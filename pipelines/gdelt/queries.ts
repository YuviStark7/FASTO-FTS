/**
 * GDELT DOC 2.0 queries: one short keyword query per category and pilot language.
 *
 * Precision over reach. Each phrase names the product family in the news vocabulary of that
 * language; quoted phrases are exact matches, "(a OR b)" lists synonyms (singular/plural or
 * product and trade term). Where a bare word is ambiguous we add a qualifier (honey in Italian:
 * "miele" is also the appliance brand Miele, so it must co-occur with a beekeeping word).
 * Volume per query is whatever GDELT returns: a media-attention signal (grade C), never demand.
 */

export type Lang = "it" | "fr" | "de" | "es" | "nl";

/** GDELT `sourcelang:` names. */
export const GDELT_LANG: Record<Lang, string> = { it: "italian", fr: "french", de: "german", es: "spanish", nl: "dutch" };

/**
 * Publisher country scopes. `gdelt` is the FIPS 10-4 code GDELT uses for `sourcecountry:`
 * (Germany = GM, Spain = SP, Austria = AU: not the ISO codes). `territory` is the country slug.
 *
 * - it, fr, de, es, nl: national press in the national language.
 * - at: German-language press published in Austria (sourcelang:german sourcecountry:AU).
 * - be: Belgium has two languages, so two scopes (french and dutch, both sourcecountry:BE);
 *   the language is in the seriesKey ("fr:be", "nl:be"), never merged.
 * Every scope pins sourcecountry, so a German-language article from Vienna counts for Austria only.
 */
export const SCOPES: { lang: Lang; territory: string; gdelt: string }[] = [
  { lang: "it", territory: "it", gdelt: "IT" },
  { lang: "fr", territory: "fr", gdelt: "FR" },
  { lang: "de", territory: "de", gdelt: "GM" },
  { lang: "es", territory: "es", gdelt: "SP" },
  { lang: "nl", territory: "nl", gdelt: "NL" },
  { lang: "de", territory: "at", gdelt: "AU" },
  { lang: "fr", territory: "be", gdelt: "BE" },
  { lang: "nl", territory: "be", gdelt: "BE" },
];

/** Core categories only (the 12 of the brief); the three added categories have no news query yet. */
export const KEYWORDS: Record<string, Record<Lang, string>> = {
  "evo-oil": {
    it: '"olio extravergine"',
    fr: `"huile d'olive vierge extra"`,
    de: '"natives Olivenöl extra"',
    es: '"aceite de oliva virgen extra"',
    nl: '"extra vierge olijfolie"',
  },
  cheese: { it: "(formaggio OR formaggi)", fr: "(fromage OR fromages)", de: "Käse", es: "(queso OR quesos)", nl: "kaas" },
  "cured-meats": {
    it: "(salumi OR prosciutto)",
    fr: "(charcuterie OR jambon)",
    de: "(Wurstwaren OR Schinken)",
    es: "(embutidos OR jamón)",
    nl: "(vleeswaren OR charcuterie)",
  },
  pasta: { it: "pasta", fr: '"pâtes alimentaires"', de: "Nudeln", es: '"pasta alimenticia"', nl: "pasta" },
  bakery: { it: '(pane OR "prodotti da forno")', fr: "boulangerie", de: "Backwaren", es: "panadería", nl: "bakkerij" },
  "cereals-legumes": { it: "legumi", fr: "légumineuses", de: "Hülsenfrüchte", es: "legumbres", nl: "peulvruchten" },
  preserves: { it: '"conserve alimentari"', fr: '"conserves alimentaires"', de: "Konserven", es: "conservas", nl: "conserven" },
  "processed-fruit-veg": {
    it: '"ortofrutta trasformata"',
    fr: '"fruits et légumes transformés"',
    de: '"verarbeitetes Obst und Gemüse"',
    es: '"frutas y hortalizas transformadas"',
    nl: '"verwerkte groenten en fruit"',
  },
  honey: {
    it: "miele (api OR apicoltura OR apicoltori)",
    fr: "miel (abeilles OR apiculteurs)",
    de: "Honig",
    es: "miel (abejas OR apicultores)",
    nl: "honing",
  },
  "traditional-sweets": {
    it: '"dolci tradizionali"',
    fr: '"pâtisserie traditionnelle"',
    de: '"traditionelle Süßigkeiten"',
    es: '"dulces tradicionales"',
    nl: '"traditioneel gebak"',
  },
  "premium-soft-drinks": {
    it: '"bevande analcoliche"',
    fr: '"boissons sans alcool"',
    de: '"alkoholfreie Getränke"',
    es: '"bebidas sin alcohol"',
    nl: "frisdrank",
  },
  organic: {
    it: '"prodotti biologici"',
    fr: '"produits bio"',
    de: '"Bio-Lebensmittel"',
    es: '"productos ecológicos"',
    nl: '"biologische producten"',
  },
};

const API = "https://api.gdeltproject.org/api/v2/doc/doc";

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date, end: boolean) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${end ? "235959" : "000000"}`;

/** Last 12 complete calendar months before `today` (UTC): first day of the first, last day of the last. */
export function window12(today: Date) {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 12, 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  return { start, end };
}

/** The exact request URL; it is also stored as source_ref. */
export function buildQueryUrl(keyword: string, lang: Lang, gdeltCountry: string, today: Date) {
  const { start, end } = window12(today);
  const query = `${keyword} sourcelang:${GDELT_LANG[lang]} sourcecountry:${gdeltCountry}`;
  return `${API}?query=${encodeURIComponent(query)}&mode=timelinevolraw&format=json&startdatetime=${stamp(start, false)}&enddatetime=${stamp(end, true)}`;
}
