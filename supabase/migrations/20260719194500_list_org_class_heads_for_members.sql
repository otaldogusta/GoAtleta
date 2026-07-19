-- Allow organization members to resolve the public identity of each class head.
-- Private e-mail and source metadata remain server-side.

create or replace function public.list_org_class_heads_for_classes(
  p_org_id uuid,
  p_class_ids text[]
)
returns table (
  class_id text,
  user_id uuid,
  class_name text,
  unit text,
  display_name text,
  photo_url text
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null or not public.is_org_member(p_org_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    cs.class_id,
    cs.user_id,
    c.name as class_name,
    coalesce(nullif(trim(c.unit), ''), 'Sem unidade') as unit,
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
      'Professor responsável'
    ) as display_name,
    nullif(trim(up.photo_url), '') as photo_url
  from public.class_staff cs
  join public.classes c
    on c.id = cs.class_id
  left join auth.users u
    on u.id = cs.user_id
  left join public.user_profiles up
    on up.user_id = cs.user_id
  where cs.organization_id = p_org_id
    and c.organization_id = p_org_id
    and cs.staff_role = 'head'
    and cs.class_id = any(coalesce(p_class_ids, '{}'::text[]))
  order by c.name asc;
end;
$$;

revoke all on function public.list_org_class_heads_for_classes(uuid, text[])
  from anon, public;
grant execute on function public.list_org_class_heads_for_classes(uuid, text[])
  to authenticated;
