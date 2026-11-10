-- FASTO FTS: briefs, user space, acceptance targets. SPEC sections 5, 6 and 9.

-- ---------------------------------------------------------------- advice
create table public.briefs (
  id                 bigint generated always as identity primary key,
  category_id        smallint not null references public.categories (id),
  territory_id       smallint not null references public.territories (id),
  status             public.brief_status not null default 'draft',
  current_version_id bigint,
  created_by         uuid references auth.users (id) on delete set null,
  reviewed_by        uuid references auth.users (id) on delete set null,
  published_by       uuid references auth.users (id) on delete set null,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  unique (category_id, territory_id)
);

create table public.brief_versions (
  id                    bigint generated always as identity primary key,
  brief_id              bigint not null references public.briefs (id) on delete cascade,
  version               integer not null,
  locale                text not null default 'it' check (locale in ('it', 'en')),
  content               jsonb not null,   -- {"sections":[{"heading":..,"sentences":[{"text":..,"citations":[obs ids]}]}]}
  model                 text not null,
  prompt_version        text not null,
  citation_check_passed boolean not null default false,
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  unique (brief_id, version, locale)
);
alter table public.briefs add constraint briefs_current_version_fk
  foreign key (current_version_id) references public.brief_versions (id);

create table public.brief_citations (
  id               bigint generated always as identity primary key,
  brief_version_id bigint not null references public.brief_versions (id) on delete cascade,
  sentence_path    text not null,      -- 'sections.0.sentences.2'
  observation_id   bigint references public.observations (id),
  snapshot_ref     text,               -- 'trend_snapshots:12', for derived figures
  check (observation_id is not null or snapshot_ref is not null)
);
create index brief_citations_version_idx on public.brief_citations (brief_version_id);

-- ---------------------------------------------------------------- user space (scoped to the organisation)
create table public.weight_sets (
  id         bigint generated always as identity primary key,
  org_id     uuid references public.organizations (id) on delete cascade,  -- null = system default
  name       text not null check (length(name) between 1 and 80),
  weights    jsonb not null,   -- {"growth":0.30,"size":0.20,"csi":0.20,"pressure":0.15,"fit":0.15}
  is_default boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    weights ?& array['growth', 'size', 'csi', 'pressure', 'fit']
    and abs((weights->>'growth')::numeric + (weights->>'size')::numeric + (weights->>'csi')::numeric
          + (weights->>'pressure')::numeric + (weights->>'fit')::numeric - 1) < 0.0001
  )
);
create unique index weight_sets_one_default on public.weight_sets (coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid)) where is_default;
alter table public.mos_snapshots add constraint mos_snapshots_weight_set_fk
  foreign key (weight_set_id) references public.weight_sets (id) on delete cascade;

