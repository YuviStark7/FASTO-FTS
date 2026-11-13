-- Fit (module 06): share of the territory's lever citations a product passport answers.
-- Passport claims live in product_passports.attributes->'claims' (lever codes of mention-score.v1).
insert into public.method_versions (id, module, version, params, description) values
  ('fit-v1', '06', 1,
   '{"levers_from": "published CSI of the category in the country", "certifications": {"DOP|IGP|STG": ["certification", "origin_territory"], "BIO": ["certification", "organic_natural"]}, "price_band": {"entry": ["price_value"]}}',
   'Share of lever citations (published CSI) answered by the product passport; percentile rank among the passport''s cells; grade C');
