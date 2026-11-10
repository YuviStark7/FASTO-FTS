-- FASTO FTS reference data: 15 categories, 20 pilot territories, indicators, sources,
-- method versions and the default MOS weight set. No market figures here.
-- Territory geometry and population arrive through the Eurostat (GISCO) connector, graded and sourced.

insert into public.categories (slug, name_it, name_en, color, icon, sort_order, is_added) values
  ('evo-oil',             'Olio EVO',                     'EVO oil',                       '#A3B23A', 'Droplet',         1, false),
  ('cheese',              'Formaggi',                     'Cheese',                        '#F2C14E', 'Cheese',          2, false),
  ('cured-meats',         'Salumi',                       'Cured meats',                   '#D9534F', 'Ham',             3, false),
  ('pasta',               'Pasta',                        'Pasta',                         '#E8A33D', 'UtensilsCrossed', 4, false),
  ('bakery',              'Prodotti da forno',            'Bakery',                        '#C98A4B', 'Croissant',       5, false),
  ('cereals-legumes',     'Cereali e legumi',             'Cereals and legumes',           '#B8A16A', 'Bean',            6, false),
  ('preserves',           'Conserve',                     'Preserves',                     '#C7643B', 'Amphora',         7, false),
  ('processed-fruit-veg', 'Ortofrutta trasformata',       'Processed fruit and vegetables','#F07F3C', 'Carrot',          8, false),
  ('honey',               'Miele',                        'Honey',                         '#F5B700', 'Hexagon',         9, false),
  ('traditional-sweets',  'Dolci tradizionali',           'Traditional sweets',            '#E58FB0', 'CakeSlice',      10, false),
  ('premium-soft-drinks', 'Bevande analcoliche premium',  'Premium soft drinks',           '#4CC3D9', 'CupSoda',        11, false),
  ('organic',             'Biologico',                    'Organic',                       '#8FBF5A', 'Sprout',         12, false),
  ('coffee',              'Caffè',                        'Coffee',                        '#9C6B45', 'Coffee',         13, true),
  ('chocolate',           'Cioccolato',                   'Chocolate',                     '#7A4A35', 'Candy',          14, true),
  ('vinegar-condiments',  'Aceto e condimenti',           'Vinegar and condiments',        '#B03A5B', 'FlaskConical',   15, true);

-- Provisional pilot set: Eurostat Urban Audit core cities, so city-level population and tourism
-- series exist for all 20. Confirmed or swapped on Day 1 by the data availability check (DECISIONS.md).
-- NUTS 2021 level 3 codes. Centroids are WGS84 city-centre coordinates.
insert into public.territories (slug, name_it, name_en, level, country_code, nuts_code, centroid, is_pilot, sort_order) values
  ('roma',      'Roma',      'Rome',      'city', 'IT', 'ITI43', extensions.st_setsrid(extensions.st_makepoint(12.4964, 41.9028), 4326), true,  1),
  ('milano',    'Milano',    'Milan',     'city', 'IT', 'ITC4C', extensions.st_setsrid(extensions.st_makepoint( 9.1900, 45.4642), 4326), true,  2),
  ('napoli',    'Napoli',    'Naples',    'city', 'IT', 'ITF33', extensions.st_setsrid(extensions.st_makepoint(14.2681, 40.8518), 4326), true,  3),
  ('torino',    'Torino',    'Turin',     'city', 'IT', 'ITC11', extensions.st_setsrid(extensions.st_makepoint( 7.6869, 45.0703), 4326), true,  4),
  ('palermo',   'Palermo',   'Palermo',   'city', 'IT', 'ITG12', extensions.st_setsrid(extensions.st_makepoint(13.3615, 38.1157), 4326), true,  5),
  ('genova',    'Genova',    'Genoa',     'city', 'IT', 'ITC33', extensions.st_setsrid(extensions.st_makepoint( 8.9463, 44.4056), 4326), true,  6),
  ('bologna',   'Bologna',   'Bologna',   'city', 'IT', 'ITH55', extensions.st_setsrid(extensions.st_makepoint(11.3426, 44.4949), 4326), true,  7),
  ('firenze',   'Firenze',   'Florence',  'city', 'IT', 'ITI14', extensions.st_setsrid(extensions.st_makepoint(11.2558, 43.7696), 4326), true,  8),
  ('bari',      'Bari',      'Bari',      'city', 'IT', 'ITF47', extensions.st_setsrid(extensions.st_makepoint(16.8719, 41.1171), 4326), true,  9),
  ('venezia',   'Venezia',   'Venice',    'city', 'IT', 'ITH35', extensions.st_setsrid(extensions.st_makepoint(12.3155, 45.4408), 4326), true, 10),
  ('verona',    'Verona',    'Verona',    'city', 'IT', 'ITH31', extensions.st_setsrid(extensions.st_makepoint(10.9916, 45.4384), 4326), true, 11),
  ('cagliari',  'Cagliari',  'Cagliari',  'city', 'IT', 'ITG2F', extensions.st_setsrid(extensions.st_makepoint( 9.1217, 39.2238), 4326), true, 12),
  ('paris',     'Parigi',    'Paris',     'city', 'FR', 'FR101', extensions.st_setsrid(extensions.st_makepoint( 2.3522, 48.8566), 4326), true, 13),
  ('berlin',    'Berlino',   'Berlin',    'city', 'DE', 'DE300', extensions.st_setsrid(extensions.st_makepoint(13.4050, 52.5200), 4326), true, 14),
  ('muenchen',  'Monaco di Baviera', 'Munich', 'city', 'DE', 'DE212', extensions.st_setsrid(extensions.st_makepoint(11.5820, 48.1351), 4326), true, 15),
  ('madrid',    'Madrid',    'Madrid',    'city', 'ES', 'ES300', extensions.st_setsrid(extensions.st_makepoint(-3.7038, 40.4168), 4326), true, 16),
  ('barcelona', 'Barcellona','Barcelona', 'city', 'ES', 'ES511', extensions.st_setsrid(extensions.st_makepoint( 2.1734, 41.3851), 4326), true, 17),
  ('wien',      'Vienna',    'Vienna',    'city', 'AT', 'AT130', extensions.st_setsrid(extensions.st_makepoint(16.3738, 48.2082), 4326), true, 18),
  ('amsterdam', 'Amsterdam', 'Amsterdam', 'city', 'NL', 'NL329', extensions.st_setsrid(extensions.st_makepoint( 4.9041, 52.3676), 4326), true, 19),
  ('bruxelles', 'Bruxelles', 'Brussels',  'city', 'BE', 'BE100', extensions.st_setsrid(extensions.st_makepoint( 4.3517, 50.8503), 4326), true, 20);

