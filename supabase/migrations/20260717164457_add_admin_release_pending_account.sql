-- Allow organization coordinators to release an already registered account
-- without exposing a global directory of auth users.

create or replace function public.admin_add_org_member_by_email(
  p_org_id uuid,
  p_email text,
  p_role_level int
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  v_user_id uuid;
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  if p_role_level not in (5, 10, 50) then
    raise exception 'Invalid role_level';
  end if;

  if v_email = '' then
    raise exception 'Email required';
  end if;

  select u.id
    into v_user_id
  from auth.users u
  where lower(u.email::text) = v_email
  limit 1;

  if v_user_id is null then
    raise exception 'Account not found';
  end if;

  insert into public.trainers (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  insert into public.organization_members (
    organization_id,
    user_id,
    role_level
  )
  values (
    p_org_id,
    v_user_id,
    p_role_level
  )
  on conflict (organization_id, user_id)
  do update set
    role_level = greatest(
      public.organization_members.role_level,
      excluded.role_level
    );
end;
$$;

revoke all on function public.admin_add_org_member_by_email(uuid, text, int)
  from public, anon;
grant execute on function public.admin_add_org_member_by_email(uuid, text, int)
  to authenticated;
