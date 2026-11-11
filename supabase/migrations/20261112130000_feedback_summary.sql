-- Human review loop (SPEC section 9): admins need the ratings of every pilot user on each CSI
-- reading. feedback_own (restrictive) keeps rows private to their author, and that stays: this
-- function returns aggregates and comment texts only, never who wrote them, and only to admins.

create function public.feedback_summary()
returns table (
  csi_snapshot_id  bigint,
  category_slug    text,
  territory_slug   text,
  csi              numeric,
  n_mentions       integer,
  is_demo          boolean,
  computed_at      timestamptz,
  n_right          integer,
  n_partly_right   integer,
  n_wrong          integer,
  comments         text[]
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
  select s.id, c.slug, t.slug, s.csi, s.n_mentions, s.is_demo, s.computed_at,
         (count(*) filter (where f.rating = 'right'))::int,
         (count(*) filter (where f.rating = 'partly_right'))::int,
         (count(*) filter (where f.rating = 'wrong'))::int,
         coalesce(array_agg(f.comment order by f.created_at desc) filter (where f.comment is not null and f.comment <> ''), '{}')
  from public.feedback f
  join public.csi_snapshots s on s.id = f.target_id
  join public.categories c on c.id = s.category_id
  join public.territories t on t.id = s.territory_id
  where f.target_type = 'csi_snapshot'
  group by s.id, c.slug, t.slug
  order by max(f.created_at) desc;
end;
$$;

revoke all on function public.feedback_summary() from public, anon;
grant execute on function public.feedback_summary() to authenticated;
