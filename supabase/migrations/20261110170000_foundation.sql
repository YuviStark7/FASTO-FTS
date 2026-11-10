-- FASTO FTS foundation: extensions, enums, identity, roles, runtime config, audit log.
-- SPEC sections 4 and 5. RLS on every table, no exceptions.

create extension if not exists postgis with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- No anonymous access to anything during the pilot (public showcase cell is post-release).
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- ---------------------------------------------------------------- enums
create type public.app_role       as enum ('admin', 'analyst', 'member', 'viewer');
create type public.grade          as enum ('A', 'B', 'C');
create type public.cell_status    as enum ('expanding', 'consolidated', 'threatened', 'insufficient_data');
create type public.brief_status   as enum ('draft', 'reviewed', 'published');
create type public.territory_level as enum ('city', 'region', 'country');
create type public.run_status     as enum ('queued', 'running', 'succeeded', 'partial', 'failed');
create type public.review_status  as enum ('pending', 'approved', 'rejected');
create type public.feedback_rating as enum ('right', 'partly_right', 'wrong');

-- ---------------------------------------------------------------- identity
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 200),
  is_personal boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (length(display_name) <= 120),
  locale       text not null default 'it' check (locale in ('it', 'en')),
  created_at   timestamptz not null default now()
);

create table public.memberships (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- ---------------------------------------------------------------- role helpers
-- SECURITY DEFINER in the non-exposed private schema, so RLS policies can call them
-- without recursing into memberships' own policies.

-- Admin and Analyst are project-team roles (R&S). Holding one in any org grants it globally.
create function private.has_role(roles public.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid()) and m.role = any (roles)
  );
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(array['admin']::public.app_role[]);
$$;

create function private.is_analyst() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(array['admin', 'analyst']::public.app_role[]);
$$;

create function private.is_org_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid()) and m.org_id = org
  );
$$;

-- Member of the org with a role that may write user-space data (not viewer).
create function private.can_write_org(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid()) and m.org_id = org and m.role <> 'viewer'
  );
$$;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------- runtime config
-- Caps, model ids, spend limit and kill switch. Never literals in code.
create table public.app_config (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);

insert into public.app_config (key, value, description) values
  ('ai.enabled',                'true'::jsonb,  'Kill switch for all runtime AI calls'),
  ('ai.daily_chat_turns_per_user', '20'::jsonb, 'Chat turns per user per day'),
  ('ai.daily_briefs_per_user',  '3'::jsonb,     'Brief generations per user per day'),
  ('ai.global_daily_spend_usd', '25'::jsonb,    'Global daily spend limit across all users, in USD'),
  ('ai.max_tokens_per_chat_turn', '2000'::jsonb, 'Output token cap per chat turn'),
  ('ai.model.orchestrator',     '"claude-sonnet-5-5"'::jsonb, 'Chat, orchestration and briefs'),
  ('ai.model.classifier',       '"claude-haiku-5-5"'::jsonb,  'Bulk mention classification');

-- ---------------------------------------------------------------- usage
create table public.usage (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users (id) on delete set null,
  org_id        uuid references public.organizations (id) on delete set null,
  module        text not null,               -- '04', '06', 'chat', ...
  kind          text not null check (kind in ('chat_turn', 'brief', 'classification', 'pipeline')),
  model         text,
  input_tokens  integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd      numeric(12, 6) not null default 0 check (cost_usd >= 0),
  created_at    timestamptz not null default now()
);
create index usage_user_day_idx on public.usage (user_id, kind, created_at);
create index usage_day_idx on public.usage (created_at);

