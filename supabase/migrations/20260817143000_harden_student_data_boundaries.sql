-- P1 security hardening for student records.
--
-- This migration is intentionally non-destructive:
-- - existing rows in public.students are not updated or deleted;
-- - legacy health values remain in place and are read through an audited RPC;
-- - new health writes go to the isolated student_health_profiles table;
-- - class/organization integrity is validated before the FK becomes active.

-- ---------------------------------------------------------------------------
-- Student photos: private bucket + least-privilege object access.
-- ---------------------------------------------------------------------------

update storage.buckets
set public = false
where id = 'student-photos';

create or replace function private.can_manage_student_photo_object(
  p_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_parts text[];
  v_org_id uuid;
  v_student_id text;
begin
  v_parts := storage.foldername(p_object_name);

  if coalesce(array_length(v_parts, 1), 0) < 2 then
    return false;
  end if;

  if v_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_org_id := v_parts[1]::uuid;
  v_student_id := nullif(v_parts[2], '');

  if v_student_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.students s
    where s.id = v_student_id
      and s.organization_id = v_org_id
      and (
        s.student_user_id = (select auth.uid())
        or public.is_org_admin(v_org_id)
        or public.is_class_staff(s.classid)
        or exists (
          select 1
          from public.student_class_enrollments sce
          where sce.student_id = s.id
            and sce.organization_id = s.organization_id
            and sce.status = 'active'
            and public.is_class_staff(sce.class_id)
        )
      )
  );
end;
$$;

revoke all on function private.can_manage_student_photo_object(text)
  from public, anon;
grant execute on function private.can_manage_student_photo_object(text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Students: remove legacy tenant branches and enforce class/org integrity.
-- ---------------------------------------------------------------------------

do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'students'
  loop
    execute format('drop policy if exists %I on public.students', v_policy.policyname);
  end loop;
end;
$$;

alter table public.students enable row level security;

create policy students_select_scoped
  on public.students
  for select
  to authenticated
  using (
    student_user_id = (select auth.uid())
    or owner_id = (select auth.uid())
    or public.is_org_admin(organization_id)
    or public.is_class_staff(classid)
    or exists (
      select 1
      from public.student_class_enrollments sce
      where sce.student_id = students.id
        and sce.organization_id = students.organization_id
        and sce.status = 'active'
        and public.is_class_staff(sce.class_id)
    )
  );

create policy students_insert_scoped
  on public.students
  for insert
  to authenticated
  with check (
    public.is_org_admin(organization_id)
    or public.is_class_staff(classid)
  );

create policy students_update_scoped
  on public.students
  for update
  to authenticated
  using (
    public.is_org_admin(organization_id)
    or public.is_class_staff(classid)
    or exists (
      select 1
      from public.student_class_enrollments sce
      where sce.student_id = students.id
        and sce.organization_id = students.organization_id
        and sce.status = 'active'
        and public.is_class_staff(sce.class_id)
    )
  )
  with check (
    public.is_org_admin(organization_id)
    or public.is_class_staff(classid)
    or exists (
      select 1
      from public.student_class_enrollments sce
      where sce.student_id = students.id
        and sce.organization_id = students.organization_id
        and sce.status = 'active'
        and public.is_class_staff(sce.class_id)
    )
  );

create policy students_delete_admin_only
  on public.students
  for delete
  to authenticated
  using (public.is_org_admin(organization_id));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.classes'::regclass
      and contype in ('p', 'u')
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.classes'::regclass and attname = 'id'),
        (select attnum from pg_attribute where attrelid = 'public.classes'::regclass and attname = 'organization_id')
      ]::smallint[]
  ) then
    alter table public.classes
      add constraint classes_id_organization_unique unique (id, organization_id);
  end if;
end;
$$;

alter table public.students
  drop constraint if exists students_class_organization_fkey;

alter table public.students
  add constraint students_class_organization_fkey
  foreign key (classid, organization_id)
  references public.classes (id, organization_id)
  on update cascade
  on delete restrict
  not valid;

alter table public.students
  validate constraint students_class_organization_fkey;

