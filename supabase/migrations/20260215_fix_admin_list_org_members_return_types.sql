-- Hotfix: align admin_list_org_members return-query types with RETURNS TABLE

create or replace function public.admin_list_org_members(p_org_id uuid)
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

