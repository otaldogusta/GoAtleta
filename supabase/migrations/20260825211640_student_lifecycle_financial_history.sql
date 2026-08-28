-- Preserve athlete lifecycle and financial transitions without rewriting existing data.

alter table public.students
  alter column financial_status set default 'unknown';

alter table public.students
  drop constraint if exists students_financial_status_check;

alter table public.students
  add constraint students_financial_status_check
  check (financial_status in ('regular', 'delinquent', 'exempt', 'pending', 'unknown'));

-- Operational removal is an inactivation with history. Physical deletion is
-- reserved for the service-role LGPD workflow, outside authenticated clients.
drop policy if exists "students delete trainer" on public.students;
revoke delete on table public.students from authenticated;
grant delete on table public.students to service_role;

-- Workspace/class identity is enforced for every new write without rewriting
-- legacy rows. The operational trigger below requires reasons for new
-- inactivations while leaving old incomplete audit data recoverable.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.students'::regclass
      and conname = 'students_class_workspace_fkey'
  ) then
    alter table public.students
      add constraint students_class_workspace_fkey
      foreign key (classid, organization_id)
      references public.classes (id, organization_id)
      not valid;
  end if;
end
$$;

create table public.student_membership_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  previous_status text check (previous_status is null or previous_status in ('active', 'inactive')),
  status text not null check (status in ('active', 'inactive')),
  reason text check (reason is null or char_length(reason) <= 240),
  source text not null default 'status_change'
    check (source in ('baseline', 'created', 'status_change', 'reason_change')),
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);

create table public.student_financial_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  previous_status text check (
    previous_status is null
    or previous_status in ('regular', 'delinquent', 'exempt', 'pending', 'unknown')
  ),
  status text not null
    check (status in ('regular', 'delinquent', 'exempt', 'pending', 'unknown')),
  source text not null default 'status_change'
    check (source in ('baseline', 'created', 'status_change')),
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);

create index student_membership_events_org_student_changed_idx
  on public.student_membership_events (organization_id, student_id, changed_at desc);

create index student_membership_events_student_idx
  on public.student_membership_events (student_id);

create index student_membership_events_changed_by_idx
  on public.student_membership_events (changed_by);

create index student_financial_events_org_student_changed_idx
  on public.student_financial_events (organization_id, student_id, changed_at desc);

create index student_financial_events_student_idx
  on public.student_financial_events (student_id);

create index student_financial_events_changed_by_idx
  on public.student_financial_events (changed_by);

alter table public.student_membership_events enable row level security;
alter table public.student_financial_events enable row level security;

revoke all on table public.student_membership_events from anon, authenticated;
revoke all on table public.student_financial_events from anon, authenticated;
grant select on table public.student_membership_events to authenticated;
grant select on table public.student_financial_events to authenticated;

-- Financial access is independent from athlete/class access and defaults to admins only.
alter table public.organization_member_permissions
  drop constraint if exists organization_member_permissions_permission_key_check;

alter table public.organization_member_permissions
  add constraint organization_member_permissions_permission_key_check
  check (
    permission_key in (
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
      'org_members',
      'financial'
    )
  );

