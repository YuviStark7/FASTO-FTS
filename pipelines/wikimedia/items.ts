/**
 * Wikidata items tracked per category. Every Q-id was checked against Wikidata on 11 Nov 2026
 * (label, description and sitelinks in the five pilot languages). Article titles are NOT stored
 * here: the connector resolves them from Wikidata sitelinks at run time.
 *
 * Wikipedia pageviews are an interest signal (grade C), not demand. Generic concepts are used on
 * purpose: they exist in every language edition, so countries are comparable.
 * Items missing in a language edition (checked 11 Nov 2026) produce a warning and no row:
 *   Q1065033 prosciutto: no nl article.  Q159304 torrone: no nl article.
 */
export type WikiItem = { category: string; qid: string; label: string; note: string };

export const ITEMS: WikiItem[] = [
  { category: "evo-oil", qid: "Q93165", label: "olive oil", note: "Olive oil in general; the EVO grade item (Q14789810) lacks fr, de and nl articles, so it is not used." },
  { category: "cheese", qid: "Q10943", label: "cheese", note: "Cheese in general." },
  { category: "cheese", qid: "Q14088", label: "mozzarella", note: "Italian export cheese with an article in all five languages." },
  { category: "cheese", qid: "Q155922", label: "Parmesan", note: "Parmigiano Reggiano (it/fr titles use the Italian name)." },
  { category: "cured-meats", qid: "Q1065033", label: "prosciutto", note: "Dry-cured ham; nl article missing." },
  { category: "cured-meats", qid: "Q188655", label: "salami", note: "Cured sausage." },
  { category: "pasta", qid: "Q178", label: "pasta", note: "Pasta in general." },
  { category: "bakery", qid: "Q7802", label: "bread", note: "Bread in general." },
  { category: "cereals-legumes", qid: "Q145909", label: "legume", note: "Pulses (the fr article is 'Légume sec')." },
  { category: "cereals-legumes", qid: "Q12117", label: "cereal", note: "Cereal grains." },
  { category: "cereals-legumes", qid: "Q768267", label: "breakfast cereal", note: "Packaged cereals." },
  { category: "preserves", qid: "Q5834964", label: "marmalade", note: "Closest verified jam/preserve concept present in all five languages; the generic fruit preserves item (Q74048276) lacks it, fr and nl." },
  { category: "processed-fruit-veg", qid: "Q3596097", label: "tomato sauce", note: "Core processed-tomato product." },
  { category: "processed-fruit-veg", qid: "Q234901", label: "dried fruit", note: "Dried fruit." },
  { category: "honey", qid: "Q10987", label: "honey", note: "Honey." },
  { category: "traditional-sweets", qid: "Q854342", label: "panettone", note: "Italian festive sweet bread." },
  { category: "traditional-sweets", qid: "Q159304", label: "torrone", note: "Nougat (Spanish 'turron'); nl article missing." },
  { category: "premium-soft-drinks", qid: "Q237315", label: "tonic water", note: "Premium mixer segment." },
  { category: "premium-soft-drinks", qid: "Q147538", label: "soft drink", note: "Generic; does not distinguish premium from mass products." },
  { category: "organic", qid: "Q380778", label: "organic food", note: "Organic food." },
  { category: "coffee", qid: "Q8486", label: "coffee", note: "Coffee as a drink." },
  { category: "chocolate", qid: "Q195", label: "chocolate", note: "Chocolate." },
  { category: "vinegar-condiments", qid: "Q170037", label: "balsamic vinegar", note: "Balsamic vinegar." },
];

/**
 * Pilot language -> territory slug that receives the views. Austria (de) shares German with
 * Germany: German views go to "de" only. Belgium (fr, nl) gets nothing: French and Dutch
 * Wikipedia readers are mostly in France and the Netherlands, so those views are not Belgian.
 */
export const LANGUAGES: { lang: string; territory: string }[] = [
  { lang: "it", territory: "it" },
  { lang: "fr", territory: "fr" },
  { lang: "de", territory: "de" },
  { lang: "es", territory: "es" },
  { lang: "nl", territory: "nl" },
];
