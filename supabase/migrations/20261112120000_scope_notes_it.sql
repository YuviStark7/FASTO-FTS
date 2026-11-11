-- Italian versions of the scope notes shown beside figures (the interface is Italian by default).
update public.categories c set codes = c.codes || jsonb_build_object('scope_note_it', v.note)
from (values
  ('evo-oil', 'La classe HICP comprende tutto l''olio d''oliva, non solo l''extravergine'),
  ('pasta', 'La classe HICP include il couscous'),
  ('cereals-legumes', 'Le classi HICP coprono riso, farine e altri prodotti cerealicoli; i legumi secchi rientrano in una classe degli ortaggi e non sono inclusi'),
  ('preserves', 'Classe HICP: ortaggi secchi, conservati o trasformati'),
  ('processed-fruit-veg', 'I succhi (CP01223) appartengono al gruppo delle bevande CP012'),
  ('honey', 'La classe HICP include anche confetture e marmellate'),
  ('premium-soft-drinks', 'La classe HICP comprende tutte le bevande analcoliche, non solo quelle premium'),
  ('organic', 'Nessuna classe HICP per i prodotti biologici: il trend resta a dati insufficienti finché non si integra una serie sul mercato bio'),
  ('vinegar-condiments', 'Classe HICP: salse e condimenti')
) as v(slug, note)
where c.slug = v.slug;

update public.territories t set stat_codes = t.stat_codes || jsonb_build_object('scope_note_it', v.note)
from (values
  ('milano', 'L''unità Urban Audit è la città allargata (greater city)'),
  ('napoli', 'L''unità Urban Audit è la città allargata (greater city)'),
  ('cagliari', 'L''unità Urban Audit è la città allargata (greater city)'),
  ('madrid', 'Il turismo si riferisce alla Comunidad de Madrid (NUTS3 ES300); la popolazione alla città allargata Urban Audit'),
  ('barcelona', 'Il turismo si riferisce alla provincia di Barcellona (NUTS3 ES511); la popolazione alla città allargata Urban Audit'),
  ('amsterdam', 'Il turismo si riferisce a Groot-Amsterdam (NUTS3 NL32B); la popolazione alla città allargata Urban Audit')
) as v(slug, note)
where t.slug = v.slug;
