-- Two gaps found while building the Briefs screen:
-- 1. Once a brief was published, members could read every version of it, including newer drafts.
--    Non-staff now read only the current version of a published brief.
-- 2. The status trigger returned early when the status did not change, so the current version of
--    a published brief could be repointed by an analyst, even to a version that failed the
--    citation check. Repointing a published brief is now an admin action, and the citation check
--    applies to whatever version a published brief points to.

drop policy brief_versions_select on public.brief_versions;
create policy brief_versions_select on public.brief_versions for select to authenticated
  using (
    (select private.is_analyst())
    or exists (
      select 1 from public.briefs b
       where b.id = brief_id and b.status = 'published' and b.current_version_id = brief_versions.id
    )
  );

drop policy brief_citations_select on public.brief_citations;
create policy brief_citations_select on public.brief_citations for select to authenticated
  using (
    (select private.is_analyst())
    or exists (
      select 1 from public.briefs b
       where b.current_version_id = brief_version_id and b.status = 'published'
    )
  );

create or replace function private.guard_brief_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is not distinct from old.status
     and new.current_version_id is not distinct from old.current_version_id then
    return new;
  end if;
  -- Citation check applies to every role, service role included, on publish and on repointing a
  -- published brief.
  if new.status = 'published' and not exists (
       select 1 from public.brief_versions v
        where v.id = new.current_version_id and v.brief_id = new.id and v.citation_check_passed) then
    raise exception 'a brief whose current version failed the citation check cannot be published';
  end if;
  if current_user = 'authenticated' then
    if (new.status = 'published' or old.status = 'published') and not private.is_admin() then
      raise exception 'only admins publish, unpublish or change the published version of a brief';
    end if;
    if new.status = 'reviewed' and old.status = 'draft' then
      new.reviewed_by := (select auth.uid());
    end if;
  end if;
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_by := (select auth.uid());
    new.published_at := now();
  end if;
  return new;
end;
$$;
