-- Licence terms verified in docs/SOURCES.md (read 10-11 November 2026). Sources whose terms
-- allow the use are activated; eAmbrosia (no documented interface), ISMEA and Comtrade
-- (after release) and the demo source stay inactive. The ledger shows `licence` beside every figure.
update public.sources s set
  licence = v.licence,
  licence_url = v.url,
  terms_verified_at = '2026-11-11',
  is_active = true
from (values
  ('eurostat',      'CC BY 4.0',                                    'https://ec.europa.eu/eurostat/about-us/policies/copyright'),
  ('istat',         'CC BY 4.0',                                    'https://www.istat.it/note-legali/'),
  ('openfoodfacts', 'ODbL 1.0 (database), DbCL 1.0 (contents)',     'https://world.openfoodfacts.org/terms-of-use'),
  ('osm',           'ODbL 1.0, © OpenStreetMap contributors',       'https://www.openstreetmap.org/copyright'),
  ('wikimedia',     'CC0 1.0',                                      'https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html'),
  ('gdelt',         'GDELT Terms of Use (citation and link)',       'https://www.gdeltproject.org/about.html#termsofuse'),
  ('bluesky',       'Bluesky ToS: posts owned by authors; short excerpts, no identifiers', 'https://bsky.social/about/support/tos')
) as v(slug, licence, url)
where s.slug = v.slug;
