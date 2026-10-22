-- Explicit, institution-scoped class creation. Existing teachers and old invites
-- receive no creation grant. No rows or historical ownership are backfilled.
begin;

alter table public.organization_member_permissions
  drop constraint if exists organization_member_permissions_permission_key_check;
alter table public.organization_member_permissions
  add constraint organization_member_permissions_permission_key_check check (
    permission_key in ('reports', 'events', 'students', 'classes', 'classes_create',
      'training', 'periodization', 'calendar', 'absence_notices',
      'whatsapp_settings', 'assistant', 'org_members', 'financial')
  );

create or replace function public.default_member_permission(p_role_level int, p_permission_key text)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select case when p_permission_key in ('org_members', 'financial', 'classes_create')
    then coalesce(p_role_level, 0) >= 50 else true end;
$$;

-- Preserve the existing RPC contracts, authorization, receipts and invite claims;
-- only extend their accepted/enumerated permission keys.


create or replace function public.has_org_member_permission(
  p_org_id uuid,
  p_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.organization_members member
    left join public.organization_member_permissions configured
      on configured.organization_id = member.organization_id
     and configured.user_id = member.user_id
     and configured.permission_key = p_permission_key
    where member.organization_id = p_org_id
      and member.user_id = (select auth.uid())
      and p_permission_key in (
        'reports', 'events', 'students', 'classes', 'classes_create', 'training', 'periodization',
        'calendar', 'absence_notices', 'whatsapp_settings', 'assistant',
        'org_members', 'financial'
      )
      and (
        member.role_level >= 50
        or coalesce(
          configured.is_allowed,
          public.default_member_permission(member.role_level, p_permission_key)
        )
      )
  );
$$;

create or replace function public.admin_list_member_permissions(
  p_org_id uuid,
  p_user_id uuid
)
returns table (permission_key text, is_allowed boolean)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_role_level int;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  select member.role_level
  into v_role_level
  from public.organization_members member
  where member.organization_id = p_org_id
    and member.user_id = p_user_id;

  if v_role_level is null then
    raise exception 'Member not found';
  end if;

  return query
  with keys as (
    select unnest(array[
      'reports', 'events', 'students', 'classes', 'classes_create', 'training', 'periodization',
      'calendar', 'absence_notices', 'whatsapp_settings', 'assistant',
      'org_members', 'financial'
    ]::text[]) as permission_key
  )
  select
    keys.permission_key,
    coalesce(
      configured.is_allowed,
      public.default_member_permission(v_role_level, keys.permission_key)
    )
  from keys
  left join public.organization_member_permissions configured
    on configured.organization_id = p_org_id
   and configured.user_id = p_user_id
   and configured.permission_key = keys.permission_key
  order by keys.permission_key;
end;
$$;

create or replace function public.get_my_member_permissions(p_org_id uuid)
returns table (permission_key text, is_allowed boolean)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_role_level int;
begin
  select member.role_level
  into v_role_level
  from public.organization_members member
  where member.organization_id = p_org_id
    and member.user_id = auth.uid();

  if v_role_level is null then
    raise exception 'Member not found';
  end if;

  return query
  with keys as (
    select unnest(array[
      'reports', 'events', 'students', 'classes', 'classes_create', 'training', 'periodization',
      'calendar', 'absence_notices', 'whatsapp_settings', 'assistant',
      'org_members', 'financial'
    ]::text[]) as permission_key
  )
  select
    keys.permission_key,
    coalesce(
      configured.is_allowed,
      public.default_member_permission(v_role_level, keys.permission_key)
    )
  from keys
  left join public.organization_member_permissions configured
    on configured.organization_id = p_org_id
   and configured.user_id = auth.uid()
   and configured.permission_key = keys.permission_key
  order by keys.permission_key;
end;
$$;

