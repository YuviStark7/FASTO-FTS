/**
 * Search queries per category and pilot language (it fr de es nl); the territory of a mention is the
 * country of its language. English is deliberately not searched: "honey", "chocolate" or "coffee" are
 * mostly metaphors, endearments or ads there.
 *
 * Precision: Bluesky search is full-text (all terms must appear, quotes make a phrase) with no
 * semantic filter, so every query is a product name or a food phrase, never a bare brand or a verb.
 * Hit counts were checked against hitsTotal on 11 Nov 2026 and terms with almost no hits were dropped.
 * Remaining noise (metaphors, restaurant chatter, news) is expected: this is why mentions are grade C
 * and shown with a representativeness note. NOISE_PATTERNS removes known false positives after the
 * search; the spam rules live in ./clean.ts.
 */
export type Lang = "it" | "fr" | "de" | "es" | "nl";
export const LANGS: Lang[] = ["it", "fr", "de", "es", "nl"];

/** Territory slug of each language: the country, never a city. */
export const COUNTRY_OF: Record<Lang, string> = { it: "it", fr: "fr", de: "de", es: "es", nl: "nl" };

export type QuerySpec = { category: string; lang: Lang; q: string };

const T: Record<string, Record<Lang, string[]>> = {
  "evo-oil": {
    it: ['"olio extravergine"', '"olio evo"'],
    fr: ["\"huile d'olive vierge extra\"", "\"huile d'olive\""],
    de: ['"natives Olivenöl"', "Olivenöl"],
    es: ['"aceite de oliva virgen extra"', "AOVE"],
    nl: ['"extra vergine olijfolie"', "olijfolie"],
  },
  cheese: {
    it: ["parmigiano", '"grana padano"', "pecorino", "gorgonzola"],
    fr: ["comté", "camembert", "roquefort", "reblochon"],
    de: ["Bergkäse", "Emmentaler", "Gouda"],
    es: ['"queso manchego"', '"queso curado"', '"queso de cabra"'],
    nl: ['"oude kaas"', '"Goudse kaas"', "boerenkaas"],
  },
  "cured-meats": {
    it: ['"prosciutto crudo"', '"prosciutto di Parma"', "salame", "bresaola"],
    fr: ['"jambon sec"', "saucisson", '"jambon de Bayonne"'],
    de: ["Rohschinken", "Salami", '"Parma Schinken"'],
    es: ['"jamón ibérico"', '"jamón serrano"', "chorizo"],
    nl: ['"rauwe ham"', "droogworst", "salami"],
  },
  pasta: {
    it: ['"pasta fresca"', '"pasta artigianale"', "spaghetti"],
    fr: ['"pâtes fraîches"', '"pâtes italiennes"'],
    de: ['"frische Pasta"', "Spaghetti"],
    es: ['"pasta italiana"', "espaguetis"],
    nl: ['"verse pasta"', "spaghetti"],
  },
  bakery: {
    it: ['"pane artigianale"', '"lievito madre"', "focaccia"],
    fr: ["baguette", "croissant", "boulangerie"],
    de: ["Sauerteigbrot", "Brötchen", "Bäckerei"],
    es: ['"masa madre"', "panadería"],
    nl: ["zuurdesembrood", "bakkerij"],
  },
  "cereals-legumes": {
    it: ["lenticchie", "ceci", "farro"],
    fr: ["lentilles", '"pois chiches"', "quinoa"],
    de: ["Linsen", "Kichererbsen", "Dinkel"],
    es: ["lentejas", "garbanzos", "legumbres"],
    nl: ["linzen", "kikkererwten", "peulvruchten"],
  },
  preserves: {
    it: ['"passata di pomodoro"', "pelati", '"conserve di"'],
    fr: ['"sauce tomate"', "conserves"],
    de: ["Tomatensauce", "Konserven"],
    es: ['"tomate frito"', "conservas"],
    nl: ["tomatensaus", "conserven"],
  },
  "processed-fruit-veg": {
    it: ['"frutta secca"', "marmellata", '"succo di frutta"'],
    fr: ['"fruits secs"', "confiture", '"jus de fruits"'],
    de: ["Marmelade", "Trockenfrüchte", "Fruchtsaft"],
    es: ['"frutos secos"', "mermelada", '"zumo de"'],
    nl: ["confituur", "vruchtensap", '"gedroogd fruit"'],
  },
  honey: {
    it: ['"miele di"', '"miele artigianale"'],
    fr: ['"miel de"', '"miel bio"', "apiculteur"],
    de: ["Honig", "Imker"],
    es: ['"miel de abeja"', '"miel artesanal"'],
    nl: ["honing", "imker"],
  },
  "traditional-sweets": {
    it: ["cannoli", "panettone", "torrone", "cassata"],
    fr: ["nougat", "calisson", "macaron"],
    de: ["Lebkuchen", "Stollen", "Marzipan"],
    es: ["turrón", "polvorones", "mazapán"],
    nl: ["stroopwafel", "speculaas", "banketstaaf"],
  },
  "premium-soft-drinks": {
    it: ["chinotto", "gazzosa"],
    fr: ['"limonade artisanale"'],
    de: ["Limonade", '"Bio Limonade"'],
    es: ['"refresco artesanal"', "gaseosa"],
    nl: ["limonade", '"ginger beer"'],
  },
  organic: {
    it: ['"prodotti biologici"', '"cibo biologico"'],
    fr: ['"produits bio"', '"alimentation bio"'],
    de: ['"Bio Lebensmittel"', '"Bio Produkte"'],
    es: ['"productos ecológicos"', '"alimentos ecológicos"'],
    nl: ['"biologische producten"', '"biologisch eten"'],
  },
  coffee: {
    it: ['"caffè in grani"', "moka", '"caffè espresso"'],
    fr: ['"café en grains"', '"café de spécialité"'],
    de: ["Kaffeebohnen", "Filterkaffee"],
    es: ['"café de especialidad"', '"café en grano"'],
    nl: ["koffiebonen", '"specialty coffee"'],
  },
  chocolate: {
    it: ['"cioccolato fondente"', '"cioccolato artigianale"'],
    fr: ['"chocolat noir"', '"chocolat artisanal"'],
    de: ['"dunkle Schokolade"', "Schokolade"],
    es: ['"chocolate negro"', '"chocolate artesanal"'],
    nl: ['"pure chocolade"', "chocolade"],
  },
  "vinegar-condiments": {
    it: ['"aceto balsamico"', '"aceto di mele"'],
    fr: ['"vinaigre balsamique"', '"vinaigre de cidre"', "moutarde"],
    de: ["Balsamico", "Senf"],
    es: ['"vinagre balsámico"', '"vinagre de Jerez"'],
    nl: ["balsamicoazijn", "appelazijn", "mosterd"],
  },
};

export const QUERIES: QuerySpec[] = Object.entries(T).flatMap(([category, byLang]) =>
  (Object.entries(byLang) as [Lang, string[]][]).flatMap(([lang, qs]) => qs.map((q) => ({ category, lang, q }))),
);

/** Known false positives, applied to the scrubbed text: affectionate "my honey" in French, Italian, Spanish. */
export const NOISE_PATTERNS: RegExp[] = [
  /\b(mon|ma|mi|mio|mia|tesoro)\s+(miel|miele)\b/i,
  /\b(miel|miele)\s+(mio|mia)\b/i,
];
