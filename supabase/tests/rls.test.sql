-- RLS tests: sign in as each role and assert what it can and cannot do. SPEC section 5.
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'analyst@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'member@test.local',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'viewer@test.local',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000e', 'other@test.local',   'authenticated', 'authenticated');

update public.memberships set role = 'admin'   where user_id = '00000000-0000-0000-0000-00000000000a';
update public.memberships set role = 'analyst' where user_id = '00000000-0000-0000-0000-00000000000b';
update public.memberships set role = 'viewer'  where user_id = '00000000-0000-0000-0000-00000000000d';

create temp table ids as
select
  (select org_id from public.memberships where user_id = '00000000-0000-0000-0000-00000000000c') as member_org,
  (select org_id from public.memberships where user_id = '00000000-0000-0000-0000-00000000000d') as viewer_org,
  (select org_id from public.memberships where user_id = '00000000-0000-0000-0000-00000000000e') as other_org,
  (select id from public.categories where slug = 'honey') as cat,
  (select id from public.territories where slug = 'roma') as terr;
grant select on ids to authenticated;

-- A draft brief and a published brief (written as service role / postgres).
insert into public.briefs (category_id, territory_id, status)
select cat, terr, 'draft' from ids;
insert into public.briefs (category_id, territory_id, status)
select cat, (select id from public.territories where slug = 'milano'), 'published' from ids;
insert into public.brief_versions (brief_id, version, content, model, prompt_version, citation_check_passed)
select id, 1, '{}'::jsonb, 'test', 'test', false from public.briefs where status = 'draft';

-- ---------------------------------------------------------------- sign-up trigger
select is((select count(*)::int from public.memberships where user_id = '00000000-0000-0000-0000-00000000000e'), 1,
  'new user gets exactly one membership');
select is((select role::text from public.memberships where user_id = '00000000-0000-0000-0000-00000000000e'), 'member',
  'new user starts as member');
select ok((select is_personal from public.organizations where id = (select other_org from ids)),
  'new user gets a personal organisation');

-- ---------------------------------------------------------------- anon
set local role anon;
select throws_ok('select * from public.observations', '42501', null, 'anon cannot read observations');
select throws_ok('select * from public.categories',   '42501', null, 'anon cannot read categories');
reset role;

-- ---------------------------------------------------------------- member
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';

select is((select count(*)::int from public.categories), 15, 'member reads taxonomy');
select is((select count(*)::int from public.cells), 300, 'member reads all 300 cells');
select throws_ok($$insert into public.observations (territory_id, indicator_id, period_start, period_end, value, unit, grade, source_id, method_version_id, is_demo)
                  values (1, 1, '2024-01-01', '2024-12-31', 1, 'x', 'A', 1, 'demo-v1', true)$$,
  '42501', null, 'member cannot write observations');
select throws_ok($$update public.categories set name_en = 'x'$$, '42501', null, 'member cannot edit taxonomy');
select is((select count(*)::int from public.briefs), 1, 'member sees only the published brief');
select is((select count(*)::int from public.brief_versions), 0, 'member cannot see draft brief versions');

-- role escalation
update public.memberships set role = 'admin' where user_id = '00000000-0000-0000-0000-00000000000c';
select is((select role::text from public.memberships where user_id = '00000000-0000-0000-0000-00000000000c'), 'member',
  'member cannot raise their own role');
select throws_ok($$insert into public.memberships (org_id, user_id, role) select other_org, '00000000-0000-0000-0000-00000000000c', 'admin' from ids$$,
  '42501', null, 'member cannot add themselves to another org');
select throws_ok($$update public.memberships set org_id = (select other_org from ids)$$, '42501', null,
  'member cannot move membership to another org');

-- user space
select lives_ok($$insert into public.watchlists (org_id, user_id, category_id, territory_id)
                  select member_org, '00000000-0000-0000-0000-00000000000c', cat, terr from ids$$,
  'member saves a watchlist in their own org');
