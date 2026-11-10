-- FASTO FTS data model: taxonomy, provenance, facts, derived snapshots, sentiment, competition.
-- SPEC section 5. One fact table (observations) holds every number.
-- All tables in this file: readable by any signed-in user, writable only by the service role
-- (pipelines), except where a policy below says otherwise.

-- ---------------------------------------------------------------- taxonomy
create table public.categories (
  id          smallint generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_it     text not null,
  name_en     text not null,
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon        text not null,                 -- lucide icon name
  sort_order  smallint not null default 0,
  codes       jsonb not null default '{}'::jsonb,  -- {"coicop": [...], "hs": [...], "prodcom": [...]}
  is_added    boolean not null default false  -- one of the three categories added to the proposal
);

create table public.territories (
  id           smallint generated always as identity primary key,
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name_it      text not null,
  name_en      text not null,
  level        public.territory_level not null,
  country_code char(2) not null,
  nuts_code    text,                          -- NUTS 3 for cities, where one exists
  lau_code     text,
  parent_id    smallint references public.territories (id),
  geom         extensions.geometry(MultiPolygon, 4326),
  centroid     extensions.geometry(Point, 4326),
  is_pilot     boolean not null default false,
  sort_order   smallint not null default 0
);
create index territories_geom_idx on public.territories using gist (geom);

create table public.indicators (
  id          smallint generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9_]+$'),
  name_it     text not null,
  name_en     text not null,
  unit        text not null,                 -- 'EUR', 'EUR_per_capita', 'tonnes', 'index_2015_100', 'persons', 'count', ...
  measure     text not null check (measure in ('value', 'volume', 'price', 'population', 'tourism', 'density', 'attention', 'other')),
  is_nominal  boolean not null default false, -- nominal value series that must be deflated before trend analysis
  scope       text not null default 'consumption' check (scope in ('consumption', 'production', 'trade', 'context')),
  description text
);

-- ---------------------------------------------------------------- provenance
create table public.sources (
  id                smallint generated always as identity primary key,
  slug              text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name              text not null,
  url               text not null,
  licence           text,
  licence_url       text,
  terms_verified_at date,
  cadence           text,
  default_grade     public.grade not null,
  is_active         boolean not null default false,  -- only true once terms are verified
  notes             text
);

create table public.method_versions (
  id          text primary key check (id ~ '^[a-z0-9_-]+-v[0-9]+$'),  -- 'trend-v1'
  module      text not null check (module in ('01', '02', '03', '04', '05', '06', 'demo')),
  version     integer not null,
  params      jsonb not null default '{}'::jsonb,  -- thresholds and weights, calibrated on pilot cases
  description text not null,
  is_current  boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (module, version)
);

create table public.source_runs (
  id            bigint generated always as identity primary key,
  source_id     smallint not null references public.sources (id),
  status        public.run_status not null default 'queued',
  params        jsonb not null default '{}'::jsonb,
  requested_by  uuid references auth.users (id) on delete set null,
  requested_at  timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  rows_fetched  integer,
  rows_inserted integer,
  rows_rejected integer,
  errors        jsonb not null default '[]'::jsonb
);
create index source_runs_source_idx on public.source_runs (source_id, requested_at desc);

create table public.raw_files (
  id           bigint generated always as identity primary key,
  run_id       bigint not null references public.source_runs (id) on delete cascade,
  storage_path text not null,
  sha256       text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  bytes        bigint not null check (bytes >= 0),
  content_type text,
  url          text,
  fetched_at   timestamptz not null default now()
);
create index raw_files_sha_idx on public.raw_files (sha256);