create table public.product_passports (
  id             bigint generated always as identity primary key,
  org_id         uuid not null references public.organizations (id) on delete cascade,
  name           text not null check (length(name) between 1 and 120),
  category_id    smallint not null references public.categories (id),
  price_band     text check (price_band in ('entry', 'mid', 'premium', 'luxury')),
  certifications text[] not null default '{}',   -- 'DOP', 'IGP', 'BIO', ...
  format         text,
  story          text check (length(story) <= 2000),
  capacity       text,
  attributes     jsonb not null default '{}'::jsonb,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.watchlists (
  id           bigint generated always as identity primary key,
  org_id       uuid not null references public.organizations (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  category_id  smallint not null references public.categories (id),
  territory_id smallint not null references public.territories (id),
  created_at   timestamptz not null default now(),
  unique (user_id, category_id, territory_id)
);

create table public.alerts (
  id           bigint generated always as identity primary key,
  org_id       uuid not null references public.organizations (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  watchlist_id bigint references public.watchlists (id) on delete cascade,
  kind         text not null,
  payload      jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table public.conversations (
  id         bigint generated always as identity primary key,
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text,
  locale     text not null default 'it' check (locale in ('it', 'en')),
  created_at timestamptz not null default now()
);

create table public.messages (
  id              bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  org_id          uuid not null references public.organizations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'tool')),
  content         jsonb not null,
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.exports (
  id               bigint generated always as identity primary key,
  org_id           uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid references auth.users (id) on delete set null,
  brief_version_id bigint references public.brief_versions (id) on delete set null,
  format           text not null check (format in ('pdf', 'docx')),
  storage_path     text,
  created_at       timestamptz not null default now()
);

create table public.feedback (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('brief_version', 'csi_snapshot')),
  target_id   bigint not null,
  rating      public.feedback_rating not null,
  comment     text check (length(comment) <= 2000),
  created_at  timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

-- ---------------------------------------------------------------- control
create table public.acceptance_targets (
  slug           text primary key,
  label_it       text not null,
  label_en       text not null,
  release_target numeric not null,
  project_target numeric not null,
  sort_order     smallint not null default 0
);

insert into public.acceptance_targets (slug, label_it, label_en, release_target, project_target, sort_order) values
  ('categories',        'Categorie configurate',                        'Categories configured',                         15, 15, 1),
  ('territories',       'Territori configurati',                        'Territories configured',                        20, 20, 2),
  ('cells',             'Celle con stato o dati insufficienti espliciti', 'Cells with a status or explicit insufficient data', 300, 300, 3),
  ('reviewed_sheets',   'Schede cella documentate e revisionate',        'Fully documented, reviewed cell sheets',         5, 30, 4),
  ('sources',           'Fonti integrate',                              'Sources integrated',                             5, 8, 5),
  ('sentiment_controls','Casi di controllo sentiment revisionati',       'Sentiment control cases reviewed by a person',  3, 10, 6),
  ('reports',           'Report dimostrativi esportati',                'Demonstration reports exported',                3, 10, 7),
  ('firms',             'Imprese coinvolte',                            'Firms involved',                                 0, 15, 8),
  ('trained_users',     'Utenti formati',                               'Trained users',                                  0, 20, 9);

-- ---------------------------------------------------------------- RLS: advice
alter table public.briefs          enable row level security;
alter table public.brief_versions  enable row level security;
alter table public.brief_citations enable row level security;
revoke all on public.briefs, public.brief_versions, public.brief_citations from anon, authenticated;
grant select on public.briefs, public.brief_versions, public.brief_citations to authenticated;

-- Published briefs: any signed-in user. Draft and reviewed: analysts and admins only.
create policy briefs_select on public.briefs for select to authenticated
  using (status = 'published' or (select private.is_analyst()));
create policy brief_versions_select on public.brief_versions for select to authenticated
  using (exists (
    select 1 from public.briefs b where b.id = brief_id
      and (b.status = 'published' or (select private.is_analyst()))
  ));
create policy brief_citations_select on public.brief_citations for select to authenticated
  using (exists (
    select 1 from public.brief_versions v join public.briefs b on b.id = v.brief_id
     where v.id = brief_version_id and (b.status = 'published' or (select private.is_analyst()))
  ));

-- Review workflow: analysts move draft <-> reviewed; only admins publish (or unpublish).
grant update (status, current_version_id) on public.briefs to authenticated;
create policy briefs_review on public.briefs for update to authenticated
  using ((select private.is_analyst())) with check ((select private.is_analyst()));

-- SECURITY INVOKER on purpose: current_user must be the caller's role, not the function owner.
create function private.guard_brief_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  -- Citation check applies to every role, service role included.
  if new.status = 'published' and not exists (
       select 1 from public.brief_versions v
        where v.id = new.current_version_id and v.citation_check_passed) then
    raise exception 'a brief whose current version failed the citation check cannot be published';
  end if;
  if current_user = 'authenticated' then
    if (new.status = 'published' or old.status = 'published') and not private.is_admin() then
      raise exception 'only admins publish or unpublish briefs';
    end if;
    if new.status = 'reviewed' and old.status = 'draft' then
      new.reviewed_by := (select auth.uid());
    end if;
  end if;
  if new.status = 'published' then
    new.published_by := (select auth.uid());
    new.published_at := now();
  end if;
  return new;
end;
$$;
create trigger briefs_guard_status before update on public.briefs
  for each row execute function private.guard_brief_status();

create trigger briefs_audit after insert or update or delete on public.briefs
  for each row execute function private.audit();
create trigger brief_versions_audit after insert or update or delete on public.brief_versions
  for each row execute function private.audit();

-- ---------------------------------------------------------------- RLS: user space
-- Readable and writable only by members of the owning organisation. Viewers read only.
do $$
declare t text;
begin
  foreach t in array array[
    'product_passports', 'watchlists', 'alerts', 'conversations', 'messages', 'exports', 'feedback'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_org_member(org_id)))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.can_write_org(org_id)))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.can_write_org(org_id))) with check ((select private.can_write_org(org_id)))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.can_write_org(org_id)))',
      t || '_delete', t);
  end loop;
end $$;

-- Personal rows: a member sees only their own watchlists, alerts, conversations and messages,
-- not those of colleagues in the same organisation.
create policy watchlists_own on public.watchlists as restrictive for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy alerts_own on public.alerts as restrictive for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy conversations_own on public.conversations as restrictive for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy messages_own on public.messages as restrictive for all to authenticated
  using (exists (select 1 from public.conversations c
                  where c.id = conversation_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.conversations c
                  where c.id = conversation_id and c.user_id = (select auth.uid())));
create policy feedback_own on public.feedback as restrictive for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- weight_sets: system defaults (org_id null) readable by all, editable by analysts and admins;
-- organisation sets readable and editable by members of that organisation.
alter table public.weight_sets enable row level security;
revoke all on public.weight_sets from anon, authenticated;
grant select, insert, delete on public.weight_sets to authenticated;
grant update (name, weights, is_default) on public.weight_sets to authenticated;
create policy weight_sets_select on public.weight_sets for select to authenticated
  using (org_id is null or (select private.is_org_member(org_id)));
create policy weight_sets_insert on public.weight_sets for insert to authenticated
  with check (case when org_id is null then (select private.is_analyst())
                   else (select private.can_write_org(org_id)) end);
create policy weight_sets_update on public.weight_sets for update to authenticated
  using (case when org_id is null then (select private.is_analyst())
              else (select private.can_write_org(org_id)) end)
  with check (case when org_id is null then (select private.is_analyst())
                   else (select private.can_write_org(org_id)) end);
create policy weight_sets_delete on public.weight_sets for delete to authenticated
  using (case when org_id is null then (select private.is_analyst())
              else (select private.can_write_org(org_id)) end);
create trigger weight_sets_audit after insert or update or delete on public.weight_sets
  for each row execute function private.audit();

create function private.stamp_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger weight_sets_stamp before insert or update on public.weight_sets
  for each row execute function private.stamp_owner();
create trigger product_passports_stamp before insert or update on public.product_passports
  for each row execute function private.stamp_owner();

alter table public.acceptance_targets enable row level security;
revoke all on public.acceptance_targets from anon, authenticated;
grant select on public.acceptance_targets to authenticated;
create policy acceptance_targets_select on public.acceptance_targets for select to authenticated using (true);

-- Sequences for identity columns of tables users insert into.
grant usage on all sequences in schema public to authenticated;