select throws_ok($$insert into public.watchlists (org_id, user_id, category_id, territory_id)
                  select other_org, '00000000-0000-0000-0000-00000000000c', cat, terr from ids$$,
  '42501', null, 'member cannot write into another org');
select lives_ok($$insert into public.product_passports (org_id, name, category_id) select member_org, 'Miele di sulla', cat from ids$$,
  'member creates a product passport');
select lives_ok($$insert into public.weight_sets (org_id, name, weights)
                  select member_org, 'Mine', '{"growth":0.4,"size":0.2,"csi":0.2,"pressure":0.1,"fit":0.1}' from ids$$,
  'member creates an org weight set');
select lives_ok($$update public.weight_sets set weights = '{"growth":1,"size":0,"csi":0,"pressure":0,"fit":0}' where org_id is null$$,
  'member update of system weight set is filtered by RLS');
select is((select count(*)::int from public.weight_sets where org_id is null and (weights->>'growth')::numeric = 0.30), 1,
  'system weight set unchanged');
select throws_ok($$insert into public.source_runs (source_id) values (1)$$, '42501', null, 'member cannot request a connector run');
select is((select count(*)::int from public.audit_log), 0, 'member cannot read audit log');
select lives_ok($$update public.app_config set value = 'false' where key = 'ai.enabled'$$,
  'member update of the AI kill switch is filtered by RLS');
select is((select value::text from public.app_config where key = 'ai.enabled'), 'true', 'kill switch unchanged');
select is((select count(*)::int from public.profiles), 1, 'member sees only their own profile');
reset role;

-- ---------------------------------------------------------------- other org cannot see member's data
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
select is((select count(*)::int from public.watchlists), 0, 'other org sees no foreign watchlists');
select is((select count(*)::int from public.product_passports), 0, 'other org sees no foreign passports');
select is((select count(*)::int from public.weight_sets), 1, 'other org sees only the system weight set');
reset role;

-- ---------------------------------------------------------------- viewer
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}';
select is((select count(*)::int from public.briefs), 1, 'viewer reads published briefs');
select throws_ok($$insert into public.watchlists (org_id, user_id, category_id, territory_id)
                  select viewer_org, '00000000-0000-0000-0000-00000000000d', cat, terr from ids$$,
  '42501', null, 'viewer cannot write user space');
reset role;

-- ---------------------------------------------------------------- analyst
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*)::int from public.briefs), 2, 'analyst sees draft and published briefs');
select lives_ok($$insert into public.source_runs (source_id) values (1)$$, 'analyst requests a connector rerun');
select is((select status::text from public.source_runs order by id desc limit 1), 'queued', 'requested run is queued');
select lives_ok($$update public.briefs set status = 'reviewed' where status = 'draft'$$, 'analyst marks a draft reviewed');
select throws_ok($$update public.briefs set status = 'published' where status = 'reviewed'$$, 'P0001', null,
  'analyst cannot publish a brief');
update public.memberships set role = 'admin' where user_id = '00000000-0000-0000-0000-00000000000b';
select is((select role::text from public.memberships where user_id = '00000000-0000-0000-0000-00000000000b'), 'analyst',
  'analyst cannot raise their own role');
reset role;

-- ---------------------------------------------------------------- admin
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok($$update public.briefs set status = 'published' where status = 'reviewed'$$, 'P0001', null,
  'admin cannot publish a brief that failed the citation check');
select lives_ok($$update public.memberships set role = 'analyst' where user_id = '00000000-0000-0000-0000-00000000000c'$$,
  'admin changes a role');
select ok((select count(*) from public.audit_log where table_name = 'memberships' and action = 'UPDATE'
             and new_row->>'role' = 'analyst') >= 1, 'role change is written to the audit log');
select throws_ok($$delete from public.audit_log$$, '42501', null, 'admin cannot delete audit log rows');
reset role;

-- even the table owner cannot rewrite history
select throws_ok($$update public.audit_log set action = 'X'$$, 'P0001', 'audit_log is append-only',
  'audit log is append-only for every role');

select * from finish();
rollback;