create index if not exists students_organization_class_idx
  on public.students (organization_id, classid);

-- ---------------------------------------------------------------------------
-- Health data: isolated storage, audited access, legacy read compatibility.
-- ---------------------------------------------------------------------------

create table if not exists public.student_health_profiles (
  student_id text primary key references public.students(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  health_issue boolean not null default false,
  health_issue_notes text,
  medication_use boolean not null default false,
  medication_notes text,
  health_observations text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_health_profiles_organization_idx
  on public.student_health_profiles (organization_id, student_id);

alter table public.student_health_profiles enable row level security;

drop policy if exists student_health_profiles_deny_direct_access
  on public.student_health_profiles;
create policy student_health_profiles_deny_direct_access
  on public.student_health_profiles
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.student_health_profiles from public, anon, authenticated;
grant select, insert, update, delete on table public.student_health_profiles to service_role;

create or replace function private.can_access_student_health(
  p_student_id text
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
    from public.students s
    where s.id = p_student_id
      and (
        s.student_user_id = (select auth.uid())
        or s.owner_id = (select auth.uid())
        or public.is_org_admin(s.organization_id)
        or public.is_class_staff(s.classid)
        or exists (
          select 1
          from public.student_class_enrollments sce
          where sce.student_id = s.id
            and sce.organization_id = s.organization_id
            and sce.status = 'active'
            and public.is_class_staff(sce.class_id)
        )
      )
  );
$$;

revoke all on function private.can_access_student_health(text)
  from public, anon, authenticated;
grant execute on function private.can_access_student_health(text)
  to service_role;

create or replace function public.get_student_health_profiles(
  p_student_ids text[],
  p_reason text,
  p_source text
)
returns table (
  student_id text,
  health_issue boolean,
  health_issue_notes text,
  medication_use boolean,
  medication_notes text,
  health_observations text,
  source_is_legacy boolean,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'REASON_REQUIRED';
  end if;
  if nullif(btrim(p_source), '') is null then
    raise exception 'SOURCE_REQUIRED';
  end if;

  return query
  with requested as materialized (
    select distinct nullif(btrim(value), '') as requested_student_id
    from unnest(coalesce(p_student_ids, array[]::text[])) as value
    where nullif(btrim(value), '') is not null
    limit 500
  ), allowed as materialized (
    select
      s.id as student_id,
      coalesce(h.health_issue, s.health_issue, false) as health_issue,
      coalesce(h.health_issue_notes, s.health_issue_notes) as health_issue_notes,
      coalesce(h.medication_use, s.medication_use, false) as medication_use,
      coalesce(h.medication_notes, s.medication_notes) as medication_notes,
      coalesce(h.health_observations, s.health_observations) as health_observations,
      h.student_id is null as source_is_legacy,
      h.updated_at
    from requested r
    join public.students s on s.id = r.requested_student_id
    left join public.student_health_profiles h on h.student_id = s.id
    where private.can_access_student_health(s.id)
  ), logged as (
    insert into public.health_data_access_logs (
      student_id,
      accessed_by,
      reason,
      source,
      metadata
    )
    select
      a.student_id,
      (select auth.uid()),
      btrim(p_reason),
      btrim(p_source),
      jsonb_build_object('action', 'read', 'source_is_legacy', a.source_is_legacy)
    from allowed a
    returning health_data_access_logs.student_id
  )
  select
    a.student_id,
    a.health_issue,
    a.health_issue_notes,
    a.medication_use,
    a.medication_notes,
    a.health_observations,
    a.source_is_legacy,
    a.updated_at
  from allowed a
  join logged l using (student_id);
end;
$$;

create or replace function public.upsert_student_health_profile(
  p_student_id text,
  p_health_issue boolean,
  p_health_issue_notes text,
  p_medication_use boolean,
  p_medication_notes text,
  p_health_observations text,
  p_reason text,
  p_source text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_organization_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'REASON_REQUIRED';
  end if;
  if nullif(btrim(p_source), '') is null then
    raise exception 'SOURCE_REQUIRED';
  end if;
  if not private.can_access_student_health(p_student_id) then
    raise exception 'FORBIDDEN';
  end if;

  select s.organization_id
  into v_organization_id
  from public.students s
  where s.id = p_student_id;

  if v_organization_id is null then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  insert into public.student_health_profiles (
    student_id,
    organization_id,
    health_issue,
    health_issue_notes,
    medication_use,
    medication_notes,
    health_observations,
    updated_by,
    updated_at
  ) values (
    p_student_id,
    v_organization_id,
    coalesce(p_health_issue, false),
    case when coalesce(p_health_issue, false) then nullif(btrim(p_health_issue_notes), '') else null end,
    coalesce(p_medication_use, false),
    case when coalesce(p_medication_use, false) then nullif(btrim(p_medication_notes), '') else null end,
    nullif(btrim(p_health_observations), ''),
    (select auth.uid()),
    now()
  )
  on conflict (student_id) do update set
    organization_id = excluded.organization_id,
    health_issue = excluded.health_issue,
    health_issue_notes = excluded.health_issue_notes,
    medication_use = excluded.medication_use,
    medication_notes = excluded.medication_notes,
    health_observations = excluded.health_observations,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  insert into public.health_data_access_logs (
    student_id,
    accessed_by,
    reason,
    source,
    metadata
  ) values (
    p_student_id,
    (select auth.uid()),
    btrim(p_reason),
    btrim(p_source),
    jsonb_build_object('action', 'upsert')
  );
end;
$$;

revoke all on function public.get_student_health_profiles(text[], text, text)
  from public, anon;
grant execute on function public.get_student_health_profiles(text[], text, text)
  to authenticated, service_role;

revoke all on function public.upsert_student_health_profile(
  text, boolean, text, boolean, text, text, text, text
) from public, anon;
grant execute on function public.upsert_student_health_profile(
  text, boolean, text, boolean, text, text, text, text
) to authenticated, service_role;

create or replace function public.log_health_data_access(
  p_student_id text,
  p_reason text,
  p_source text,
  p_ip_address text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'REASON_REQUIRED';
  end if;
  if nullif(btrim(p_source), '') is null then
    raise exception 'SOURCE_REQUIRED';
  end if;
  if not private.can_access_student_health(p_student_id) then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.health_data_access_logs (
    student_id,
    accessed_by,
    reason,
    source,
    ip_address,
    metadata
  ) values (
    p_student_id,
    (select auth.uid()),
    btrim(p_reason),
    btrim(p_source),
    p_ip_address,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.log_health_data_access(text, text, text, text, jsonb)
  from public, anon;
grant execute on function public.log_health_data_access(text, text, text, text, jsonb)
  to authenticated, service_role;

drop policy if exists "Staff can view health access logs"
  on public.health_data_access_logs;
drop policy if exists health_data_access_logs_admin_select
  on public.health_data_access_logs;
create policy health_data_access_logs_admin_select
  on public.health_data_access_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = health_data_access_logs.student_id
        and public.is_org_admin(s.organization_id)
    )
  );

-- Remove direct access to health columns. Existing values remain untouched and
-- are available only through get_student_health_profiles(), which records the
-- purpose and source of each access.
do $$
declare
  v_select_columns text;
  v_insert_columns text;
  v_update_columns text;
begin
  revoke select, insert, update on table public.students from authenticated;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into v_select_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'students'
    and column_name not in (
      'health_issue',
      'health_issue_notes',
      'medication_use',
      'medication_notes',
      'health_observations'
    );

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into v_insert_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'students'
    and is_generated = 'NEVER'
    and is_identity = 'NO'
    and column_name not in (
      'health_issue',
      'health_issue_notes',
      'medication_use',
      'medication_notes',
      'health_observations'
    );

  v_update_columns := v_insert_columns;

  execute format('grant select (%s) on table public.students to authenticated', v_select_columns);
  execute format('grant insert (%s) on table public.students to authenticated', v_insert_columns);
  execute format('grant update (%s) on table public.students to authenticated', v_update_columns);
end;
$$;
