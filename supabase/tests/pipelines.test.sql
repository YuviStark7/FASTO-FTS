-- Day 2 access rules: connector reruns, source editing, raw files, derived tables.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'p-admin@test.local',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'p-analyst@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'p-member@test.local',  'authenticated', 'authenticated');
update public.memberships set role = 'admin'   where user_id = '00000000-0000-0000-0000-0000000000a1';
update public.memberships set role = 'analyst' where user_id = '00000000-0000-0000-0000-0000000000b1';

-- A raw file in the private bucket, written as the pipeline would (service side).
insert into storage.objects (bucket_id, name) values ('raw-files', 'eurostat/1/test.json');

-- ---------------------------------------------------------------- member
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select throws_ok($$insert into public.source_runs (source_id) select id from public.sources where slug = 'eurostat'$$,
  '42501', null, 'member cannot queue a connector run');
select lives_ok($$update public.sources set is_active = true where slug = 'eurostat'$$, 'member update of sources is filtered by RLS');
select is((select is_active from public.sources where slug = 'eurostat'), false, 'source unchanged by member');
select is((select count(*)::int from storage.objects where bucket_id = 'raw-files'), 0, 'member cannot list raw files');
select throws_ok($$insert into public.trend_snapshots (category_id, territory_id, status, reason, method_version_id)
                  values (1, 1, 'expanding', 'x', 'trend-v1')$$, '42501', null, 'member cannot write trend snapshots');
select throws_ok($$update public.cells set status = 'expanding'$$, '42501', null, 'member cannot write cells');
select ok((select count(*) from public.territories where level = 'region') = 19, 'member reads the 19 regions');
reset role;

-- ---------------------------------------------------------------- analyst
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select lives_ok($$insert into public.source_runs (source_id) select id from public.sources where slug = 'eurostat'$$,
  'analyst queues a connector run');
select is((select status::text from public.source_runs order by id desc limit 1), 'queued', 'queued run starts as queued');
select is((select requested_by from public.source_runs order by id desc limit 1), '00000000-0000-0000-0000-0000000000b1'::uuid,
  'queued run records who asked');
select throws_ok($$insert into public.source_runs (source_id, status) select id, 'succeeded' from public.sources where slug = 'istat'$$,
  '42501', null, 'analyst cannot insert a run with its own status');
select throws_ok($$update public.source_runs set status = 'succeeded'$$, '42501', null, 'analyst cannot change a run status');
select lives_ok($$update public.sources set is_active = true where slug = 'eurostat'$$, 'analyst update of sources is filtered by RLS');
select is((select is_active from public.sources where slug = 'eurostat'), false, 'only admins activate sources');
reset role;

-- ---------------------------------------------------------------- admin
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok($$update public.sources set is_active = true where slug = 'eurostat'$$, 'admin activates a source');
reset role;
select ok((select count(*) from public.audit_log where table_name = 'sources' and new_row->>'is_active' = 'true') >= 1,
  'source activation is audited');

select * from finish();
rollback;