create or replace function public.admin_set_member_permission(
  p_org_id uuid,
  p_user_id uuid,
  p_permission_key text,
  p_is_allowed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_role_level int;
  v_default boolean;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  if p_permission_key not in (
    'reports', 'events', 'students', 'classes', 'classes_create', 'training', 'periodization',
    'calendar', 'absence_notices', 'whatsapp_settings', 'assistant',
    'org_members', 'financial'
  ) then
    raise exception 'Invalid permission_key';
  end if;

  select member.role_level
  into v_role_level
  from public.organization_members member
  where member.organization_id = p_org_id
    and member.user_id = p_user_id;

  if v_role_level is null then
    raise exception 'Member not found';
  end if;

  if p_permission_key = 'org_members'
    and p_user_id = auth.uid()
    and p_is_allowed = false then
    raise exception 'Cannot disable own org_members permission';
  end if;

  if p_permission_key = 'financial' and v_role_level >= 50 then
    p_is_allowed := true;
  end if;

  v_default := public.default_member_permission(v_role_level, p_permission_key);

  if p_is_allowed = v_default then
    delete from public.organization_member_permissions configured
    where configured.organization_id = p_org_id
      and configured.user_id = p_user_id
      and configured.permission_key = p_permission_key;
    return;
  end if;

  insert into public.organization_member_permissions (
    organization_id,
    user_id,
    permission_key,
    is_allowed,
    updated_at,
    updated_by
  )
  values (p_org_id, p_user_id, p_permission_key, p_is_allowed, now(), auth.uid())
  on conflict (organization_id, user_id, permission_key)
  do update set
    is_allowed = excluded.is_allowed,
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;

create or replace function public.admin_apply_member_access_change_v2(
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
  v_existing private.member_access_change_receipts%rowtype;
  v_requested_class_ids text[] := '{}'::text[];
  v_requested_permission_keys text[] := '{}'::text[];
  v_allowed_permission_keys constant text[] := array[
    'reports', 'events', 'students', 'classes', 'classes_create', 'training', 'periodization',
    'calendar', 'absence_notices', 'whatsapp_settings', 'assistant',
    'org_members', 'financial'
  ]::text[];
  v_financial_before boolean;
  v_financial_after boolean;
  v_financial_changed boolean;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_idempotency_key is null then
    raise exception 'Idempotency key is required';
  end if;

  if p_new_role_level is null or p_new_role_level not in (5, 10, 50) then
    raise exception 'Invalid role_level';
  end if;

  select coalesce(
    array_agg(normalized.class_id order by normalized.class_id),
    '{}'::text[]
  )
  into v_requested_class_ids
  from (
    select distinct nullif(trim(raw_id), '') as class_id
    from unnest(coalesce(p_class_ids, '{}'::text[])) raw_id
  ) normalized
  where normalized.class_id is not null;

  select coalesce(
    array_agg(normalized.permission_key order by normalized.permission_key),
    '{}'::text[]
  )
  into v_requested_permission_keys
  from (
    select distinct nullif(trim(raw_key), '') as permission_key
    from unnest(coalesce(p_permission_keys, '{}'::text[])) raw_key
  ) normalized
  where normalized.permission_key is not null;

  if exists (
    select 1
    from unnest(v_requested_permission_keys) requested(permission_key)
    where not (requested.permission_key = any(v_allowed_permission_keys))
  ) then
    raise exception 'Invalid permission_key';
  end if;

  -- Financial access is mandatory for admins. Store the effective full payload
  -- in the receipt so an idempotency key cannot be replayed with different
  -- access settings while still appearing successful.
  if p_new_role_level >= 50
    and not ('financial' = any(v_requested_permission_keys)) then
    select array_agg(permission_key order by permission_key)
    into v_requested_permission_keys
    from unnest(array_append(v_requested_permission_keys, 'financial'))
      permission(permission_key);
  end if;

  -- Serialize retries using the same receipt key before checking whether the
  -- prior call already committed.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'admin_apply_member_access_change_v2:' || p_idempotency_key::text,
      0
    )
  );

  select receipt.*
  into v_existing
  from private.member_access_change_receipts receipt
  where receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.organization_id is distinct from p_org_id
      or v_existing.target_user_id is distinct from p_user_id
      or v_existing.actor_user_id is distinct from v_actor_user_id
      or v_existing.role_after is distinct from p_new_role_level
      or v_existing.class_ids_after is distinct from v_requested_class_ids
      or v_existing.permission_keys_after is distinct from v_requested_permission_keys then
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

  select
    member.role_level >= 50
    or coalesce(
      configured.is_allowed,
      public.default_member_permission(member.role_level, 'financial')
    )
  into v_financial_before
  from public.organization_members member
  left join public.organization_member_permissions configured
    on configured.organization_id = member.organization_id
   and configured.user_id = member.user_id
   and configured.permission_key = 'financial'
  where member.organization_id = p_org_id
    and member.user_id = p_user_id
  for update of member;

  if v_financial_before is null then
    raise exception 'Member not found';
  end if;

  v_financial_after :=
    p_new_role_level >= 50
    or 'financial' = any(v_requested_permission_keys);

  perform 1
  from public.admin_apply_member_access_change(
    p_org_id,
    p_user_id,
    p_new_role_level,
    v_requested_class_ids,
    array_remove(v_requested_permission_keys, 'financial'),
    p_idempotency_key
  );

  perform public.admin_set_member_permission(
    p_org_id,
    p_user_id,
    'financial',
    v_financial_after
  );

  v_financial_changed := v_financial_before is distinct from v_financial_after;

  update private.member_access_change_receipts receipt
  set
    permission_keys_before = case
      when v_financial_before then array_append(receipt.permission_keys_before, 'financial')
      else receipt.permission_keys_before
    end,
    permission_keys_after = case
      when v_financial_after then v_requested_permission_keys
      else array_remove(receipt.permission_keys_after, 'financial')
    end,
    changed = receipt.changed or v_financial_changed
  where receipt.idempotency_key = p_idempotency_key
  returning receipt.* into v_existing;

  if v_existing.notification_id is not null then
    update public.notifications notification
    set
      body = format(
        'Seu acesso foi atualizado: %s turma(s) e %s permissão(ões).',
        cardinality(v_existing.class_ids_after),
        cardinality(v_existing.permission_keys_after)
      ),
      metadata = coalesce(notification.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'permission_count', cardinality(v_existing.permission_keys_after)
        )
    where notification.id = v_existing.notification_id;
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
    'classes', 'classes_create',
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