-- Data Scout review queue: messy source labels mapped to the taxonomy by a model,
-- flagged for analyst review below the confidence threshold.
create table public.taxonomy_mappings (
  id          bigint generated always as identity primary key,
  source_id   smallint not null references public.sources (id),
  kind        text not null check (kind in ('category', 'territory', 'indicator')),
  raw_label   text not null,
  target_id   smallint,                     -- id in categories / territories / indicators
  confidence  numeric(4, 3) check (confidence between 0 and 1),
  status      public.review_status not null default 'pending',
  proposed_by text not null default 'model', -- 'model' or 'rule'
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (source_id, kind, raw_label)
);

-- ---------------------------------------------------------------- facts
create table public.observations (
  id                bigint generated always as identity primary key,
  category_id       smallint references public.categories (id),   -- null for context indicators (population)
  territory_id      smallint not null references public.territories (id),
  indicator_id      smallint not null references public.indicators (id),
  period_start      date not null,
  period_end        date not null,
  value             numeric not null,
  low               numeric,
  high              numeric,
  unit              text not null,
  grade             public.grade not null,
  source_id         smallint not null references public.sources (id),
  run_id            bigint references public.source_runs (id),    -- null only for is_demo rows
  method_version_id text not null references public.method_versions (id),
  is_demo           boolean not null default false,
  source_ref        text,          -- dataset code / URL fragment that pins the exact figure
  created_at        timestamptz not null default now(),
  check (period_end >= period_start),
  check (low is null or low <= value),
  check (high is null or high >= value),
  check (run_id is not null or is_demo),
  unique nulls not distinct (category_id, territory_id, indicator_id, period_start, period_end, source_id, method_version_id)
);
create index observations_cell_idx on public.observations (category_id, territory_id, indicator_id, period_start);
create index observations_run_idx on public.observations (run_id);

-- ---------------------------------------------------------------- derived snapshots
-- Each stores its inputs and method version, so it can be reproduced.
create table public.trend_snapshots (
  id                    bigint generated always as identity primary key,
  category_id           smallint not null references public.categories (id),
  territory_id          smallint not null references public.territories (id),
  status                public.cell_status not null,
  real_value_cagr       numeric,
  volume_cagr           numeric,
  nominal_value_cagr    numeric,
  first_year            smallint,
  last_year             smallint,
  grade                 public.grade,       -- null when insufficient data
  reason                text not null,      -- which rule fired, e.g. 'real_cagr>=0.02 and volume_cagr>=0'
  input_observation_ids bigint[] not null default '{}',
  method_version_id     text not null references public.method_versions (id),
  is_demo               boolean not null default false,
  computed_at           timestamptz not null default now()
);
create index trend_snapshots_cell_idx on public.trend_snapshots (category_id, territory_id, computed_at desc);

create table public.geo_estimates (
  id                    bigint generated always as identity primary key,
  category_id           smallint not null references public.categories (id),
  territory_id          smallint not null references public.territories (id),
  period_year           smallint not null,
  value                 numeric not null,
  low                   numeric not null,
  high                  numeric not null,
  unit                  text not null default 'EUR',
  grade                 public.grade not null default 'B' check (grade = 'B'),  -- always a model estimate
  factors               jsonb not null,     -- {"regional_index": {"value":..,"low":..,"high":..,"observation_id":..}, ...}
  input_observation_ids bigint[] not null default '{}',
  method_version_id     text not null references public.method_versions (id),
  is_demo               boolean not null default false,
  computed_at           timestamptz not null default now(),
  check (low <= value and value <= high)
);
create index geo_estimates_cell_idx on public.geo_estimates (category_id, territory_id, computed_at desc);

