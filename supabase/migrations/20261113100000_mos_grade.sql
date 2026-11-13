-- MOS carries a grade like every other figure (product rule 1): the weakest grade of its present
-- components, never better than B. Cells keep a copy for the matrix and Scout.
alter table public.mos_snapshots
  add column grade public.grade check (grade in ('B', 'C')),
  add constraint mos_snapshots_grade_when_scored check ((mos is null) = (grade is null));

alter table public.cells
  add column mos_grade public.grade check (mos_grade in ('B', 'C')),
  add constraint cells_mos_grade_when_scored check ((mos is null) = (mos_grade is null));

-- Component definitions, read by the compute step (docs/METHODS.md, mos-v1).
update public.method_versions
set params = '{
  "required": ["growth", "size"],
  "growth": "real_value_cagr of the national trend snapshot",
  "size": "value of the local demand estimate",
  "csi": "published CSI of the category in the country",
  "pressure": "mean of the percentile ranks of competitor count (offers, category x country) and barrier citations per relevant mention",
  "fit": "product passport match with the territory levers; computed per organisation, absent from system snapshots"
}'::jsonb
where id = 'mos-v1';
