-- Fix infinite recursion in organization_members RLS by using security definer helpers

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists(
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists(
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.role_level >= 50
  );
$$;

revoke all on function public.is_org_member(uuid) from anon, public;
grant execute on function public.is_org_member(uuid) to authenticated;

revoke all on function public.is_org_admin(uuid) from anon, public;
grant execute on function public.is_org_admin(uuid) to authenticated;

-- Update organization_members policies to use helper functions

drop policy if exists "organization_members select member" on public.organization_members;
create policy "organization_members select member" on public.organization_members
  for select
  using (public.is_org_member(organization_members.organization_id));

drop policy if exists "organization_members insert admin" on public.organization_members;
create policy "organization_members insert admin" on public.organization_members
  for insert
  with check (public.is_org_admin(organization_members.organization_id));

drop policy if exists "organization_members update admin" on public.organization_members;
create policy "organization_members update admin" on public.organization_members
  for update
  using (public.is_org_admin(organization_members.organization_id))
  with check (public.is_org_admin(organization_members.organization_id));

drop policy if exists "organization_members delete admin" on public.organization_members;
create policy "organization_members delete admin" on public.organization_members
  for delete
  using (public.is_org_admin(organization_members.organization_id));
