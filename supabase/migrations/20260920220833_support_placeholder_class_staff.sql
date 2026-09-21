create table if not exists public.organization_staff_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 120),
  linked_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_staff_profiles_org_id
  on public.organization_staff_profiles(organization_id);
create index if not exists organization_staff_profiles_linked_user_id
  on public.organization_staff_profiles(linked_user_id);

alter table public.organization_staff_profiles enable row level security;

create policy "organization_staff_profiles select org member"
  on public.organization_staff_profiles for select to authenticated
  using (public.is_org_member(organization_id));
create policy "organization_staff_profiles insert org admin"
  on public.organization_staff_profiles for insert to authenticated
  with check (public.is_org_admin(organization_id));
create policy "organization_staff_profiles update org admin"
  on public.organization_staff_profiles for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));
create policy "organization_staff_profiles delete org admin"
  on public.organization_staff_profiles for delete to authenticated
  using (public.is_org_admin(organization_id));

revoke all on table public.organization_staff_profiles from anon, public;
grant select, insert, update, delete on table public.organization_staff_profiles to authenticated;

alter table public.class_staff
  alter column user_id drop not null,
  add column if not exists staff_profile_id uuid references public.organization_staff_profiles(id) on delete cascade;

alter table public.class_staff drop constraint if exists class_staff_identity_check;
alter table public.class_staff add constraint class_staff_identity_check
  check (num_nonnulls(user_id, staff_profile_id) = 1);

create unique index if not exists class_staff_class_profile_unique
  on public.class_staff(class_id, staff_profile_id)
  where staff_profile_id is not null;

drop function if exists public.list_org_class_staff_for_classes(uuid, text[]);
create function public.list_org_class_staff_for_classes(
  p_org_id uuid,
  p_class_ids text[]
)
returns table (
  class_id text,
  user_id uuid,
  staff_profile_id uuid,
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
    staff.staff_profile_id,
    staff.staff_role,
    coalesce(
      nullif(trim(placeholder.display_name), ''),
      nullif(trim(member.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(member.raw_user_meta_data->>'name'), ''),
      nullif(trim(member.raw_user_meta_data->>'display_name'), ''),
      case staff.staff_role
        when 'head' then 'Professor responsável'
        when 'assistant' then 'Auxiliar'
        else 'Estagiário(a)'
      end
    ) as display_name,
    case when staff.user_id is not null then nullif(trim(profile.photo_url), '') else null end as photo_url
  from public.class_staff staff
  join public.classes class_group
    on class_group.id = staff.class_id and class_group.organization_id = p_org_id
  left join auth.users member on member.id = staff.user_id
  left join public.user_profiles profile on profile.user_id = staff.user_id
  left join public.organization_staff_profiles placeholder
    on placeholder.id = staff.staff_profile_id and placeholder.organization_id = p_org_id
  where staff.organization_id = p_org_id
    and staff.class_id = any(coalesce(p_class_ids, '{}'::text[]))
  order by class_group.name asc,
    case staff.staff_role when 'head' then 0 when 'assistant' then 1 else 2 end,
    5 asc;
end;
$$;

revoke all on function public.list_org_class_staff_for_classes(uuid, text[]) from public, anon, authenticated;
grant execute on function public.list_org_class_staff_for_classes(uuid, text[]) to authenticated;

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
  v_item jsonb;
  v_user_id uuid;
  v_profile_id uuid;
  v_display_name text;
  v_staff_role text;
  v_head_count integer := 0;
  v_head_user_id uuid := null;
begin
  if auth.uid() is null or not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;
  if not exists (select 1 from public.classes c where c.id = p_class_id and c.organization_id = p_org_id) then
    raise exception 'Class not found';
  end if;
  if jsonb_typeof(coalesce(p_assignments, '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid assignments';
  end if;

  delete from public.class_staff staff
  where staff.organization_id = p_org_id and staff.class_id = p_class_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) loop
    v_user_id := nullif(v_item->>'user_id', '')::uuid;
    v_profile_id := nullif(v_item->>'staff_profile_id', '')::uuid;
    v_display_name := nullif(trim(v_item->>'display_name'), '');
    v_staff_role := v_item->>'staff_role';

    if v_staff_role not in ('head', 'assistant', 'intern') then
      raise exception 'Invalid class staff role';
    end if;
    if v_staff_role = 'head' then
      v_head_count := v_head_count + 1;
    end if;
    if v_head_count > 1 then
      raise exception 'Only one head is allowed';
    end if;

    if v_user_id is not null then
      if v_profile_id is not null or not exists (
        select 1 from public.organization_members member
        where member.organization_id = p_org_id and member.user_id = v_user_id
      ) then
        raise exception 'Invalid organization member';
      end if;
    elsif v_profile_id is not null then
      if not exists (
        select 1 from public.organization_staff_profiles placeholder
        where placeholder.id = v_profile_id and placeholder.organization_id = p_org_id
      ) then
        raise exception 'Invalid staff profile';
      end if;
    elsif v_display_name is not null and length(v_display_name) between 2 and 120 then
      insert into public.organization_staff_profiles (organization_id, display_name)
      values (p_org_id, v_display_name)
      returning id into v_profile_id;
    else
      raise exception 'A staff identity is required';
    end if;

    insert into public.class_staff (organization_id, class_id, user_id, staff_profile_id, staff_role)
    values (p_org_id, p_class_id, v_user_id, v_profile_id, v_staff_role);

    if v_staff_role = 'head' then
      v_head_user_id := v_user_id;
    end if;
  end loop;

  update public.classes
  set owner_id = v_head_user_id
  where id = p_class_id and organization_id = p_org_id;
end;
$$;

revoke all on function public.admin_replace_class_staff_assignments(uuid, text, jsonb) from anon, public;
grant execute on function public.admin_replace_class_staff_assignments(uuid, text, jsonb) to authenticated;