create table public.csi_snapshots (
  id                    bigint generated always as identity primary key,
  category_id           smallint not null references public.categories (id),
  territory_id          smallint not null references public.territories (id),
  period_start          date not null,
  period_end            date not null,
  csi                   numeric check (csi between 0 and 100),   -- null when below the mention minimum
  liking                numeric check (liking between 0 and 100),
  desirability          numeric check (desirability between 0 and 100),
  trust                 numeric check (trust between 0 and 100),
  perceived_value       numeric check (perceived_value between 0 and 100),
  purchase_intent       numeric check (purchase_intent between 0 and 100),
  n_mentions            integer not null check (n_mentions >= 0),
  languages             text[] not null default '{}',
  source_ids            smallint[] not null default '{}',
  representativeness_note text not null,
  is_published          boolean not null,   -- false below the minimum mention count
  grade                 public.grade not null default 'C' check (grade = 'C'),  -- online sentiment is never representative
  method_version_id     text not null references public.method_versions (id),
  is_demo               boolean not null default false,
  computed_at           timestamptz not null default now(),
  check (not is_published or csi is not null)
);
create index csi_snapshots_cell_idx on public.csi_snapshots (category_id, territory_id, computed_at desc);

create table public.mos_snapshots (
  id                bigint generated always as identity primary key,
  category_id       smallint not null references public.categories (id),
  territory_id      smallint not null references public.territories (id),
  weight_set_id     bigint,             -- FK added with weight_sets
  mos               numeric check (mos between 0 and 100),   -- null when Growth or Size is missing
  components        jsonb not null,     -- {"growth": {"pct":..,"present":true}, "size":..., "csi":..., "pressure":..., "fit":...}
  coverage_pct      numeric not null check (coverage_pct between 0 and 100),
  is_partial        boolean not null,
  rank              integer,
  input_snapshot_ids jsonb not null default '{}'::jsonb,
  method_version_id text not null references public.method_versions (id),
  is_demo           boolean not null default false,
  computed_at       timestamptz not null default now()
);
create index mos_snapshots_cell_idx on public.mos_snapshots (category_id, territory_id, computed_at desc);

-- One row per category x territory with the latest status, scores and coverage.
create table public.cells (
  category_id       smallint not null references public.categories (id),
  territory_id      smallint not null references public.territories (id),
  status            public.cell_status not null default 'insufficient_data',
  trend_snapshot_id bigint references public.trend_snapshots (id),
  geo_estimate_id   bigint references public.geo_estimates (id),
  csi_snapshot_id   bigint references public.csi_snapshots (id),
  mos_snapshot_id   bigint references public.mos_snapshots (id),
  mos               numeric check (mos between 0 and 100),
  mos_is_partial    boolean,
  coverage_pct      numeric not null default 0 check (coverage_pct between 0 and 100),
  grade_mix         jsonb not null default '{"A":0,"B":0,"C":0}'::jsonb,
  missing_inputs    text[] not null default '{}',   -- feeds the data gap map
  is_demo           boolean not null default false,
  updated_at        timestamptz not null default now(),
  primary key (category_id, territory_id)
);