-- Called by server code (service role) before every runtime AI call.
-- Returns 'ok' or the reason it was refused. Recording happens after the call with real token counts.
create function public.ai_quota_check(p_user uuid, p_kind text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_enabled boolean;
  v_cap     integer;
  v_used    integer;
  v_limit   numeric;
  v_spent   numeric;
begin
  select (value)::boolean into v_enabled from public.app_config where key = 'ai.enabled';
  if not coalesce(v_enabled, false) then return 'disabled'; end if;

  select (value)::numeric into v_limit from public.app_config where key = 'ai.global_daily_spend_usd';
  select coalesce(sum(cost_usd), 0) into v_spent from public.usage
   where created_at >= date_trunc('day', now());
  if v_spent >= coalesce(v_limit, 0) then return 'global_limit'; end if;

  if p_kind = 'chat_turn' then
    select (value)::integer into v_cap from public.app_config where key = 'ai.daily_chat_turns_per_user';
  elsif p_kind = 'brief' then
    select (value)::integer into v_cap from public.app_config where key = 'ai.daily_briefs_per_user';
  else
    return 'ok';
  end if;

  select count(*) into v_used from public.usage
   where user_id = p_user and kind = p_kind and created_at >= date_trunc('day', now());
  if v_used >= coalesce(v_cap, 0) then return 'user_limit'; end if;
  return 'ok';
end;
$$;
revoke execute on function public.ai_quota_check(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_quota_check(uuid, text) to service_role;

-- ---------------------------------------------------------------- audit log
create table public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid,
  action     text not null,           -- INSERT, UPDATE, DELETE
  table_name text not null,
  row_pk     text,
  old_row    jsonb,
  new_row    jsonb
);
create index audit_log_at_idx on public.audit_log (at desc);

create function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_pk  text  := coalesce(v_new, v_old) ->> coalesce(tg_argv[0], 'id');
begin
  insert into public.audit_log (actor, action, table_name, row_pk, old_row, new_row)
  values ((select auth.uid()), tg_op, tg_table_name, v_pk, v_old, v_new);
  return coalesce(new, old);
end;
$$;

create function private.forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;
create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function private.forbid_change();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.forbid_change();

create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function private.audit('user_id');
create trigger app_config_audit after insert or update or delete on public.app_config
  for each row execute function private.audit('key');

-- ---------------------------------------------------------------- sign-up
-- Every new user gets a profile, a personal organisation and the Member role.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(split_part(coalesce(new.email, ''), '@', 1), ''));

  insert into public.organizations (name, is_personal)
  values (coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Personal'), true)
  returning id into v_org;

  insert into public.memberships (org_id, user_id, role) values (v_org, new.id, 'member');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------- RLS
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.memberships   enable row level security;
alter table public.app_config    enable row level security;
alter table public.usage         enable row level security;
alter table public.audit_log     enable row level security;

-- organizations
create policy organizations_select on public.organizations for select to authenticated
  using ((select private.is_org_member(id)) or (select private.is_admin()));
create policy organizations_update on public.organizations for update to authenticated
  using ((select private.can_write_org(id))) with check ((select private.can_write_org(id)));

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- memberships: users see their own; admins see and change all. Only the role column is writable,
-- and only by admins (column grant + policy), so nobody can raise their own role.
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy memberships_update on public.memberships for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- app_config: readable by signed-in users, writable by admins only
create policy app_config_select on public.app_config for select to authenticated using (true);
create policy app_config_update on public.app_config for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- usage: own rows or admin; written by service role only
create policy usage_select on public.usage for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- audit_log: admins read; inserts only through the SECURITY DEFINER trigger
create policy audit_log_select on public.audit_log for select to authenticated
  using ((select private.is_admin()));

-- ---------------------------------------------------------------- grants
revoke all on public.organizations, public.profiles, public.memberships,
              public.app_config, public.usage, public.audit_log from anon, authenticated;

grant select on public.organizations, public.profiles, public.memberships,
                public.app_config, public.usage, public.audit_log to authenticated;
grant update (name)                 on public.organizations to authenticated;
grant update (display_name, locale) on public.profiles      to authenticated;
grant update (role)                 on public.memberships   to authenticated;
grant update (value, description)   on public.app_config    to authenticated;

create function private.stamp_config() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;
create trigger app_config_stamp before update on public.app_config
  for each row execute function private.stamp_config();
