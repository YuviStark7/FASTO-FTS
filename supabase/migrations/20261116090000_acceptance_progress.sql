-- Acceptance dashboard (SPEC sections 6 and 10): current value of each acceptance target,
-- measured from the data wherever possible. Firms and trained users happen outside the platform,
-- so admins record them by hand, with a note; those edits are audited.

alter table public.acceptance_targets
  add column manual_value numeric check (manual_value >= 0),
  add column manual_note  text check (length(manual_note) <= 500),
  add column updated_by   uuid references auth.users (id) on delete set null,
  add column updated_at   timestamptz;

grant update (manual_value, manual_note) on public.acceptance_targets to authenticated;
create policy acceptance_targets_update on public.acceptance_targets for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create trigger acceptance_targets_audit after insert or update or delete on public.acceptance_targets
  for each row execute function private.audit();

create function private.stamp_acceptance() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;
create trigger acceptance_targets_stamp before update on public.acceptance_targets
  for each row execute function private.stamp_acceptance();

-- How each value is measured (also shown on the dashboard):
--   categories          categories in the taxonomy
--   territories         pilot territories
--   cells               cells the compute step has evaluated (a status or explicit insufficient data)
--   reviewed_sheets     cells with a published brief whose current version passed the citation check
--   sources             active sources with at least one run that wrote rows
--   sentiment_controls  published CSI readings rated by at least one person
--   reports             distinct brief versions that passed the citation check and were exported
--   firms, trained_users  recorded by an admin
create function public.acceptance_progress()
returns table (
  slug text,
  label_it text,
  label_en text,
  release_target numeric,
  project_target numeric,
  current_value numeric,
  measured boolean,
  manual_note text,
  updated_at timestamptz,
  sort_order smallint
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_analyst() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  return query
  with m(slug, v) as (
    values
      ('categories', (select count(*)::numeric from public.categories)),
      ('territories', (select count(*)::numeric from public.territories where is_pilot)),
      ('cells', (select count(*)::numeric from public.cells where trend_snapshot_id is not null and not is_demo)),
      ('reviewed_sheets', (select count(*)::numeric from public.briefs b
                            join public.brief_versions v on v.id = b.current_version_id
                           where b.status = 'published' and v.citation_check_passed)),
      ('sources', (select count(distinct s.id)::numeric from public.sources s
                     join public.source_runs r on r.source_id = s.id
                    where s.is_active and r.rows_inserted > 0 and r.status in ('succeeded', 'partial'))),
      ('sentiment_controls', (select count(distinct f.target_id)::numeric from public.feedback f
                                join public.csi_snapshots c on c.id = f.target_id
                               where f.target_type = 'csi_snapshot' and c.is_published and not c.is_demo)),
      ('reports', (select count(distinct e.brief_version_id)::numeric from public.exports e
                     join public.brief_versions v on v.id = e.brief_version_id
                    where v.citation_check_passed))
  )
  select t.slug, t.label_it, t.label_en, t.release_target, t.project_target,
         coalesce(m.v, t.manual_value), m.v is not null, t.manual_note, t.updated_at, t.sort_order
    from public.acceptance_targets t
    left join m on m.slug = t.slug
   order by t.sort_order;
end;
$$;
revoke execute on function public.acceptance_progress() from public, anon;
grant execute on function public.acceptance_progress() to authenticated;
