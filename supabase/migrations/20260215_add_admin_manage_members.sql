-- PR10: Admin-only org member management via RPCs

-- Ensure RLS is enabled (idempotent)
alter table public.organization_members enable row level security;

-- List members (admin-only)
create or replace function public.admin_list_org_members(p_org_id uuid)
returns table (
  organization_id uuid,
  user_id uuid,
  role_level int,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    om.organization_id,
    om.user_id,
    om.role_level,
    om.created_at
  from public.organization_members om
  where om.organization_id = p_org_id
  order by om.role_level desc, om.created_at asc;
end;
$$;

-- Update member role (admin-only + lockout protection)
create or replace function public.admin_update_member_role(
  p_org_id uuid,
  p_user_id uuid,
  p_new_role_level int
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_current_role int;
  v_other_admin_count int;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  if p_new_role_level not in (5, 10, 50) then
    raise exception 'Invalid role_level';
  end if;

  select om.role_level
    into v_current_role
  from public.organization_members om
  where om.organization_id = p_org_id
    and om.user_id = p_user_id;

  if v_current_role is null then
    raise exception 'Member not found';
  end if;

  if v_current_role >= 50 and p_new_role_level < 50 then
    select count(*)
      into v_other_admin_count
    from public.organization_members om
    where om.organization_id = p_org_id
      and om.role_level >= 50
      and om.user_id <> p_user_id;

    if coalesce(v_other_admin_count, 0) = 0 then
      raise exception 'Cannot demote last admin';
    end if;
  end if;

  update public.organization_members
  set role_level = p_new_role_level
  where organization_id = p_org_id
    and user_id = p_user_id;
end;
$$;

-- Remove member (admin-only + self-remove block + lockout protection)
create or replace function public.admin_remove_org_member(
  p_org_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_current_role int;
  v_other_admin_count int;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Cannot remove yourself';
  end if;

  select om.role_level
    into v_current_role
  from public.organization_members om
  where om.organization_id = p_org_id
    and om.user_id = p_user_id;

  if v_current_role is null then
    raise exception 'Member not found';
  end if;

  if v_current_role >= 50 then
    select count(*)
      into v_other_admin_count
    from public.organization_members om
    where om.organization_id = p_org_id
      and om.role_level >= 50
      and om.user_id <> p_user_id;

    if coalesce(v_other_admin_count, 0) = 0 then
      raise exception 'Cannot remove last admin';
    end if;
  end if;

  delete from public.organization_members
  where organization_id = p_org_id
    and user_id = p_user_id;
end;
$$;

revoke all on function public.admin_list_org_members(uuid) from anon, public;
revoke all on function public.admin_update_member_role(uuid, uuid, int) from anon, public;
revoke all on function public.admin_remove_org_member(uuid, uuid) from anon, public;

grant execute on function public.admin_list_org_members(uuid) to authenticated;
grant execute on function public.admin_update_member_role(uuid, uuid, int) to authenticated;
grant execute on function public.admin_remove_org_member(uuid, uuid) to authenticated;
