-- Territory statistical codes, from the Day 1 data availability check (docs/DECISIONS.md, 10 Nov 2026).
-- Eurostat regional datasets now use NUTS 2024: Groot-Amsterdam is NL32B (NL329 returns no data).
-- Each pilot city records which statistical unit feeds each series, and whether that unit is
-- wider than the city itself, so the interface can say so next to the figure.

alter table public.territories
  add column stat_codes jsonb not null default '{}'::jsonb;

comment on column public.territories.stat_codes is
  'Codes and unit choices per series: nuts_version, urban_audit (Eurostat UA city code), population_unit, tourism_unit '
  '(one of nuts3 | urban_audit | istat_comune), and scope_note when the unit is wider than the city.';

update public.territories set nuts_code = 'NL32B' where slug = 'amsterdam';

update public.territories t set stat_codes = v.codes::jsonb
from (values
  ('roma',      '{"nuts_version":"2024","urban_audit":"IT001C","population_unit":"istat_comune","tourism_unit":"urban_audit"}'),
  ('milano',    '{"nuts_version":"2024","urban_audit":"IT002C","population_unit":"istat_comune","tourism_unit":"urban_audit","scope_note":"Urban Audit unit is the greater city"}'),
  ('napoli',    '{"nuts_version":"2024","urban_audit":"IT003C","population_unit":"istat_comune","tourism_unit":"urban_audit","scope_note":"Urban Audit unit is the greater city"}'),
  ('torino',    '{"nuts_version":"2024","urban_audit":"IT004C","population_unit":"istat_comune","tourism_unit":"urban_audit"}'),
  ('palermo',   '{"nuts_version":"2024","urban_audit":"IT005C","population_unit":"istat_comune","tourism_unit":"urban_audit"}'),
  ('genova',    '{"nuts_version":"2024","urban_audit":"IT006C","population_unit":"istat_comune","tourism_unit":"urban_audit"}'),
  ('bologna',   '{"nuts_version":"2024","urban_audit":"IT009C","population_unit":"istat_comune","tourism_unit":"urban_audit"}'),
  ('firenze',   '{"nuts_version":"2024","urban_audit":"IT007C","population_unit":"istat_comune","tourism_unit":"urban_audit"}'),
  ('bari',      '{"nuts_version":"2024","urban_audit":"IT008C","population_unit":"istat_comune","tourism_unit":"urban_audit"}'),
  ('venezia',   '{"nuts_version":"2024","urban_audit":"IT011C","population_unit":"istat_comune","tourism_unit":"urban_audit"}'),
  ('verona',    '{"nuts_version":"2024","urban_audit":"IT012C","population_unit":"istat_comune","tourism_unit":"urban_audit"}'),
  ('cagliari',  '{"nuts_version":"2024","urban_audit":"IT026C","population_unit":"istat_comune","tourism_unit":"urban_audit","scope_note":"Urban Audit unit is the greater city"}'),
  ('paris',     '{"nuts_version":"2024","urban_audit":"FR001C","population_unit":"nuts3","tourism_unit":"nuts3"}'),
  ('berlin',    '{"nuts_version":"2024","urban_audit":"DE001C","population_unit":"nuts3","tourism_unit":"nuts3"}'),
  ('muenchen',  '{"nuts_version":"2024","urban_audit":"DE003C","population_unit":"nuts3","tourism_unit":"nuts3"}'),
  ('madrid',    '{"nuts_version":"2024","urban_audit":"ES001C","population_unit":"urban_audit","tourism_unit":"nuts3","scope_note":"Tourism is for the Comunidad de Madrid (NUTS3 ES300); population is the Urban Audit greater city"}'),
  ('barcelona', '{"nuts_version":"2024","urban_audit":"ES002C","population_unit":"urban_audit","tourism_unit":"nuts3","scope_note":"Tourism is for the province of Barcelona (NUTS3 ES511); population is the Urban Audit greater city"}'),
  ('wien',      '{"nuts_version":"2024","urban_audit":"AT001C","population_unit":"nuts3","tourism_unit":"nuts3"}'),
  ('amsterdam', '{"nuts_version":"2024","urban_audit":"NL001C","population_unit":"urban_audit","tourism_unit":"nuts3","scope_note":"Tourism is for Groot-Amsterdam (NUTS3 NL32B); population is the Urban Audit greater city"}'),
  ('bruxelles', '{"nuts_version":"2024","urban_audit":"BE001C","population_unit":"nuts3","tourism_unit":"nuts3"}')
) as v(slug, codes)
where t.slug = v.slug;
