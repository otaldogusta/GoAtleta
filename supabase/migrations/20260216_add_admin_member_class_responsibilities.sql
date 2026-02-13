-- PR11: Admin management of class responsibilities by organization member

-- ---------------------------------------------------------------------------
-- 1) Integrity: one responsible (head) per class
-- ---------------------------------------------------------------------------
with ranked_heads as (
  select
    cs.id,
    row_number() over (
      partition by cs.class_id
      order by cs.created_at asc, cs.id asc
    ) as rn
  from public.class_staff cs
  where cs.staff_role = 'head'
)
delete from public.class_staff cs
using ranked_heads rh
where cs.id = rh.id
  and rh.rn > 1;

create unique index if not exists class_staff_one_head_per_class
  on public.class_staff(class_id)
  where staff_role = 'head';

-- ---------------------------------------------------------------------------
-- 2) RPCs: classes and current heads for org
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_org_classes(p_org_id uuid)
returns table (
  id text,
  name text,
  unit text
)
language plpgsql
stable
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
    c.id,
    c.name,
    coalesce(nullif(trim(c.unit), ''), 'Sem unidade') as unit
  from public.classes c
  where c.organization_id = p_org_id
  order by c.name asc;
end;
$$;

create or replace function public.admin_list_org_member_class_heads(p_org_id uuid)
returns table (
  user_id uuid,
  class_id text,
  class_name text,
  unit text
)
language plpgsql
stable
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
    cs.user_id,
    cs.class_id,
    c.name as class_name,
    coalesce(nullif(trim(c.unit), ''), 'Sem unidade') as unit
  from public.class_staff cs
  join public.classes c
    on c.id = cs.class_id
  where cs.organization_id = p_org_id
    and c.organization_id = p_org_id
    and cs.staff_role = 'head'
  order by c.name asc;
end;
$$;

create or replace function public.admin_set_member_class_heads(
  p_org_id uuid,
  p_user_id uuid,
  p_class_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_role_level int;
  v_class_ids text[] := '{}'::text[];
  v_removed_class_ids text[] := '{}'::text[];
  v_invalid_count int;
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

  if v_role_level < 10 then
    raise exception 'Member role not eligible for class responsibility';
  end if;

  select coalesce(array_agg(distinct trimmed_id), '{}'::text[])
    into v_class_ids
  from (
    select nullif(trim(raw_id), '') as trimmed_id
    from unnest(coalesce(p_class_ids, '{}'::text[])) as raw_id
  ) normalized
  where trimmed_id is not null;

  select count(*)
    into v_invalid_count
  from unnest(v_class_ids) as candidate_class_id
  left join public.classes c
    on c.id = candidate_class_id
   and c.organization_id = p_org_id
  where c.id is null;

  if coalesce(v_invalid_count, 0) > 0 then
    raise exception 'Invalid class assignment';
  end if;

  select coalesce(array_agg(cs.class_id), '{}'::text[])
    into v_removed_class_ids
  from public.class_staff cs
  where cs.organization_id = p_org_id
    and cs.user_id = p_user_id
    and cs.staff_role = 'head'
    and not (cs.class_id = any(v_class_ids));

  delete from public.class_staff cs
  where cs.organization_id = p_org_id
    and cs.user_id = p_user_id
    and cs.staff_role = 'head'
    and not (cs.class_id = any(v_class_ids));

  delete from public.class_staff cs
  where cs.organization_id = p_org_id
    and cs.staff_role = 'head'
    and cs.class_id = any(v_class_ids)
    and cs.user_id <> p_user_id;

  insert into public.class_staff (
    organization_id,
    class_id,
    user_id,
    staff_role
  )
  select
    p_org_id,
    selected_class_id,
    p_user_id,
    'head'
  from unnest(v_class_ids) as selected_class_id
  on conflict (class_id, user_id)
  do update
     set staff_role = excluded.staff_role,
         organization_id = excluded.organization_id;

  update public.classes c
  set owner_id = p_user_id
  where c.organization_id = p_org_id
    and c.id = any(v_class_ids);

  update public.classes c
  set owner_id = null
  where c.organization_id = p_org_id
    and c.id = any(v_removed_class_ids)
    and c.owner_id = p_user_id
    and not exists (
      select 1
      from public.class_staff cs
      where cs.organization_id = p_org_id
        and cs.class_id = c.id
        and cs.staff_role = 'head'
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Adjust existing RPCs for role/removal protection by class responsibility
-- ---------------------------------------------------------------------------
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
  v_has_responsible_classes boolean;
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

  if p_new_role_level < 10 then
    select exists (
      select 1
      from public.class_staff cs
      join public.classes c
        on c.id = cs.class_id
      where cs.user_id = p_user_id
        and cs.staff_role = 'head'
        and c.organization_id = p_org_id
    )
    into v_has_responsible_classes;

    if coalesce(v_has_responsible_classes, false) then
      raise exception 'Member has responsible classes';
    end if;
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
  v_has_responsible_classes boolean;
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

  select exists (
    select 1
    from public.class_staff cs
    join public.classes c
      on c.id = cs.class_id
    where cs.user_id = p_user_id
      and cs.staff_role = 'head'
      and c.organization_id = p_org_id
  )
  into v_has_responsible_classes;

  if coalesce(v_has_responsible_classes, false) then
    raise exception 'Member has responsible classes';
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

-- ---------------------------------------------------------------------------
-- 4) Permissions
-- ---------------------------------------------------------------------------
revoke all on function public.admin_list_org_classes(uuid) from anon, public;
revoke all on function public.admin_list_org_member_class_heads(uuid) from anon, public;
revoke all on function public.admin_set_member_class_heads(uuid, uuid, text[]) from anon, public;
revoke all on function public.admin_update_member_role(uuid, uuid, int) from anon, public;
revoke all on function public.admin_remove_org_member(uuid, uuid) from anon, public;

grant execute on function public.admin_list_org_classes(uuid) to authenticated;
grant execute on function public.admin_list_org_member_class_heads(uuid) to authenticated;
grant execute on function public.admin_set_member_class_heads(uuid, uuid, text[]) to authenticated;
grant execute on function public.admin_update_member_role(uuid, uuid, int) to authenticated;
grant execute on function public.admin_remove_org_member(uuid, uuid) to authenticated;