-- The hosted claim function also calls apply_trainer_invite_staff, an extension
-- absent from this checkout's historical definition. Extend its single key list
-- in place instead of overwriting that hook or any other current claim logic.
do $extend_claim_permissions$
declare
  definition text := pg_get_functiondef('public.claim_trainer_invite_access(uuid,uuid)'::regprocedure);
begin
  if position('''classes_create''' in definition) = 0 then
    if (length(definition) - length(replace(definition, '''classes'',', ''))) / length('''classes'',') <> 1 then
      raise exception 'Unexpected trainer invite claim permission list; review before migrating';
    end if;
    execute replace(definition, '''classes'',', '''classes'', ''classes_create'',');
  end if;
end;
$extend_claim_permissions$;

create or replace function public.create_trainer_invite_access(
  p_org_id uuid,
  p_code_hash text,
  p_target_role_level int,
  p_invited_via text,
  p_invited_to text default null,
  p_initial_permissions jsonb default '[]'::jsonb
)
returns table (
  invite_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor_role_level int;
  v_invited_via text := lower(trim(coalesce(p_invited_via, '')));
  v_invited_to text := nullif(trim(coalesce(p_invited_to, '')), '');
  v_permissions jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVITE_INVALID';
  end if;

  if p_target_role_level is null
    or p_target_role_level not in (5, 10, 50) then
    raise exception 'INVITE_ROLE_INVALID';
  end if;

  if v_invited_via not in ('whatsapp', 'email', 'link') then
    raise exception 'INVITE_CHANNEL_INVALID';
  end if;

  if char_length(coalesce(v_invited_to, '')) > 255 then
    raise exception 'INVITE_DESTINATION_INVALID';
  end if;

  if v_invited_via = 'email' then
    v_invited_to := nullif(lower(v_invited_to), '');
    if v_invited_to is null
      or v_invited_to !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'INVITE_EMAIL_REQUIRED';
    end if;
  end if;

  if p_initial_permissions is null then
    p_initial_permissions := '[]'::jsonb;
  elsif jsonb_typeof(p_initial_permissions) <> 'array' then
    raise exception 'INVITE_PERMISSIONS_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_initial_permissions) permission(permission_key)
    where permission.permission_key is null
      or permission.permission_key not in (
        'reports', 'events', 'students', 'classes', 'classes_create', 'training', 'periodization',
        'calendar', 'absence_notices', 'whatsapp_settings', 'assistant',
        'financial'
      )
  ) then
    raise exception 'INVITE_PERMISSIONS_INVALID';
  end if;

  select coalesce(jsonb_agg(permission.permission_key order by permission.permission_key), '[]'::jsonb)
    into v_permissions
  from (
    select distinct permission.permission_key
    from jsonb_array_elements_text(p_initial_permissions) permission(permission_key)
  ) permission;

  select member.role_level
    into v_actor_role_level
  from public.organization_members member
  where member.organization_id = p_org_id
    and member.user_id = auth.uid()
  for update;

  if v_actor_role_level is null or v_actor_role_level < 50 then
    raise exception 'NOT_AUTHORIZED';
  end if;

  return query
  insert into public.trainer_invites (
    code_hash,
    created_by,
    expires_at,
    max_uses,
    uses,
    revoked,
    organization_id,
    target_role_level,
    invited_via,
    invited_to,
    initial_permissions,
    delivery_status
  )
  values (
    p_code_hash,
    auth.uid(),
    now() + interval '14 days',
    1,
    0,
    false,
    p_org_id,
    p_target_role_level,
    v_invited_via,
    v_invited_to,
    v_permissions,
    case when v_invited_via = 'email' then 'pending_delivery' else 'not_applicable' end
  )
  returning
    trainer_invites.id,
    trainer_invites.expires_at;
end;
$$;


create or replace function public.can_create_class(p_org_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select auth.uid() is not null
    and public.has_org_member_permission(p_org_id, 'classes')
    and public.has_org_member_permission(p_org_id, 'classes_create');
$$;
revoke all on function public.can_create_class(uuid) from public, anon;
grant execute on function public.can_create_class(uuid) to authenticated;

-- Permissive policies are ORed. A restrictive policy also constrains the hosted
-- tenant/user policy found during diagnosis, even when it remains installed.
drop policy if exists "classes insert trainer" on public.classes;
create policy "classes insert trainer" on public.classes for insert to authenticated
  with check (public.can_create_class(organization_id)
    and (public.is_org_admin(organization_id) or owner_id = (select auth.uid())));
drop policy if exists "classes creation permission required" on public.classes;
create policy "classes creation permission required" on public.classes
  as restrictive for insert to authenticated
  with check (public.can_create_class(organization_id)
    and (public.is_org_admin(organization_id) or owner_id = (select auth.uid())));

-- This trigger can only initialize the actor's own team on a newly inserted row.
-- It does not expose the administrative staff-assignment RPC to professors.
create or replace function private.initialize_created_class_staff()
returns trigger language plpgsql security definer set search_path = '' set row_security = off
as $$
declare actor uuid := auth.uid();
begin
  if actor is null or public.is_org_admin(new.organization_id) then return new; end if;
  if not public.can_create_class(new.organization_id) or new.owner_id is distinct from actor then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into public.class_staff(organization_id, class_id, user_id, staff_role)
  values (new.organization_id, new.id, actor, 'head');
  insert into public.class_staff_tenures(organization_id, class_id, user_id,
    display_name_snapshot, staff_role, status, starts_on, date_precision, created_by)
  select new.organization_id, new.id, actor,
    coalesce(nullif(trim(account.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(account.raw_user_meta_data->>'name'), ''), 'Professor'),
    'head', 'active', current_date, 'exact', actor
  from auth.users account where account.id = actor;
  insert into public.class_staff_versions(organization_id, class_id, version)
  values (new.organization_id, new.id, 1);
  return new;
end;
$$;
revoke all on function private.initialize_created_class_staff() from public, anon, authenticated;
drop trigger if exists initialize_created_class_staff on public.classes;
create trigger initialize_created_class_staff after insert on public.classes
  for each row execute function private.initialize_created_class_staff();

-- Ownership must not let a creator move a class into another institution or
-- reassign its owner through the older hosted UPDATE policy.
create or replace function private.protect_class_creation_scope()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if auth.uid() is not null and (
    new.organization_id is distinct from old.organization_id
    or new.owner_id is distinct from old.owner_id
  ) and not (public.is_org_admin(old.organization_id) and public.is_org_admin(new.organization_id)) then
    raise exception 'Class scope and owner require coordination' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_class_creation_scope() from public, anon, authenticated;
drop trigger if exists protect_class_creation_scope on public.classes;
create trigger protect_class_creation_scope before update of organization_id, owner_id on public.classes
  for each row execute function private.protect_class_creation_scope();

revoke all on function public.has_org_member_permission(uuid, text),
  public.admin_list_member_permissions(uuid, uuid), public.get_my_member_permissions(uuid),
  public.admin_set_member_permission(uuid, uuid, text, boolean),
  public.admin_apply_member_access_change(uuid, uuid, int, text[], text[], uuid),
  public.admin_apply_member_access_change_v2(uuid, uuid, int, text[], text[], uuid),
  public.create_trainer_invite_access(uuid, text, int, text, text, jsonb) from public, anon;
grant execute on function public.has_org_member_permission(uuid, text),
  public.admin_list_member_permissions(uuid, uuid), public.get_my_member_permissions(uuid),
  public.admin_set_member_permission(uuid, uuid, text, boolean),
  public.admin_apply_member_access_change(uuid, uuid, int, text[], text[], uuid),
  public.admin_apply_member_access_change_v2(uuid, uuid, int, text[], text[], uuid),
  public.create_trainer_invite_access(uuid, text, int, text, text, jsonb) to authenticated;
revoke all on function public.claim_trainer_invite_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_trainer_invite_access(uuid, uuid) to service_role;

commit;
