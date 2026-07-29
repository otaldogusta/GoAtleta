create schema if not exists private;

create table if not exists private.member_access_change_receipts (
  idempotency_key uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  role_before int not null,
  role_after int not null,
  class_ids_before text[] not null default '{}'::text[],
  class_ids_after text[] not null default '{}'::text[],
  permission_keys_before text[] not null default '{}'::text[],
  permission_keys_after text[] not null default '{}'::text[],
  notification_id uuid null references public.notifications(id) on delete set null,
  changed boolean not null,
  created_at timestamptz not null default now()
);

revoke all on table private.member_access_change_receipts from public, anon, authenticated;

create or replace function public.admin_list_org_member_class_assignments(p_org_id uuid)
returns table (
  user_id uuid,
  class_id text,
  class_name text,
  unit text,
  staff_role text
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    staff.user_id,
    staff.class_id,
    class.name as class_name,
    coalesce(nullif(trim(class.unit), ''), 'Sem unidade') as unit,
    staff.staff_role
  from public.class_staff staff
  join public.classes class
    on class.id = staff.class_id
   and class.organization_id = p_org_id
  where staff.organization_id = p_org_id
  order by class.name asc, staff.user_id asc;
end;
$$;

create or replace function public.admin_apply_member_access_change(
  p_org_id uuid,
  p_user_id uuid,
  p_new_role_level int,
  p_class_ids text[],
  p_permission_keys text[],
  p_idempotency_key uuid
)
returns table (
  receipt_id uuid,
  changed boolean,
  role_level int,
  class_count int,
  permission_count int,
  notification_id uuid,
  applied_at timestamptz
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_role_before int;
  v_class_ids_before text[] := '{}'::text[];
  v_class_ids_after text[] := '{}'::text[];
  v_permission_keys_before text[] := '{}'::text[];
  v_permission_keys_after text[] := '{}'::text[];
  v_allowed_permission_keys constant text[] := array[
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
  ]::text[];
  v_invalid_class_count int := 0;
  v_invalid_permission_count int := 0;
  v_changed boolean := false;
  v_notification_id uuid;
  v_applied_at timestamptz := now();
  v_organization_name text;
  v_permission_key text;
  v_existing private.member_access_change_receipts%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_idempotency_key is null then
    raise exception 'Idempotency key is required';
  end if;

  select receipt.*
    into v_existing
  from private.member_access_change_receipts receipt
  where receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.organization_id <> p_org_id
      or v_existing.target_user_id <> p_user_id
      or v_existing.actor_user_id <> v_actor_user_id then
      raise exception 'Idempotency key already used for another operation';
    end if;

    return query
    select
      v_existing.idempotency_key,
      v_existing.changed,
      v_existing.role_after,
      cardinality(v_existing.class_ids_after),
      cardinality(v_existing.permission_keys_after),
      v_existing.notification_id,
      v_existing.created_at;
    return;
  end if;

  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  if p_new_role_level not in (5, 10, 50) then
    raise exception 'Invalid role_level';
  end if;

  select
    member.role_level,
    organization.name
  into
    v_role_before,
    v_organization_name
  from public.organization_members member
  join public.organizations organization
    on organization.id = member.organization_id
  where member.organization_id = p_org_id
    and member.user_id = p_user_id
  for update of member;

  if v_role_before is null then
    raise exception 'Member not found';
  end if;

  select coalesce(array_agg(distinct normalized.class_id order by normalized.class_id), '{}'::text[])
    into v_class_ids_after
  from (
    select nullif(trim(raw_id), '') as class_id
    from unnest(coalesce(p_class_ids, '{}'::text[])) raw_id
  ) normalized
  where normalized.class_id is not null;

  select count(*)
    into v_invalid_class_count
  from unnest(v_class_ids_after) candidate_class_id
  left join public.classes class
    on class.id = candidate_class_id
   and class.organization_id = p_org_id
  where class.id is null;

  if v_invalid_class_count > 0 then
    raise exception 'Invalid class assignment';
  end if;

  select coalesce(array_agg(distinct normalized.permission_key order by normalized.permission_key), '{}'::text[])
    into v_permission_keys_after
  from (
    select nullif(trim(raw_key), '') as permission_key
    from unnest(coalesce(p_permission_keys, '{}'::text[])) raw_key
  ) normalized
  where normalized.permission_key is not null;

  select count(*)
    into v_invalid_permission_count
  from unnest(v_permission_keys_after) candidate_permission_key
  where not (candidate_permission_key = any(v_allowed_permission_keys));

  if v_invalid_permission_count > 0 then
    raise exception 'Invalid permission_key';
  end if;

  select coalesce(array_agg(staff.class_id order by staff.class_id), '{}'::text[])
    into v_class_ids_before
  from public.class_staff staff
  join public.classes class
    on class.id = staff.class_id
   and class.organization_id = p_org_id
  where staff.organization_id = p_org_id
    and staff.user_id = p_user_id
    and staff.staff_role in ('head', 'assistant', 'intern');

  select coalesce(array_agg(permission.permission_key order by permission.permission_key), '{}'::text[])
    into v_permission_keys_before
  from (
    select key.permission_key
    from unnest(v_allowed_permission_keys) key(permission_key)
    left join public.organization_member_permissions configured
      on configured.organization_id = p_org_id
     and configured.user_id = p_user_id
     and configured.permission_key = key.permission_key
    where coalesce(
      configured.is_allowed,
      public.default_member_permission(v_role_before, key.permission_key)
    )
  ) permission;

  v_changed :=
    v_role_before <> p_new_role_level
    or v_class_ids_before <> v_class_ids_after
    or v_permission_keys_before <> v_permission_keys_after;

  if p_new_role_level < 10 then
    if v_role_before >= 10 then
      perform public.admin_set_member_class_heads(p_org_id, p_user_id, '{}'::text[]);
    end if;

    delete from public.class_staff staff
    where staff.organization_id = p_org_id
      and staff.user_id = p_user_id
      and staff.staff_role in ('assistant', 'intern');

    perform public.admin_update_member_role(p_org_id, p_user_id, p_new_role_level);

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
      'intern'
    from unnest(v_class_ids_after) selected_class_id
    on conflict (class_id, user_id)
    do update set
      organization_id = excluded.organization_id,
      staff_role = excluded.staff_role;
  else
    delete from public.class_staff staff
    where staff.organization_id = p_org_id
      and staff.user_id = p_user_id
      and staff.staff_role in ('assistant', 'intern');

    perform public.admin_update_member_role(p_org_id, p_user_id, p_new_role_level);
    perform public.admin_set_member_class_heads(p_org_id, p_user_id, v_class_ids_after);
  end if;

  for v_permission_key in
    select unnest(v_allowed_permission_keys)
  loop
    perform public.admin_set_member_permission(
      p_org_id,
      p_user_id,
      v_permission_key,
      v_permission_key = any(v_permission_keys_after)
    );
  end loop;

  if v_changed then
    insert into public.notifications (
      organization_id,
      recipient_user_id,
      actor_user_id,
      type,
      title,
      body,
      action_url,
      source_type,
      source_id,
      metadata
    )
    values (
      p_org_id,
      p_user_id,
      v_actor_user_id,
      'generic',
      'Acesso atualizado',
      format(
        'Seu acesso em %s foi atualizado: %s turma(s) e %s permissão(ões).',
        coalesce(nullif(trim(v_organization_name), ''), 'sua organização'),
        cardinality(v_class_ids_after),
        cardinality(v_permission_keys_after)
      ),
      '/prof/classes',
      'member_access_change',
      p_idempotency_key::text,
      jsonb_build_object(
        'role_level', p_new_role_level,
        'class_assignment_role', case when p_new_role_level < 10 then 'intern' else 'head' end,
        'class_count', cardinality(v_class_ids_after),
        'permission_count', cardinality(v_permission_keys_after)
      )
    )
    returning id into v_notification_id;
  end if;

  insert into private.member_access_change_receipts (
    idempotency_key,
    organization_id,
    target_user_id,
    actor_user_id,
    role_before,
    role_after,
    class_ids_before,
    class_ids_after,
    permission_keys_before,
    permission_keys_after,
    notification_id,
    changed,
    created_at
  )
  values (
    p_idempotency_key,
    p_org_id,
    p_user_id,
    v_actor_user_id,
    v_role_before,
    p_new_role_level,
    v_class_ids_before,
    v_class_ids_after,
    v_permission_keys_before,
    v_permission_keys_after,
    v_notification_id,
    v_changed,
    v_applied_at
  );

  return query
  select
    p_idempotency_key,
    v_changed,
    p_new_role_level,
    cardinality(v_class_ids_after),
    cardinality(v_permission_keys_after),
    v_notification_id,
    v_applied_at;
end;
$$;

revoke all on function public.admin_apply_member_access_change(
  uuid,
  uuid,
  int,
  text[],
  text[],
  uuid
) from public, anon;

revoke all on function public.admin_list_org_member_class_assignments(uuid)
  from public, anon;

grant execute on function public.admin_list_org_member_class_assignments(uuid)
  to authenticated;

grant execute on function public.admin_apply_member_access_change(
  uuid,
  uuid,
  int,
  text[],
  text[],
  uuid
) to authenticated;
