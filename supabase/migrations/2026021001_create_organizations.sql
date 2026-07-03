-- ========================================
-- PR 1: Multi-Workspace Foundation
-- Organizations + Organization Members
-- ========================================

-- 1) Create organizations table
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 2) Create organization_members table
-- Role levels: 5=estagiário, 10=professor, 50=admin
create table if not exists public.organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_level int not null default 10,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- 3) Create indices for performance
create index if not exists organization_members_user_id on organization_members(user_id);
create index if not exists organization_members_role on organization_members(organization_id, role_level);

-- ========================================
-- RLS Policies
-- ========================================

-- Enable RLS
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

-- Organizations: members can see their own orgs
drop policy if exists "organizations select member" on public.organizations;
create policy "organizations select member" on public.organizations
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organizations.id
        and om.user_id = auth.uid()
    )
  );

-- Organizations: creator or admin can update
drop policy if exists "organizations update admin" on public.organizations;
create policy "organizations update admin" on public.organizations
  for update
  using (
    created_by = auth.uid()
    or exists (
      select 1 from organization_members om
      where om.organization_id = organizations.id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

-- Organizations: creator or admin can delete
drop policy if exists "organizations delete admin" on public.organizations;
create policy "organizations delete admin" on public.organizations
  for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1 from organization_members om
      where om.organization_id = organizations.id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

-- Organizations: authenticated users can create (will become admin via insert below)
drop policy if exists "organizations insert authenticated" on public.organizations;
create policy "organizations insert authenticated" on public.organizations
  for insert
  with check (auth.uid() is not null and created_by = auth.uid());

-- Organization Members: members can see other members in same org
drop policy if exists "organization_members select member" on public.organization_members;
create policy "organization_members select member" on public.organization_members
  for select
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
        and om.user_id = auth.uid()
    )
  );

-- Organization Members: only admins (role_level >= 50) can insert
drop policy if exists "organization_members insert admin" on public.organization_members;
create policy "organization_members insert admin" on public.organization_members
  for insert
  with check (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

-- Organization Members: only admins can update
drop policy if exists "organization_members update admin" on public.organization_members;
create policy "organization_members update admin" on public.organization_members
  for update
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

-- Organization Members: only admins can delete
drop policy if exists "organization_members delete admin" on public.organization_members;
create policy "organization_members delete admin" on public.organization_members
  for delete
  using (
    exists (
      select 1 from organization_members om
      where om.organization_id = organization_members.organization_id
        and om.user_id = auth.uid()
        and om.role_level >= 50
    )
  );

-- ========================================
-- RPC: Get user's organizations with role
-- ========================================

create or replace function public.get_my_organizations()
returns table(id uuid, name text, role_level int, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.name, om.role_level, o.created_at
  from organizations o
  join organization_members om on o.id = om.organization_id
  where om.user_id = auth.uid()
  order by o.created_at desc;
$$;

-- Grant access to authenticated users
revoke all on function public.get_my_organizations() from anon, public;
grant execute on function public.get_my_organizations() to authenticated;

-- ========================================
-- Helper function: Create org + auto-add creator as admin
-- ========================================

create or replace function public.create_organization_with_admin(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
begin
  -- Insert organization
  insert into organizations (name, created_by)
  values (org_name, auth.uid())
  returning id into new_org_id;
  
  -- Auto-add creator as admin (role_level = 50)
  insert into organization_members (organization_id, user_id, role_level)
  values (new_org_id, auth.uid(), 50);
  
  return new_org_id;
end;
$$;

revoke all on function public.create_organization_with_admin(text) from anon, public;
grant execute on function public.create_organization_with_admin(text) to authenticated;
