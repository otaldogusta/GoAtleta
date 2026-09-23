-- Narrow contact lookup for staff imported through class assignments.
-- Auth remains private; only organization administrators may read these emails.
create or replace function public.admin_list_org_staff_contacts(p_org_id uuid)
returns table (user_id uuid, email text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
  select distinct u.id, u.email::text
  from public.class_staff staff
  join public.classes c on c.id = staff.class_id and c.organization_id = p_org_id
  join auth.users u on u.id = staff.user_id
  where staff.organization_id = p_org_id;
end;
$$;
revoke all on function public.admin_list_org_staff_contacts(uuid) from public, anon;
grant execute on function public.admin_list_org_staff_contacts(uuid) to authenticated;
