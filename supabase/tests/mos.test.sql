-- MOS carries a grade exactly when it has a value, and never grade A (it is derived).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

create temp table k as
select (select id from public.categories where slug = 'cheese') as cat, (select id from public.territories where slug = 'roma') as ter;

select lives_ok($$
  insert into public.mos_snapshots (category_id, territory_id, mos, grade, components, coverage_pct, is_partial, method_version_id, is_demo)
  select cat, ter, 55.2, 'C', '{}', 85, true, 'mos-v1', true from k $$,
  'a scored MOS with grade C is accepted');
select lives_ok($$
  insert into public.mos_snapshots (category_id, territory_id, mos, grade, components, coverage_pct, is_partial, method_version_id, is_demo)
  select cat, ter, null, null, '{}', 20, true, 'mos-v1', true from k $$,
  'a missing MOS without grade is accepted');
select throws_ok($$
  insert into public.mos_snapshots (category_id, territory_id, mos, grade, components, coverage_pct, is_partial, method_version_id, is_demo)
  select cat, ter, 55.2, null, '{}', 85, true, 'mos-v1', true from k $$,
  '23514', null, 'a scored MOS without a grade is refused');
select throws_ok($$
  insert into public.mos_snapshots (category_id, territory_id, mos, grade, components, coverage_pct, is_partial, method_version_id, is_demo)
  select cat, ter, 55.2, 'A', '{}', 85, true, 'mos-v1', true from k $$,
  '23514', null, 'a derived MOS cannot be grade A');
select throws_ok($$
  update public.cells set mos = 40, mos_grade = null
  where category_id = (select cat from k) and territory_id = (select ter from k) $$,
  '23514', null, 'a cell cannot show a MOS without its grade');

select * from finish();
rollback;
