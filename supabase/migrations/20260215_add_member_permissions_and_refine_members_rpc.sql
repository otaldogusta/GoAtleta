-- PR10 UX+: member metadata + per-screen permission overrides

-- ---------------------------------------------------------------------------
-- 1) Refine admin_list_org_members to include display name and email
-- ---------------------------------------------------------------------------
drop function if exists public.admin_list_org_members(uuid);

create function public.admin_list_org_members(p_org_id uuid)
returns table (
  organization_id uuid,
  user_id uuid,
  role_level int,
  created_at timestamptz,
  display_name text,
  email text
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
    om.role_level::int as role_level,
    om.created_at,
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(split_part(coalesce(u.email::text, ''), '@', 1), ''),
      om.user_id::text
    ) as display_name,
    u.email::text as email
  from public.organization_members om
  left join auth.users u
    on u.id = om.user_id
  where om.organization_id = p_org_id
  order by om.role_level desc, om.created_at asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2) Permission override table
-- ---------------------------------------------------------------------------
create table if not exists public.organization_member_permissions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null,
  is_allowed boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (organization_id, user_id, permission_key),
  check (
    permission_key in (
      'reports',
      'events',
      'students',
      'classes',
      'training',
      'periodization',
      'calendar',
      'absence_notices',
      'whatsapp_settings',
      'assistant',
      'org_members'
    )
  )
);

create index if not exists org_member_permissions_org_user
  on public.organization_member_permissions(organization_id, user_id);

alter table public.organization_member_permissions enable row level security;

drop policy if exists "org_member_permissions select own_or_admin" on public.organization_member_permissions;
create policy "org_member_permissions select own_or_admin"
  on public.organization_member_permissions
  for select
  using (
    user_id = auth.uid()
    or public.is_org_admin(organization_member_permissions.organization_id)
  );

drop policy if exists "org_member_permissions insert admin" on public.organization_member_permissions;
create policy "org_member_permissions insert admin"
  on public.organization_member_permissions
  for insert
  with check (public.is_org_admin(organization_member_permissions.organization_id));

drop policy if exists "org_member_permissions update admin" on public.organization_member_permissions;
create policy "org_member_permissions update admin"
  on public.organization_member_permissions
  for update
  using (public.is_org_admin(organization_member_permissions.organization_id))
  with check (public.is_org_admin(organization_member_permissions.organization_id));

drop policy if exists "org_member_permissions delete admin" on public.organization_member_permissions;
create policy "org_member_permissions delete admin"
  on public.organization_member_permissions
  for delete
  using (public.is_org_admin(organization_member_permissions.organization_id));

-- ---------------------------------------------------------------------------
-- 3) Helpers and RPCs for effective permissions
-- ---------------------------------------------------------------------------
create or replace function public.default_member_permission(
  p_role_level int,
  p_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select case
    when p_permission_key = 'org_members' then coalesce(p_role_level, 0) >= 50
    else true
  end;
$$;

create or replace function public.admin_list_member_permissions(
  p_org_id uuid,
  p_user_id uuid
)
returns table (
  permission_key text,
  is_allowed boolean
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_role_level int;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  select om.role_level
    into v_role_level
  from public.organization_members om
  where om.organization_id = p_org_id
    and om.user_id = p_user_id;

  if v_role_level is null then
    raise exception 'Member not found';
  end if;

  return query
  with keys as (
    select unnest(array[
      'reports',
      'events',
      'students',
      'classes',
      'training',
      'periodization',
      'calendar',
      'absence_notices',
      'whatsapp_settings',
      'assistant',
      'org_members'
    ]::text[]) as permission_key
  )
  select
    k.permission_key,
    coalesce(
      omp.is_allowed,
      public.default_member_permission(v_role_level, k.permission_key)
    ) as is_allowed
  from keys k
  left join public.organization_member_permissions omp
    on omp.organization_id = p_org_id
   and omp.user_id = p_user_id
   and omp.permission_key = k.permission_key
  order by k.permission_key;
end;
$$;

create or replace function public.admin_set_member_permission(
  p_org_id uuid,
  p_user_id uuid,
  p_permission_key text,
  p_is_allowed boolean
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_role_level int;
  v_default boolean;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  if p_permission_key not in (
    'reports',
    'events',
    'students',
    'classes',
    'training',
    'periodization',
    'calendar',
    'absence_notices',
    'whatsapp_settings',
    'assistant',
    'org_members'
  ) then
    raise exception 'Invalid permission_key';
  end if;

  select om.role_level
    into v_role_level
  from public.organization_members om
  where om.organization_id = p_org_id
    and om.user_id = p_user_id;

  if v_role_level is null then
    raise exception 'Member not found';
  end if;

  if p_permission_key = 'org_members' and p_user_id = auth.uid() and p_is_allowed = false then
    raise exception 'Cannot disable own org_members permission';
  end if;

  v_default := public.default_member_permission(v_role_level, p_permission_key);

  if p_is_allowed = v_default then
    delete from public.organization_member_permissions
    where organization_id = p_org_id
      and user_id = p_user_id
      and permission_key = p_permission_key;
    return;
  end if;

  insert into public.organization_member_permissions (
    organization_id,
    user_id,
    permission_key,
    is_allowed,
    updated_at,
    updated_by
  )
  values (
    p_org_id,
    p_user_id,
    p_permission_key,
    p_is_allowed,
    now(),
    auth.uid()
  )
  on conflict (organization_id, user_id, permission_key)
  do update set
    is_allowed = excluded.is_allowed,
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;

create or replace function public.get_my_member_permissions(
  p_org_id uuid
)
returns table (
  permission_key text,
  is_allowed boolean
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_role_level int;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'Not authorized';
  end if;

  select om.role_level
    into v_role_level
  from public.organization_members om
  where om.organization_id = p_org_id
    and om.user_id = auth.uid();

  if v_role_level is null then
    raise exception 'Member not found';
  end if;

  return query
  with keys as (
    select unnest(array[
      'reports',
      'events',
      'students',
      'classes',
      'training',
      'periodization',
      'calendar',
      'absence_notices',
      'whatsapp_settings',
      'assistant',
      'org_members'
    ]::text[]) as permission_key
  )
  select
    k.permission_key,
    coalesce(
      omp.is_allowed,
      public.default_member_permission(v_role_level, k.permission_key)
    ) as is_allowed
  from keys k
  left join public.organization_member_permissions omp
    on omp.organization_id = p_org_id
   and omp.user_id = auth.uid()
   and omp.permission_key = k.permission_key
  order by k.permission_key;
end;
$$;

revoke all on function public.default_member_permission(int, text) from anon, public;
revoke all on function public.admin_list_org_members(uuid) from anon, public;
revoke all on function public.admin_list_member_permissions(uuid, uuid) from anon, public;
revoke all on function public.admin_set_member_permission(uuid, uuid, text, boolean) from anon, public;
revoke all on function public.get_my_member_permissions(uuid) from anon, public;

grant execute on function public.default_member_permission(int, text) to authenticated;
grant execute on function public.admin_list_org_members(uuid) to authenticated;
grant execute on function public.admin_list_member_permissions(uuid, uuid) to authenticated;
grant execute on function public.admin_set_member_permission(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.get_my_member_permissions(uuid) to authenticated;
