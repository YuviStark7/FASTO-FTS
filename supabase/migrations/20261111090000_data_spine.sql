-- Day 2 data spine: series keys on observations, NUTS2 regions, category source codes,
-- method parameters for trend-v1 and geo-v1, raw file bucket. All tables touched are empty.

-- ---------------------------------------------------------------- observations
-- series_key pins the sub-series inside an indicator, e.g. the COICOP class 'CP01153' of a
-- price index, or the OSM tag 'shop=cheese' of a point-of-sale count.
alter table public.observations add column series_key text not null default '';
alter table public.observations drop constraint observations_category_id_territory_id_indicator_id_period_s_key;
alter table public.observations add constraint observations_natural_key
  unique nulls not distinct (category_id, territory_id, indicator_id, series_key, period_start, period_end, source_id, method_version_id);
create index observations_series_idx on public.observations (indicator_id, territory_id, series_key, period_start);

-- Derived series used by the Market tab live with the snapshot that computed them.
alter table public.trend_snapshots add column series jsonb not null default '[]'::jsonb;
alter table public.trend_snapshots add column scope text not null default 'national'
  check (scope in ('national', 'regional', 'city'));

-- ---------------------------------------------------------------- indicators
insert into public.indicators (slug, name_it, name_en, unit, measure, is_nominal, scope, description) values
  ('hicp_weight',           'Peso nel paniere HICP',              'HICP basket weight',               'per_mille',      'other',   false, 'consumption', 'Share of household spending, per mille of the HICP basket'),
  ('household_income_per_capita', 'Reddito disponibile pro capite', 'Disposable income per capita',   'EUR_per_capita', 'value',   true,  'context',     'Net disposable income of households per inhabitant'),
  ('pos_count',             'Punti vendita (conteggio)',          'Points of sale (count)',           'count',          'density', false, 'context',     'Shops of one OpenStreetMap type inside the territory'),
  ('product_count',         'Prodotti a catalogo (conteggio)',    'Products listed (count)',          'count',          'other',   false, 'consumption', 'Products in Open Food Facts for the category and country; coverage, not market share');

-- ---------------------------------------------------------------- NUTS2 regions
insert into public.territories (slug, name_it, name_en, level, country_code, nuts_code, is_pilot, sort_order) values
  ('lazio',          'Lazio',          'Lazio',          'region', 'IT', 'ITI4', false, 201),
  ('lombardia',      'Lombardia',      'Lombardy',       'region', 'IT', 'ITC4', false, 202),
  ('campania',       'Campania',       'Campania',       'region', 'IT', 'ITF3', false, 203),
  ('piemonte',       'Piemonte',       'Piedmont',       'region', 'IT', 'ITC1', false, 204),
  ('sicilia',        'Sicilia',        'Sicily',         'region', 'IT', 'ITG1', false, 205),
  ('liguria',        'Liguria',        'Liguria',        'region', 'IT', 'ITC3', false, 206),
  ('emilia-romagna', 'Emilia-Romagna', 'Emilia-Romagna', 'region', 'IT', 'ITH5', false, 207),
  ('toscana',        'Toscana',        'Tuscany',        'region', 'IT', 'ITI1', false, 208),
  ('puglia',         'Puglia',         'Apulia',         'region', 'IT', 'ITF4', false, 209),
  ('veneto',         'Veneto',         'Veneto',         'region', 'IT', 'ITH3', false, 210),
  ('sardegna',       'Sardegna',       'Sardinia',       'region', 'IT', 'ITG2', false, 211),
  ('ile-de-france',  'Île-de-France',  'Île-de-France',  'region', 'FR', 'FR10', false, 212),
  ('berlin-region',  'Berlino (Land)', 'Berlin (state)', 'region', 'DE', 'DE30', false, 213),
  ('oberbayern',     'Alta Baviera',   'Upper Bavaria',  'region', 'DE', 'DE21', false, 214),
  ('comunidad-madrid','Comunità di Madrid','Community of Madrid','region','ES','ES30', false, 215),
  ('cataluna',       'Catalogna',      'Catalonia',      'region', 'ES', 'ES51', false, 216),
  ('wien-region',    'Vienna (Land)',  'Vienna (state)', 'region', 'AT', 'AT13', false, 217),
  ('noord-holland',  'Olanda Settentrionale', 'North Holland', 'region', 'NL', 'NL32', false, 218),
  ('bruxelles-region','Regione di Bruxelles-Capitale','Brussels-Capital Region','region','BE','BE10', false, 219);

update public.territories r set parent_id = c.id
  from public.territories c
 where r.level = 'region' and c.level = 'country' and c.country_code = r.country_code;

update public.territories city set parent_id = r.id
  from (values
    ('roma','lazio'), ('milano','lombardia'), ('napoli','campania'), ('torino','piemonte'), ('palermo','sicilia'),
    ('genova','liguria'), ('bologna','emilia-romagna'), ('firenze','toscana'), ('bari','puglia'), ('venezia','veneto'),
    ('verona','veneto'), ('cagliari','sardegna'), ('paris','ile-de-france'), ('berlin','berlin-region'),
    ('muenchen','oberbayern'), ('madrid','comunidad-madrid'), ('barcelona','cataluna'), ('wien','wien-region'),
    ('amsterdam','noord-holland'), ('bruxelles','bruxelles-region')
  ) as m(city, region)
  join public.territories r on r.slug = m.region
 where city.slug = m.city;