-- Countries, parents of the cities, for national series (per capita spend, deflators).
insert into public.territories (slug, name_it, name_en, level, country_code, is_pilot, sort_order) values
  ('it', 'Italia', 'Italy', 'country', 'IT', false, 101),
  ('fr', 'Francia', 'France', 'country', 'FR', false, 102),
  ('de', 'Germania', 'Germany', 'country', 'DE', false, 103),
  ('es', 'Spagna', 'Spain', 'country', 'ES', false, 104),
  ('at', 'Austria', 'Austria', 'country', 'AT', false, 105),
  ('nl', 'Paesi Bassi', 'Netherlands', 'country', 'NL', false, 106),
  ('be', 'Belgio', 'Belgium', 'country', 'BE', false, 107);
update public.territories c set parent_id = p.id
  from public.territories p
 where c.level = 'city' and p.level = 'country' and p.country_code = c.country_code;

insert into public.indicators (slug, name_it, name_en, unit, measure, is_nominal, scope, description) values
  ('population',               'Popolazione residente',            'Resident population',              'persons',          'population', false, 'context',     'Residents on 1 January'),
  ('household_spend_value',    'Spesa delle famiglie (nominale)',  'Household spending (nominal)',     'EUR',              'value',      true,  'consumption', 'Final consumption expenditure of households, current prices'),
  ('household_spend_per_capita','Spesa pro capite (nominale)',     'Per capita spending (nominal)',    'EUR_per_capita',   'value',      true,  'consumption', null),
  ('consumption_volume',       'Volumi consumati',                 'Consumed volume',                  'tonnes',           'volume',     false, 'consumption', null),
  ('production_value',         'Valore della produzione (nominale)','Production value (nominal)',      'EUR',              'value',      true,  'production',  'Value produced in the territory, not consumed in it'),
  ('production_volume',        'Volumi prodotti',                  'Produced volume',                  'tonnes',           'volume',     false, 'production',  null),
  ('price_index',              'Indice dei prezzi al consumo',     'Consumer price index',             'index_2015_100',   'price',      false, 'consumption', 'HICP for the matching COICOP class, used as deflator'),
  ('export_value',             'Esportazioni (nominale)',          'Exports (nominal)',                'EUR',              'value',      true,  'trade',       null),
  ('import_value',             'Importazioni (nominale)',          'Imports (nominal)',                'EUR',              'value',      true,  'trade',       null),
  ('export_volume',            'Esportazioni (volume)',            'Exports (volume)',                 'tonnes',           'volume',     false, 'trade',       null),
  ('import_volume',            'Importazioni (volume)',            'Imports (volume)',                 'tonnes',           'volume',     false, 'trade',       null),
  ('tourist_nights',           'Presenze turistiche',              'Tourist nights',                   'nights',           'tourism',    false, 'context',     'Nights spent at tourist accommodation'),
  ('pos_density',              'Densità punti vendita',            'Point of sale density',            'per_10k_residents','density',    false, 'context',     'Relevant shops per 10,000 residents'),
  ('regional_consumption_index','Indice di consumo regionale',     'Regional consumption index',       'ratio_to_national','other',      false, 'consumption', 'Regional per capita spend relative to national'),
  ('gi_products',              'Prodotti DOP/IGP registrati',      'Registered PDO/PGI products',      'count',            'other',      false, 'production',  null),
  ('pageviews',                'Visualizzazioni Wikipedia',        'Wikipedia pageviews',              'views',            'attention',  false, 'context',     'Interest signal by language, not demand'),
  ('media_attention',          'Attenzione mediatica',             'Media attention',                  'articles',         'attention',  false, 'context',     'News coverage volume, not demand');

