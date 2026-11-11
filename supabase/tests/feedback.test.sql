-- Human review loop: ratings stay private to their author; admins read aggregates only.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a2', 'f-admin@test.local',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'f-member@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'f-member2@test.local', 'authenticated', 'authenticated');
update public.memberships set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000000a2';

insert into public.csi_snapshots (category_id, territory_id, period_start, period_end, csi, n_mentions,
  representativeness_note, is_published, method_version_id, is_demo)
select (select id from public.categories where slug = 'cheese'), (select id from public.territories where slug = 'it'),
  '2026-01-01', '2026-10-31', 60, 60, 'TEST', true, 'csi-v1', true;
create temp table snap as select max(id) as id from public.csi_snapshots;
grant select on snap to authenticated;

insert into public.feedback (org_id, user_id, target_type, target_id, rating, comment)
select m.org_id, m.user_id, 'csi_snapshot', (select id from snap), r.rating::public.feedback_rating, r.comment
from public.memberships m
join (values ('00000000-0000-0000-0000-0000000000c2'::uuid, 'right', 'matches our panel'),
             ('00000000-0000-0000-0000-0000000000c3'::uuid, 'wrong', null)) r(uid, rating, comment) on r.uid = m.user_id;

-- member
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select is((select count(*)::int from public.feedback), 1, 'member sees only their own rating');
select throws_ok($$select * from public.feedback_summary()$$, '42501', 'admins only', 'member cannot read the summary');
reset role;

-- admin
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select is((select count(*)::int from public.feedback), 0, 'admin still cannot read raw rows of others');
select is((select n_right + n_wrong from public.feedback_summary() where csi_snapshot_id = (select id from snap)), 2,
  'admin sees both ratings in the summary');
select is((select comments from public.feedback_summary() where csi_snapshot_id = (select id from snap)),
  array['matches our panel'], 'summary carries comment texts');
reset role;

-- anon
set local role anon;
select throws_ok($$select * from public.feedback_summary()$$, '42501', null, 'anon cannot call the summary');
reset role;

select * from finish();
rollback;
