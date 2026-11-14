-- Published brief versions: members read only the current one; repointing a published brief is
-- admin-only and subject to the citation check (migration 20261114090000).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a3', 'b-admin@test.local',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b3', 'b-analyst@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'b-member@test.local',  'authenticated', 'authenticated');
update public.memberships set role = 'admin'   where user_id = '00000000-0000-0000-0000-0000000000a3';
update public.memberships set role = 'analyst' where user_id = '00000000-0000-0000-0000-0000000000b3';

insert into public.briefs (category_id, territory_id, status)
select (select id from public.categories where slug = 'pasta'), (select id from public.territories where slug = 'milano'), 'draft';
create temp table b as select max(id) as id from public.briefs;
insert into public.brief_versions (brief_id, version, content, model, prompt_version, citation_check_passed)
select id, v.n, '{}'::jsonb, 'test', 'test', v.ok from b cross join (values (1, true), (2, true), (3, false)) v(n, ok);
create temp table v as
select (select id from public.brief_versions where brief_id = (select id from b) and version = 1) as v1,
       (select id from public.brief_versions where brief_id = (select id from b) and version = 2) as v2,
       (select id from public.brief_versions where brief_id = (select id from b) and version = 3) as v3;
grant select on b, v to authenticated;
update public.briefs set current_version_id = (select v1 from v), status = 'published' where id = (select id from b);
insert into public.brief_citations (brief_version_id, sentence_path, snapshot_ref)
select x, 'sections.0.sentences.0', 'trend_snapshots:1' from (select v1 as x from v union all select v2 from v) s;

-- member
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}';
select is((select count(*)::int from public.brief_versions where brief_id = (select id from b)), 1, 'member reads only the published version');
select is((select count(*)::int from public.brief_citations where brief_version_id in ((select v1 from v), (select v2 from v))), 1,
  'member reads only the published version''s citations');

-- analyst
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b3","role":"authenticated"}';
select is((select count(*)::int from public.brief_versions where brief_id = (select id from b)), 3, 'analyst reads every version');
select throws_ok($$update public.briefs set current_version_id = (select v2 from v) where id = (select id from b)$$,
  'P0001', null, 'analyst cannot repoint a published brief');
select throws_ok($$update public.briefs set current_version_id = (select v3 from v) where id = (select id from b)$$,
  'P0001', null, 'analyst cannot repoint a published brief to a failing version');

-- admin
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok($$update public.briefs set current_version_id = (select v3 from v) where id = (select id from b)$$,
  'P0001', null, 'admin cannot point a published brief at a version that failed the citation check');
select lives_ok($$update public.briefs set current_version_id = (select v2 from v) where id = (select id from b)$$,
  'admin can promote a passing version of a published brief');
select is((select current_version_id from public.briefs where id = (select id from b)), (select v2 from v), 'the published version is now v2');

reset role;
-- service role (generation) leaves a published brief alone, but even it cannot publish a failing version
select throws_ok($$update public.briefs set current_version_id = (select v3 from v) where id = (select id from b)$$,
  'P0001', null, 'the citation check also binds the service role');

select * from finish();
rollback;
