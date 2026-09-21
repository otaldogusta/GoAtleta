create or replace function public.admin_replace_class_staff_assignments(
  p_org_id uuid,
  p_class_id text,
  p_assignments jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_invalid_count integer;
  v_head_count integer;
  v_head_user_id uuid;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id and c.organization_id = p_org_id
  ) then
    raise exception 'Class not found';
  end if;

  if jsonb_typeof(coalesce(p_assignments, '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid assignments';
  end if;

  select count(*) into v_invalid_count
  from jsonb_to_recordset(coalesce(p_assignments, '[]'::jsonb)) as item(user_id uuid, staff_role text)
  left join public.organization_members member
    on member.organization_id = p_org_id and member.user_id = item.user_id
  where item.user_id is null
     or item.staff_role not in ('head', 'assistant', 'intern')
     or member.user_id is null;

  if v_invalid_count > 0 then
    raise exception 'Invalid class staff assignment';
  end if;

  select count(*) into v_head_count
  from jsonb_to_recordset(coalesce(p_assignments, '[]'::jsonb)) as item(user_id uuid, staff_role text)
  where item.staff_role = 'head';

  if v_head_count > 1 then
    raise exception 'Only one head is allowed';
  end if;

  delete from public.class_staff staff
  where staff.organization_id = p_org_id and staff.class_id = p_class_id;

  insert into public.class_staff (organization_id, class_id, user_id, staff_role)
  select p_org_id, p_class_id, item.user_id, item.staff_role
  from jsonb_to_recordset(coalesce(p_assignments, '[]'::jsonb)) as item(user_id uuid, staff_role text)
  on conflict (class_id, user_id)
  do update set organization_id = excluded.organization_id, staff_role = excluded.staff_role;

  select item.user_id into v_head_user_id
  from jsonb_to_recordset(coalesce(p_assignments, '[]'::jsonb)) as item(user_id uuid, staff_role text)
  where item.staff_role = 'head'
  limit 1;

  update public.classes
  set owner_id = v_head_user_id
  where id = p_class_id and organization_id = p_org_id;
end;
$$;

revoke all on function public.admin_replace_class_staff_assignments(uuid, text, jsonb) from anon, public;
grant execute on function public.admin_replace_class_staff_assignments(uuid, text, jsonb) to authenticated;
