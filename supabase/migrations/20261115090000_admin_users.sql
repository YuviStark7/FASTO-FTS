-- Admin screens (Day 5): who the users are, and a guard so the platform always keeps an admin.

-- Users with their organisation and role, for the admin users screen. Emails live in auth.users,
-- which signed-in users cannot read; this function exposes them to admins only.
create function public.admin_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  org_id uuid,
  org_name text,
  role public.app_role,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email::text, p.display_name, m.org_id, o.name, m.role, u.created_at, u.last_sign_in_at
      from public.memberships m
      join auth.users u on u.id = m.user_id
      left join public.profiles p on p.id = m.user_id
      left join public.organizations o on o.id = m.org_id
     order by u.created_at desc;
end;
$$;
revoke execute on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;

-- The last admin cannot be demoted or removed: role changes are admin-only, so losing the last
-- admin would lock everyone out of roles, weights, sources and the kill switch.
create function private.keep_an_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role is distinct from 'admin')
     and not exists (select 1 from public.memberships where role = 'admin' and (org_id, user_id) <> (old.org_id, old.user_id)) then
    raise exception 'the last admin cannot be demoted or removed';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger memberships_keep_an_admin before update of role or delete on public.memberships
  for each row execute function private.keep_an_admin();
