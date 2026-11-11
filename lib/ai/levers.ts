import type { BARRIERS, LEVERS } from "./mention-score";

/** Labels for the fixed lever and barrier vocabulary of mention-score.v1. */
export const LEVER_LABELS: Record<(typeof LEVERS)[number], { it: string; en: string }> = {
  origin_territory: { it: "Origine e territorio", en: "Origin and territory" },
  quality_taste: { it: "Qualità e gusto", en: "Quality and taste" },
  artisanal_tradition: { it: "Artigianalità e tradizione", en: "Craft and tradition" },
  certification: { it: "Certificazioni (DOP, IGP, ...)", en: "Certifications (PDO, PGI, ...)" },
  organic_natural: { it: "Biologico e naturale", en: "Organic and natural" },
  health_nutrition: { it: "Salute e nutrizione", en: "Health and nutrition" },
  price_value: { it: "Rapporto qualità-prezzo", en: "Value for money" },
  convenience: { it: "Praticità", en: "Convenience" },
  sustainability: { it: "Sostenibilità", en: "Sustainability" },
  gift_occasion: { it: "Regalo e occasioni", en: "Gifts and occasions" },
  brand_trust: { it: "Fiducia nel marchio", en: "Brand trust" },
  novelty: { it: "Novità", en: "Novelty" },
};

export const BARRIER_LABELS: Record<(typeof BARRIERS)[number], { it: string; en: string }> = {
  price_high: { it: "Prezzo alto", en: "High price" },
  availability: { it: "Difficile da trovare", en: "Hard to find" },
  authenticity_doubt: { it: "Dubbi sull'autenticità", en: "Doubts about authenticity" },
  health_concern: { it: "Preoccupazioni per la salute", en: "Health concerns" },
  quality_inconsistency: { it: "Qualità incostante", en: "Inconsistent quality" },
  sustainability_concern: { it: "Dubbi sulla sostenibilità", en: "Sustainability concerns" },
  taste_dislike: { it: "Gusto non gradito", en: "Taste dislike" },
  packaging: { it: "Confezione", en: "Packaging" },
  safety_trust: { it: "Sicurezza e fiducia", en: "Safety and trust" },
};
