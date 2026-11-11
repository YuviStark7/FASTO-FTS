-- Source status flags travel with the value (product rule 4): e.g. Eurostat p provisional,
-- e estimated, b break in series, d definition differs. Shown beside the figure on the Sources tab.
alter table public.observations add column status_flag text check (status_flag ~ '^[a-z]{1,4}$');
comment on column public.observations.status_flag is 'Source status flag as published (Eurostat: p provisional, e estimated, b break in series, d definition differs, u low reliability)';