-- Sources stay inactive until licence and terms are verified and recorded in docs/SOURCES.md.
insert into public.sources (slug, name, url, default_grade, cadence) values
  ('eurostat',      'Eurostat',                                   'https://ec.europa.eu/eurostat',                    'A', 'monthly'),
  ('istat',         'ISTAT',                                      'https://www.istat.it',                             'A', 'monthly'),
  ('eambrosia',     'eAmbrosia, EU geographical indications register', 'https://ec.europa.eu/agriculture/eambrosia',  'A', 'weekly'),
  ('openfoodfacts', 'Open Food Facts',                            'https://world.openfoodfacts.org',                  'A', 'weekly'),
  ('osm',           'OpenStreetMap',                              'https://www.openstreetmap.org',                    'B', 'monthly'),
  ('ismea',         'ISMEA Mercati',                              'https://www.ismeamercati.it',                      'A', 'weekly'),
  ('comtrade',      'UN Comtrade',                                'https://comtradeplus.un.org',                      'A', 'monthly'),
  ('wikimedia',     'Wikimedia pageviews',                        'https://wikimedia.org/api/rest_v1',                'C', 'daily'),
  ('gdelt',         'GDELT',                                      'https://www.gdeltproject.org',                     'C', 'daily'),
  ('demo',          'Demo data (not real)',                       'https://example.invalid/demo',                     'C', null);

insert into public.method_versions (id, module, version, description, params) values
  ('normalise-v1', '01', 1, 'Shared normaliser: source rows to graded observations', '{"mapping_review_threshold": 0.8}'),
  ('trend-v1', '02', 1, 'Deflated real value and volume CAGR over the latest 3 to 5 years, status rules from SPEC section 5',
    '{"expanding_min_real_cagr": 0.02, "threatened_max_cagr": -0.02, "min_annual_points": 3, "max_years": 5}'),
  ('geo-v1', '03', 1, 'National per capita spend x residents x regional, tourism and point-of-sale corrections, with interval',
    '{"factors": ["regional_index", "tourism", "pos_density"]}'),
  ('csi-v1', '04', 1, 'Weighted mean of five 0-100 mention dimensions; not published below the minimum mention count',
    '{"weights": {"liking": 0.30, "desirability": 0.25, "trust": 0.20, "perceived_value": 0.15, "purchase_intent": 0.10}, "min_mentions": 50}'),
  ('competition-v1', '05', 1, 'Price per unit ladders, channel counts and assortment from public offers', '{}'),
  ('mos-v1', '06', 1, 'Percentile ranks among cells that have each component; weights renormalised over present components; requires growth and size',
    '{"required": ["growth", "size"]}'),
  ('demo-v1', 'demo', 1, 'Demonstration values, not real. Always shown with a DEMO badge', '{}');

insert into public.weight_sets (org_id, name, weights, is_default) values
  (null, 'Default (SPEC)', '{"growth": 0.30, "size": 0.20, "csi": 0.20, "pressure": 0.15, "fit": 0.15}', true);

-- Every category x pilot territory gets a cell, starting as insufficient data.
insert into public.cells (category_id, territory_id, missing_inputs)
select c.id, t.id, array['trend', 'geo', 'csi', 'competition']
  from public.categories c cross join public.territories t
 where t.is_pilot;
