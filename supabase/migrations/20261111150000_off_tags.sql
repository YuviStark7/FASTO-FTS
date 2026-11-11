-- Open Food Facts tags verified against the OFF taxonomies (11 Nov 2026, see pipelines/openfoodfacts/tags.ts).
-- cured-meats: en:prepared-meats is too broad (cooked ham, terrines); use the three cured series.
--   OFF's hierarchy is incomplete (cured hams outnumber their parent), so the series are never summed.
-- organic: en:organic is a label, not a category: moved to off_labels.
update public.categories
   set codes = jsonb_set(codes, '{off_tags}', '["en:raw-cured-meats","en:cured-hams","en:salami"]'::jsonb)
 where slug = 'cured-meats';

update public.categories
   set codes = (codes - 'off_tags') || '{"off_tags":[],"off_labels":["en:organic"]}'::jsonb
 where slug = 'organic';