-- ---------------------------------------------------------------- category source codes
-- coicop: ECOICOP classes whose HICP weights and prices describe the category (verified labels,
--         Eurostat prc_hicp_inw, 11 Nov 2026). coicop_group: the HFCE group they belong to.
-- osm_shop: OpenStreetMap shop=* values counted as relevant points of sale.
-- off_tags: Open Food Facts category tags (verified by the OFF connector).
-- scope_note: where the statistical class is wider or narrower than the category.
update public.categories c set codes = v.codes::jsonb
from (values
  ('evo-oil',             '{"coicop":["CP01153"],"coicop_group":"CP011","osm_shop":["deli"],"off_tags":["en:extra-virgin-olive-oils"],"scope_note":"HICP class is all olive oil, not only extra virgin"}'),
  ('cheese',              '{"coicop":["CP01145"],"coicop_group":"CP011","osm_shop":["cheese","deli","dairy"],"off_tags":["en:cheeses"]}'),
  ('cured-meats',         '{"coicop":["CP01127"],"coicop_group":"CP011","osm_shop":["butcher","deli"],"off_tags":["en:prepared-meats"]}'),
  ('pasta',               '{"coicop":["CP01116"],"coicop_group":"CP011","osm_shop":["pasta","deli"],"off_tags":["en:pastas"],"scope_note":"HICP class includes couscous"}'),
  ('bakery',              '{"coicop":["CP01113","CP01114"],"coicop_group":"CP011","osm_shop":["bakery","pastry"],"off_tags":["en:breads","en:viennoiseries"]}'),
  ('cereals-legumes',     '{"coicop":["CP01111","CP01112","CP01118"],"coicop_group":"CP011","osm_shop":["health_food","greengrocer"],"off_tags":["en:cereal-grains","en:legumes"],"scope_note":"HICP classes cover rice, flours and other cereal products; dried legumes sit in a vegetable class and are not included"}'),
  ('preserves',           '{"coicop":["CP01173"],"coicop_group":"CP011","osm_shop":["deli","greengrocer"],"off_tags":["en:canned-vegetables","en:tomato-sauces"],"scope_note":"HICP class: dried, preserved or processed vegetables"}'),
  ('processed-fruit-veg', '{"coicop":["CP01163","CP01164","CP01223"],"coicop_group":"CP011","osm_shop":["greengrocer","deli"],"off_tags":["en:dried-fruits","en:fruit-preserves","en:fruit-juices"],"scope_note":"Juices (CP01223) belong to the beverages group CP012"}'),
  ('honey',               '{"coicop":["CP01182"],"coicop_group":"CP011","osm_shop":["deli","health_food"],"off_tags":["en:honeys"],"scope_note":"HICP class also includes jams and marmalades"}'),
  ('traditional-sweets',  '{"coicop":["CP01184"],"coicop_group":"CP011","osm_shop":["pastry","confectionery"],"off_tags":["en:confectioneries"]}'),
  ('premium-soft-drinks', '{"coicop":["CP01222"],"coicop_group":"CP012","osm_shop":["beverages"],"off_tags":["en:sodas"],"scope_note":"HICP class is all soft drinks, not only premium"}'),
  ('organic',             '{"coicop":[],"coicop_group":null,"osm_shop":["health_food"],"off_tags":["en:organic"],"scope_note":"No HICP class for organic products: trend is insufficient data until an organic market series is integrated"}'),
  ('coffee',              '{"coicop":["CP01211"],"coicop_group":"CP012","osm_shop":["coffee"],"off_tags":["en:coffees"]}'),
  ('chocolate',           '{"coicop":["CP01183"],"coicop_group":"CP011","osm_shop":["chocolate","confectionery"],"off_tags":["en:chocolates"]}'),
  ('vinegar-condiments',  '{"coicop":["CP01191"],"coicop_group":"CP011","osm_shop":["deli","spices"],"off_tags":["en:vinegars","en:condiments"],"scope_note":"HICP class: sauces and condiments"}')
) as v(slug, codes)
where c.slug = v.slug;

-- Food retail baseline counted for every territory, used to normalise category shop density.
insert into public.app_config (key, value, description) values
  ('pipelines.osm_baseline_shops', '["supermarket","convenience","greengrocer","butcher","bakery","deli"]'::jsonb,
   'OSM shop types counted as general food retail in every pilot city'),
  ('pipelines.user_agent', '"FASTO-FTS/0.1 (https://fasto-fts.vercel.app)"'::jsonb,
   'User-Agent sent by every connector (Wikimedia and OSM policies require contact details)');

-- ---------------------------------------------------------------- method parameters
update public.method_versions set params = '{
  "expanding_min_real_cagr": 0.02,
  "threatened_max_cagr": -0.02,
  "min_annual_points": 3,
  "max_years": 5,
  "value_base": "nama_10_co3_p3 CP_MEUR for the coicop_group, allocated by prc_hicp_inw weights",
  "real_deflator": "prc_hicp_aind INX_A_AVG CP00 (all items)",
  "volume_deflator": "prc_hicp_aind INX_A_AVG of the category classes, weight-averaged"
}'::jsonb, description = 'National category spending = HFCE group x HICP weight share. Real value deflated by all-items HICP, volume by the category''s own HICP. CAGR over the latest 3 to 5 years; status rules from SPEC section 5'
where id = 'trend-v1';

update public.method_versions set params = '{
  "income_elasticity": {"low": 0.3, "mid": 0.5, "high": 0.7},
  "tourist_food_share": {"low": 0.5, "mid": 0.75, "high": 1.0},
  "pos_elasticity": {"low": 0.0, "mid": 0.1, "high": 0.2},
  "days_per_year": 365
}'::jsonb, description = 'Local demand = national per capita category spend x residents x (regional income / national income)^e x (1 + s x tourist nights / (365 x residents)) x (city shop density / national pilot median)^g. Low and high from the parameter ranges'
where id = 'geo-v1';

-- ---------------------------------------------------------------- raw files
insert into storage.buckets (id, name, public)
values ('raw-files', 'raw-files', false)
on conflict (id) do nothing;