-- ---------------------------------------------------------------- sentiment
-- Short excerpts only. Author identifiers are stripped at ingestion and never stored.
create table public.mentions (
  id           bigint generated always as identity primary key,
  source_id    smallint not null references public.sources (id),
  run_id       bigint references public.source_runs (id),
  category_id  smallint references public.categories (id),
  territory_id smallint references public.territories (id),
  language     text not null check (language ~ '^[a-z]{2}$'),
  published_on date,
  excerpt      text not null check (length(excerpt) <= 500),
  url          text,
  content_hash text not null unique check (content_hash ~ '^[0-9a-f]{64}$'),
  embedding    extensions.vector(1024),
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index mentions_cell_idx on public.mentions (category_id, territory_id, published_on);

create table public.mention_scores (
  mention_id      bigint primary key references public.mentions (id) on delete cascade,
  liking          smallint not null check (liking between 0 and 100),
  desirability    smallint not null check (desirability between 0 and 100),
  trust           smallint not null check (trust between 0 and 100),
  perceived_value smallint not null check (perceived_value between 0 and 100),
  purchase_intent smallint not null check (purchase_intent between 0 and 100),
  levers          text[] not null default '{}',
  barriers        text[] not null default '{}',
  model           text not null,
  prompt_version  text not null,
  scored_at       timestamptz not null default now()
);

create table public.levers (
  id                  bigint generated always as identity primary key,
  category_id         smallint not null references public.categories (id),
  territory_id        smallint references public.territories (id),
  csi_snapshot_id     bigint references public.csi_snapshots (id) on delete cascade,
  label_it            text not null,
  label_en            text not null,
  mention_count       integer not null check (mention_count >= 0),
  share               numeric check (share between 0 and 1),
  example_mention_ids bigint[] not null default '{}',
  grade               public.grade not null default 'C' check (grade = 'C'),
  is_demo             boolean not null default false
);

create table public.barriers (like public.levers including all);
alter table public.barriers add foreign key (category_id) references public.categories (id);
alter table public.barriers add foreign key (territory_id) references public.territories (id);
alter table public.barriers add foreign key (csi_snapshot_id) references public.csi_snapshots (id) on delete cascade;

-- ---------------------------------------------------------------- competition
create table public.competitors (
  id           bigint generated always as identity primary key,
  name         text not null,
  kind         text check (kind in ('brand', 'producer', 'retailer', 'consortium', 'other')),
  territory_id smallint references public.territories (id),
  url          text,
  source_id    smallint not null references public.sources (id),
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.offers (
  id             bigint generated always as identity primary key,
  competitor_id  bigint references public.competitors (id) on delete set null,
  category_id    smallint not null references public.categories (id),
  territory_id   smallint references public.territories (id),
  product_name   text not null,
  external_id    text,                      -- e.g. Open Food Facts barcode
  price          numeric check (price >= 0),
  currency       char(3) default 'EUR',
  pack_size      numeric check (pack_size > 0),
  pack_unit      text check (pack_unit in ('g', 'kg', 'ml', 'l', 'unit')),
  channel        text,
  attributes     jsonb not null default '{}'::jsonb,  -- labels, certifications, origin
  url            text,
  observed_on    date not null,
  grade          public.grade not null,
  source_id      smallint not null references public.sources (id),
  run_id         bigint references public.source_runs (id),
  is_demo        boolean not null default false,
  check (run_id is not null or is_demo)
);
create index offers_cell_idx on public.offers (category_id, territory_id);

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array[
    'categories', 'territories', 'indicators', 'sources', 'method_versions', 'source_runs',
    'raw_files', 'taxonomy_mappings', 'observations', 'trend_snapshots', 'geo_estimates',
    'csi_snapshots', 'mos_snapshots', 'cells', 'mentions', 'mention_scores', 'levers',
    'barriers', 'competitors', 'offers'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select', t);
  end loop;
end $$;

-- Analysts and admins request connector reruns (a queued run; the GitHub Action picks it up).
grant insert (source_id, params) on public.source_runs to authenticated;
create policy source_runs_request on public.source_runs for insert to authenticated
  with check ((select private.is_analyst()) and status = 'queued');

create function private.stamp_run_request() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.requested_by := (select auth.uid());
  new.status := 'queued';
  return new;
end;
$$;
create trigger source_runs_stamp before insert on public.source_runs
  for each row when (current_user = 'authenticated') execute function private.stamp_run_request();

-- Analysts and admins approve or reject taxonomy mappings.
grant update (status, target_id) on public.taxonomy_mappings to authenticated;
create policy taxonomy_mappings_review on public.taxonomy_mappings for update to authenticated
  using ((select private.is_analyst())) with check ((select private.is_analyst()));

create function private.stamp_review() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.reviewed_by := (select auth.uid());
  new.reviewed_at := now();
  return new;
end;
$$;
create trigger taxonomy_mappings_stamp before update on public.taxonomy_mappings
  for each row execute function private.stamp_review();

-- Admins edit source metadata (activation, licence notes). Audited.
grant update (licence, licence_url, terms_verified_at, cadence, is_active, notes) on public.sources to authenticated;
create policy sources_admin_update on public.sources for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create trigger sources_audit after insert or update or delete on public.sources
  for each row execute function private.audit();