create or replace function public.default_member_permission(
  p_role_level int,
  p_permission_key text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_permission_key in ('org_members', 'financial')
      then coalesce(p_role_level, 0) >= 50
    else true
  end;
$$;

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
        'reports', 'events', 'students', 'classes', 'training', 'periodization',
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

revoke all on function public.has_org_member_permission(uuid, text) from public, anon;
grant execute on function public.has_org_member_permission(uuid, text) to authenticated;

create policy "student membership events select permitted"
  on public.student_membership_events
  for select
  to authenticated
  using (public.has_org_member_permission(organization_id, 'students'));

create policy "student financial events select permitted"
  on public.student_financial_events
  for select
  to authenticated
  using (public.has_org_member_permission(organization_id, 'financial'));

insert into public.student_membership_events (
  organization_id,
  student_id,
  previous_status,
  status,
  reason,
  source,
  changed_at,
  changed_by
)
select
  student.organization_id,
  student.id,
  null,
  student.membership_status,
  student.inactivation_reason,
  'baseline',
  coalesce(
    student.inactivated_at,
    nullif(btrim(student.createdat::text), '')::timestamptz,
    now()
  ),
  student.inactivated_by
from public.students student
where student.organization_id is not null;

insert into public.student_financial_events (
  organization_id,
  student_id,
  previous_status,
  status,
  source,
  changed_at,
  changed_by
)
select
  student.organization_id,
  student.id,
  null,
  student.financial_status,
  'baseline',
  coalesce(nullif(btrim(student.createdat::text), '')::timestamptz, now()),
  null
from public.students student
where student.organization_id is not null;

create or replace function public.guard_student_operational_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_is_trusted_writer boolean :=
    current_user in ('postgres', 'service_role', 'supabase_admin');
begin
  if new.membership_status = 'inactive' then
    if nullif(trim(new.inactivation_reason), '') is null then
      if tg_op = 'INSERT' then
        raise exception using
          errcode = '23514',
          message = 'Inactivation reason is required';
      elsif old.membership_status is distinct from 'inactive'
        or old.inactivation_reason is distinct from new.inactivation_reason then
        raise exception using
          errcode = '23514',
          message = 'Inactivation reason is required';
      end if;
    end if;

    if tg_op = 'INSERT' or old.membership_status is distinct from 'inactive' then
      if v_is_trusted_writer then
        new.inactivated_at := coalesce(new.inactivated_at, now());
        new.inactivated_by := coalesce(new.inactivated_by, auth.uid());
      else
        -- Audit identity and time are server-owned for authenticated writes;
        -- discard any values supplied by the client on an inactivation.
        new.inactivated_at := now();
        new.inactivated_by := auth.uid();
      end if;
    elsif not v_is_trusted_writer then
      -- An inactive athlete may have the reason corrected, but the original
      -- inactivation actor/time cannot be rewritten by the client.
      new.inactivated_at := old.inactivated_at;
      new.inactivated_by := old.inactivated_by;
    end if;
  else
    new.inactivated_at := null;
    new.inactivated_by := null;
    new.inactivation_reason := null;
  end if;

  if (
    tg_op = 'INSERT'
    and new.financial_status <> 'unknown'
  ) or (
    tg_op = 'UPDATE'
    and old.financial_status is distinct from new.financial_status
  ) then
    if current_user not in ('postgres', 'service_role', 'supabase_admin')
      and not public.has_org_member_permission(new.organization_id, 'financial') then
      raise exception using
        errcode = '42501',
        message = 'Financial permission is required';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_student_operational_status_before_write
before insert or update of
  membership_status,
  financial_status,
  inactivation_reason,
  inactivated_at,
  inactivated_by
on public.students
for each row
execute function public.guard_student_operational_status();

create or replace function public.record_student_operational_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if tg_op = 'INSERT'
    or old.membership_status is distinct from new.membership_status
    or (
      new.membership_status = 'inactive'
      and old.inactivation_reason is distinct from new.inactivation_reason
    ) then
    insert into public.student_membership_events (
      organization_id,
      student_id,
      previous_status,
      status,
      reason,
      source,
      changed_at,
      changed_by
    )
    values (
      new.organization_id,
      new.id,
      case when tg_op = 'INSERT' then null else old.membership_status end,
      new.membership_status,
      case when new.membership_status = 'inactive' then new.inactivation_reason else null end,
      case
        when tg_op = 'INSERT' then 'created'
        when old.membership_status is not distinct from new.membership_status
          then 'reason_change'
        else 'status_change'
      end,
      case
        when tg_op = 'UPDATE'
          and old.membership_status is not distinct from new.membership_status
          then now()
        when new.membership_status = 'inactive' then coalesce(new.inactivated_at, now())
        else now()
      end,
      case
        when tg_op = 'UPDATE'
          and old.membership_status is not distinct from new.membership_status
          then auth.uid()
        else coalesce(auth.uid(), new.inactivated_by)
      end
    );
  end if;

  if tg_op = 'INSERT' or old.financial_status is distinct from new.financial_status then
    insert into public.student_financial_events (
      organization_id,
      student_id,
      previous_status,
      status,
      source,
      changed_at,
      changed_by
    )
    values (
      new.organization_id,
      new.id,
      case when tg_op = 'INSERT' then null else old.financial_status end,
      new.financial_status,
      case when tg_op = 'INSERT' then 'created' else 'status_change' end,
      now(),
      auth.uid()
    );
  end if;

  return new;
end;
$$;

revoke all on function public.guard_student_operational_status() from public, anon, authenticated;
revoke all on function public.record_student_operational_status_event() from public, anon, authenticated;

create trigger record_student_operational_status_event_after_write
after insert or update of membership_status, financial_status, inactivation_reason
on public.students
for each row
execute function public.record_student_operational_status_event();

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
      'reports', 'events', 'students', 'classes', 'training', 'periodization',
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
      'reports', 'events', 'students', 'classes', 'training', 'periodization',
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
    'reports', 'events', 'students', 'classes', 'training', 'periodization',
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

revoke all on function public.admin_list_member_permissions(uuid, uuid) from public, anon;
revoke all on function public.get_my_member_permissions(uuid) from public, anon;
revoke all on function public.admin_set_member_permission(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.admin_list_member_permissions(uuid, uuid) to authenticated;
grant execute on function public.get_my_member_permissions(uuid) to authenticated;
grant execute on function public.admin_set_member_permission(uuid, uuid, text, boolean) to authenticated;

-- Wrap the existing atomic access mutation so financial permission participates in
-- the same transaction while old clients remain compatible.
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
    'reports', 'events', 'students', 'classes', 'training', 'periodization',
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

revoke all on function public.admin_apply_member_access_change_v2(
  uuid, uuid, int, text[], text[], uuid
) from public, anon;
grant execute on function public.admin_apply_member_access_change_v2(
  uuid, uuid, int, text[], text[], uuid
) to authenticated;

-- Refuse to hide duplicate enrollments. Deployment stops for manual reconciliation
-- instead of deleting or merging history implicitly.
do $$
begin
  if exists (
    select 1
    from public.student_class_enrollments
    group by organization_id, student_id, class_id
    having count(*) > 1
  ) then
    raise exception
      'Duplicate student class enrollments must be reconciled before migration';
  end if;
end
$$;

create unique index if not exists student_class_enrollments_org_student_class_uidx
  on public.student_class_enrollments (organization_id, student_id, class_id);

create or replace function public.move_students_to_class(
  p_org_id uuid,
  p_student_ids text[],
  p_from_class_id text,
  p_to_class_id text
)
returns table (moved_count int)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_student_ids text[] := '{}'::text[];
  v_invalid_student_count int;
  v_target_modality text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_from_class_id is null or p_to_class_id is null or p_from_class_id = p_to_class_id then
    raise exception 'Distinct source and target classes are required';
  end if;

  if not public.has_org_member_permission(p_org_id, 'students') then
    raise exception 'Not authorized';
  end if;

  if not (
    public.is_org_admin(p_org_id)
    or (
      public.is_class_staff(p_from_class_id)
      and public.is_class_staff(p_to_class_id)
    )
  ) then
    raise exception 'Not authorized';
  end if;

  select target.modality
  into v_target_modality
  from public.classes target
  where target.id = p_to_class_id
    and target.organization_id = p_org_id;

  if not found or not exists (
    select 1
    from public.classes source
    where source.id = p_from_class_id
      and source.organization_id = p_org_id
  ) then
    raise exception 'Class not found in organization';
  end if;

  select coalesce(array_agg(distinct normalized.student_id order by normalized.student_id), '{}'::text[])
  into v_student_ids
  from (
    select nullif(trim(raw_id), '') as student_id
    from unnest(coalesce(p_student_ids, '{}'::text[])) raw_id
  ) normalized
  where normalized.student_id is not null;

  if cardinality(v_student_ids) = 0 then
    return query select 0;
    return;
  end if;

  perform 1
  from public.students student
  where student.organization_id = p_org_id
    and student.id = any(v_student_ids)
  for update;

  select count(*)
  into v_invalid_student_count
  from unnest(v_student_ids) requested(student_id)
  left join public.students student
    on student.id = requested.student_id
   and student.organization_id = p_org_id
  where student.id is null
    or not (
      student.classid = p_from_class_id
      or exists (
        select 1
        from public.student_class_enrollments enrollment
        where enrollment.organization_id = p_org_id
          and enrollment.student_id = requested.student_id
          and enrollment.class_id = p_from_class_id
          and enrollment.status = 'active'
      )
    );

  if v_invalid_student_count > 0 then
    raise exception 'Student is not actively linked to source class';
  end if;

  insert into public.student_class_enrollments (
    id,
    organization_id,
    student_id,
    class_id,
    modality,
    status,
    created_at,
    updated_at
  )
  select
    'sce_' || replace(gen_random_uuid()::text, '-', ''),
    p_org_id,
    student_id,
    p_to_class_id,
    v_target_modality,
    'active',
    now(),
    now()
  from unnest(v_student_ids) student_id
  on conflict (organization_id, student_id, class_id)
  do update set
    modality = excluded.modality,
    status = 'active',
    updated_at = now();

  update public.student_class_enrollments enrollment
  set status = 'inactive', updated_at = now()
  where enrollment.organization_id = p_org_id
    and enrollment.student_id = any(v_student_ids)
    and enrollment.class_id = p_from_class_id
    and enrollment.status <> 'inactive';

  update public.students student
  set classid = p_to_class_id
  where student.organization_id = p_org_id
    and student.id = any(v_student_ids)
    and student.classid = p_from_class_id;

  return query select cardinality(v_student_ids);
end;
$$;

revoke all on function public.move_students_to_class(uuid, text[], text, text)
  from public, anon;
grant execute on function public.move_students_to_class(uuid, text[], text, text)
  to authenticated;
