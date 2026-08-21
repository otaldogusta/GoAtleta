-- Resolve public class staff identities for members of the same organization.
-- E-mail and private Auth metadata remain server-side.

create or replace function public.list_org_class_staff_for_classes(
  p_org_id uuid,
  p_class_ids text[]
)
returns table (
  class_id text,
  user_id uuid,
  staff_role text,
  display_name text,
  photo_url text
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null or not public.is_org_member(p_org_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    staff.class_id,
    staff.user_id,
    staff.staff_role,
    coalesce(
      nullif(trim(member.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(member.raw_user_meta_data->>'name'), ''),
      nullif(trim(member.raw_user_meta_data->>'display_name'), ''),
      case staff.staff_role
        when 'head' then 'Professor responsável'
        when 'assistant' then 'Auxiliar'
        else 'Estagiário(a)'
      end
    ) as display_name,
    nullif(trim(profile.photo_url), '') as photo_url
  from public.class_staff staff
  join public.classes class_group
    on class_group.id = staff.class_id
   and class_group.organization_id = p_org_id
  left join auth.users member
    on member.id = staff.user_id
  left join public.user_profiles profile
    on profile.user_id = staff.user_id
  where staff.organization_id = p_org_id
    and staff.class_id = any(coalesce(p_class_ids, '{}'::text[]))
  order by
    class_group.name asc,
    case staff.staff_role when 'head' then 0 when 'assistant' then 1 else 2 end,
    4 asc;
end;
$$;

revoke all on function public.list_org_class_staff_for_classes(uuid, text[])
  from public, anon, authenticated;
grant execute on function public.list_org_class_staff_for_classes(uuid, text[])
  to authenticated;
