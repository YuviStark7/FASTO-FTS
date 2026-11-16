-- Acceptance dashboard: measured values, staff-only reading, admin-only manual values.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a5', 'acc-admin@test.local',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b5', 'acc-analyst@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c5', 'acc-member@test.local',  'authenticated', 'authenticated');
update public.memberships set role = 'admin'   where user_id = '00000000-0000-0000-0000-0000000000a5';
update public.memberships set role = 'analyst' where user_id = '00000000-0000-0000-0000-0000000000b5';

-- A published brief whose version passed, exported once; and a draft that is not counted.
insert into public.briefs (category_id, territory_id, status)
select (select id from public.categories where slug = 'honey'), (select id from public.territories where slug = 'napoli'), 'draft';
insert into public.brief_versions (brief_id, version, content, model, prompt_version, citation_check_passed)
select max(id), 1, '{}'::jsonb, 'test', 'test', true from public.briefs;
update public.briefs set current_version_id = (select max(id) from public.brief_versions), status = 'published'
 where id = (select max(id) from public.briefs);
insert into public.exports (org_id, user_id, brief_version_id, format)
select m.org_id, m.user_id, (select max(id) from public.brief_versions), 'pdf'
  from public.memberships m where m.user_id = '00000000-0000-0000-0000-0000000000c5';

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c5","role":"authenticated"}';
select throws_ok($$select * from public.acceptance_progress()$$, '42501', null, 'a member cannot read the acceptance dashboard');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}';
select is((select count(*)::int from public.acceptance_progress()), 9, 'an analyst reads all nine targets');
select is((select current_value from public.acceptance_progress() where slug = 'categories'), 15::numeric, 'categories are measured');
select is((select current_value from public.acceptance_progress() where slug = 'territories'), 20::numeric, 'pilot territories are measured');
select ok((select current_value from public.acceptance_progress() where slug = 'reviewed_sheets') >= 1, 'a published, checked brief counts as a reviewed sheet');
select ok((select current_value from public.acceptance_progress() where slug = 'reports') >= 1, 'an exported, checked version counts as a report');
select is((select measured from public.acceptance_progress() where slug = 'firms'), false, 'firms are not measured');
select lives_ok($$update public.acceptance_targets set manual_value = 9 where slug = 'firms'$$, 'the analyst''s update runs');
select is((select manual_value from public.acceptance_targets where slug = 'firms'), null::numeric, '...but RLS lets only admins change manual values');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
update public.acceptance_targets set manual_value = 2, manual_note = 'pilot firms signed' where slug = 'firms';
select is((select current_value from public.acceptance_progress() where slug = 'firms'), 2::numeric, 'an admin records the number of firms');

select * from finish();
rollback;
