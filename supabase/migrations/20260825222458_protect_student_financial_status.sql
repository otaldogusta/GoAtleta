-- Keep the public students record compatible while moving the real financial
-- state behind its own RLS boundary. Row policies cannot hide one column from
-- a subset of authenticated users, so students.financial_status becomes a
-- non-sensitive compatibility facade containing only `unknown`.

do $$
begin
  if exists (
    select 1
    from public.students student
    where student.organization_id is null
  ) then
    raise exception
      'Students without organization_id must be reconciled before financial isolation';
  end if;
end
$$;

create table public.student_financial_statuses (
  student_id text primary key references public.students(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'unknown'
    check (status in ('regular', 'delinquent', 'exempt', 'pending', 'unknown')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

comment on table public.student_financial_statuses is
  'Protected 1:1 financial state for an athlete. Never join into general athlete reads.';

comment on column public.students.financial_status is
  'Compatibility facade only. Always unknown; real state is protected in student_financial_statuses.';

create index student_financial_statuses_org_student_idx
  on public.student_financial_statuses (organization_id, student_id);

create index student_financial_statuses_updated_by_idx
  on public.student_financial_statuses (updated_by)
  where updated_by is not null;

alter table public.student_financial_statuses enable row level security;

revoke all on table public.student_financial_statuses from public, anon, authenticated;
grant select on table public.student_financial_statuses to authenticated;
grant all on table public.student_financial_statuses to service_role;

create policy "student financial statuses select permitted"
  on public.student_financial_statuses
  for select
  to authenticated
  using (public.has_org_member_permission(organization_id, 'financial'));

-- Capture the current source of truth before sanitizing the compatibility
-- column. The event migration immediately before this one already recorded the
-- same values as baseline history, so this backfill deliberately runs before
-- the protected-table event trigger exists.
insert into public.student_financial_statuses (
  student_id,
  organization_id,
  status,
  updated_at,
  updated_by
)
select
  student.id,
  student.organization_id,
  student.financial_status,
  coalesce(nullif(btrim(student.createdat::text), '')::timestamptz, now()),
  null
from public.students student;

-- Replace the combined lifecycle/financial triggers from the preceding
-- migration. Membership history remains on students; financial history follows
-- the protected table only.
drop trigger if exists guard_student_operational_status_before_write
  on public.students;
drop trigger if exists record_student_operational_status_event_after_write
  on public.students;

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
        new.inactivated_at := now();
        new.inactivated_by := auth.uid();
      end if;
    elsif not v_is_trusted_writer then
      new.inactivated_at := old.inactivated_at;
      new.inactivated_by := old.inactivated_by;
    end if;
  else
    new.inactivated_at := null;
    new.inactivated_by := null;
    new.inactivation_reason := null;
  end if;

  return new;
end;
$$;

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

  return new;
end;
$$;

revoke all on function public.guard_student_operational_status()
  from public, anon, authenticated;
revoke all on function public.record_student_operational_status_event()
  from public, anon, authenticated;

create trigger guard_student_operational_status_before_write
before insert or update of
  membership_status,
  inactivation_reason,
  inactivated_at,
  inactivated_by
on public.students
for each row
execute function public.guard_student_operational_status();

create trigger record_student_operational_status_event_after_write
after insert or update of membership_status, inactivation_reason
on public.students
for each row
execute function public.record_student_operational_status_event();

-- Erase the sensitive value from the general athlete table only after the
-- protected copy exists and the old financial event trigger is detached.
update public.students
set financial_status = 'unknown'
where financial_status is distinct from 'unknown';

alter table public.students
  alter column financial_status set default 'unknown';

alter table public.students
  drop constraint if exists students_financial_status_check;

alter table public.students
  add constraint students_financial_status_check
  check (financial_status = 'unknown');

drop index if exists public.students_org_financial_status_idx;

create or replace function public.sanitize_legacy_student_financial_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Old app versions may still send this column on generic athlete writes.
  -- Keep those writes operational without accepting financial mutations.
  new.financial_status := 'unknown';
  return new;
end;
$$;

revoke all on function public.sanitize_legacy_student_financial_status()
  from public, anon, authenticated;

create trigger sanitize_legacy_student_financial_status_before_write
before insert or update of financial_status
on public.students
for each row
execute function public.sanitize_legacy_student_financial_status();

create or replace function public.guard_student_financial_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student_org_id uuid;
begin
  select student.organization_id
  into v_student_org_id
  from public.students student
  where student.id = new.student_id;

  if not found or v_student_org_id is null then
    raise exception using
      errcode = '23503',
      message = 'Student not found in an organization';
  end if;

  if new.organization_id is distinct from v_student_org_id then
    raise exception using
      errcode = '23514',
      message = 'Financial status organization must match student organization';
  end if;

  if tg_op = 'UPDATE'
    and (
      new.student_id is distinct from old.student_id
      or new.organization_id is distinct from old.organization_id
    ) then
    raise exception using
      errcode = '23514',
      message = 'Financial status identity is immutable';
  end if;

  return new;
end;
$$;

create or replace function public.record_student_financial_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
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
      new.student_id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      case when tg_op = 'INSERT' then 'created' else 'status_change' end,
      new.updated_at,
      new.updated_by
    );
  end if;

  return new;
end;
$$;

revoke all on function public.guard_student_financial_scope()
  from public, anon, authenticated;
revoke all on function public.record_student_financial_status_event()
  from public, anon, authenticated;

create trigger guard_student_financial_scope_before_write
before insert or update of student_id, organization_id
on public.student_financial_statuses
for each row
execute function public.guard_student_financial_scope();

create trigger record_student_financial_status_event_after_write
after insert or update of status
on public.student_financial_statuses
for each row
execute function public.record_student_financial_status_event();

create or replace function public.initialize_student_financial_status()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if new.organization_id is not null then
    insert into public.student_financial_statuses (
      student_id,
      organization_id,
      status,
      updated_at,
      updated_by
    )
    values (
      new.id,
      new.organization_id,
      'unknown',
      now(),
      auth.uid()
    )
    on conflict (student_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.initialize_student_financial_status()
  from public, anon, authenticated;

create trigger initialize_student_financial_status_after_insert
after insert on public.students
for each row
execute function public.initialize_student_financial_status();

create or replace function public.set_student_financial_status(
  p_org_id uuid,
  p_student_id text,
  p_status text
)
returns table (
  student_id text,
  organization_id uuid,
  status text,
  updated_at timestamptz,
  updated_by uuid
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_student_org_id uuid;
  v_result public.student_financial_statuses%rowtype;
begin
  if v_actor_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  if p_org_id is null or nullif(trim(p_student_id), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Organization and student are required';
  end if;

  if p_status is null or p_status not in (
    'regular', 'delinquent', 'exempt', 'pending', 'unknown'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid financial status';
  end if;

  -- Keep authorization stable until the sensitive write commits. Membership
  -- role changes conflict with the first lock; explicit financial-permission
  -- revocations conflict with the second one.
  perform 1
  from public.organization_members member
  where member.organization_id = p_org_id
    and member.user_id = v_actor_user_id
  for share;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Financial permission is required';
  end if;

  perform 1
  from public.organization_member_permissions permission
  where permission.organization_id = p_org_id
    and permission.user_id = v_actor_user_id
    and permission.permission_key = 'financial'
  for share;

  if not public.has_org_member_permission(p_org_id, 'financial') then
    raise exception using
      errcode = '42501',
      message = 'Financial permission is required';
  end if;

  select student.organization_id
  into v_student_org_id
  from public.students student
  where student.id = p_student_id
  for update;

  if not found or v_student_org_id is distinct from p_org_id then
    raise exception using
      errcode = 'P0002',
      message = 'Student not found in organization';
  end if;

  insert into public.student_financial_statuses (
    student_id,
    organization_id,
    status,
    updated_at,
    updated_by
  )
  values (
    p_student_id,
    p_org_id,
    p_status,
    now(),
    v_actor_user_id
  )
  on conflict on constraint student_financial_statuses_pkey do update
  set
    status = excluded.status,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
  where public.student_financial_statuses.organization_id = excluded.organization_id
  returning public.student_financial_statuses.* into v_result;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'Financial status organization mismatch';
  end if;

  return query
  select
    v_result.student_id,
    v_result.organization_id,
    v_result.status,
    v_result.updated_at,
    v_result.updated_by;
end;
$$;

revoke all on function public.set_student_financial_status(uuid, text, text)
  from public, anon;
grant execute on function public.set_student_financial_status(uuid, text, text)
  to authenticated;

do $$
begin
  if exists (
    select 1
    from public.students student
    where student.financial_status is distinct from 'unknown'
  ) then
    raise exception 'Sensitive financial state remains in public.students';
  end if;

  if exists (
    select 1
    from public.students student
    left join public.student_financial_statuses financial
      on financial.student_id = student.id
     and financial.organization_id = student.organization_id
    where student.organization_id is not null
      and financial.student_id is null
  ) then
    raise exception 'Financial status backfill is incomplete';
  end if;
end
$$;

notify pgrst, 'reload schema';
