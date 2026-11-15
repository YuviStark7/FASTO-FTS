-- Admin users screen and the last-admin guard (migration 20261115090000).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Start from a database with exactly one admin of our own.
update public.memberships set role = 'member' where role = 'admin';
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a4', 'u-admin@test.local',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c4', 'u-member@test.local', 'authenticated', 'authenticated');
update public.memberships set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000000a4';

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c4","role":"authenticated"}';
select throws_ok($$select * from public.admin_users()$$, '42501', null, 'a member cannot list users');

set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select ok((select count(*) from public.admin_users() where email = 'u-member@test.local') = 1, 'an admin lists users with their email');
select throws_ok($$update public.memberships set role = 'member' where user_id = '00000000-0000-0000-0000-0000000000a4'$$,
  'P0001', null, 'the last admin cannot demote themselves');
select lives_ok($$update public.memberships set role = 'admin' where user_id = '00000000-0000-0000-0000-0000000000c4'$$,
  'an admin promotes another user');
select lives_ok($$update public.memberships set role = 'member' where user_id = '00000000-0000-0000-0000-0000000000a4'$$,
  'with a second admin, the first can step down');
select is((select count(*)::int from public.audit_log where table_name = 'memberships' and row_pk like '%00000000-0000-0000-0000-0000000000a4%'), 0,
  'audit rows are not readable after stepping down (admins only)');

select * from finish();
rollback;
