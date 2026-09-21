-- Temporal staff history, scheduled substitutions and evidence-backed transitions.
-- Additive foundation: class_staff remains the current-team compatibility projection.

create table if not exists public.class_staff_versions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, class_id)
);

create table if not exists public.class_staff_tenures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  staff_profile_id uuid references public.organization_staff_profiles(id) on delete set null,
  display_name_snapshot text not null,
  staff_role text not null check (staff_role in ('head', 'assistant', 'intern')),
  status text not null default 'active' check (status in ('scheduled', 'active', 'away', 'completed', 'cancelled')),
  starts_on date not null,
  ends_on date,
  date_precision text not null default 'exact' check (date_precision in ('exact', 'estimated')),
  reason text,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  ended_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or staff_profile_id is not null),
  check (ends_on is null or ends_on >= starts_on)
);

create unique index if not exists class_staff_tenures_active_user_unique
  on public.class_staff_tenures(class_id, user_id)
  where user_id is not null and ends_on is null and status in ('scheduled', 'active', 'away');
create unique index if not exists class_staff_tenures_active_profile_unique
  on public.class_staff_tenures(class_id, staff_profile_id)
  where staff_profile_id is not null and ends_on is null and status in ('scheduled', 'active', 'away');
create index if not exists class_staff_tenures_timeline_idx
  on public.class_staff_tenures(organization_id, class_id, starts_on desc);

create table if not exists public.class_staff_substitutions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  absent_tenure_id uuid not null references public.class_staff_tenures(id) on delete restrict,
  absent_user_id uuid references auth.users(id) on delete set null,
  replacement_user_id uuid references auth.users(id) on delete set null,
  replacement_staff_profile_id uuid references public.organization_staff_profiles(id) on delete set null,
  replacement_name_snapshot text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'active', 'completed', 'cancelled')),
  reason text,
  notes text,
  returned_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (replacement_user_id is not null or replacement_staff_profile_id is not null),
  check (ends_on >= starts_on),
  check (absent_user_id is null or replacement_user_id is null or absent_user_id <> replacement_user_id)
);

create index if not exists class_staff_substitutions_active_idx
  on public.class_staff_substitutions(organization_id, class_id, starts_on, ends_on)
  where status <> 'cancelled';

create table if not exists public.class_transition_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  substitution_id uuid not null references public.class_staff_substitutions(id) on delete cascade,
  evidence jsonb not null default '{}'::jsonb,
  generated_summary text not null,
  current_summary text not null,
  evidence_count integer not null default 0,
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  generation_status text not null default 'pending' check (generation_status in ('pending', 'generated', 'insufficient_evidence', 'failed')),
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (substitution_id)
);

create table if not exists public.class_transition_summary_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  summary_id uuid not null references public.class_transition_summaries(id) on delete cascade,
  previous_summary text not null,
  revised_summary text not null,
  reason text not null,
  revised_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.class_transition_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  substitution_id uuid not null references public.class_staff_substitutions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  last_error text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (substitution_id)
);

create table if not exists public.class_staff_change_receipts (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  idempotency_key uuid not null,
  applied_version bigint not null,
  receipt jsonb not null,
  applied_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (organization_id, class_id, idempotency_key)
);

create table if not exists public.class_staff_tenure_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tenure_id uuid not null references public.class_staff_tenures(id) on delete cascade,
  previous_starts_on date not null,
  previous_ends_on date,
  revised_starts_on date not null,
  revised_ends_on date,
  previous_date_precision text not null,
  revised_date_precision text not null,
  reason text not null,
  revised_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.class_session_coverages
  add column if not exists substitution_id uuid references public.class_staff_substitutions(id) on delete set null;
create index if not exists class_session_coverages_substitution_idx
  on public.class_session_coverages(substitution_id)
  where substitution_id is not null;

-- Preserve authorship for evidence aggregation.
alter table public.training_plans add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.training_plans add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.training_plans add column if not exists updated_at timestamptz;
alter table public.class_plans add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.class_plans add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.class_plans add column if not exists updated_at timestamptz;
alter table public.scouting_logs add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.scouting_logs add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.scouting_logs add column if not exists updated_at timestamptz;
alter table public.student_scouting_logs add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.student_scouting_logs add column if not exists updated_by uuid references auth.users(id) on delete set null;
alter table public.student_scouting_logs add column if not exists updated_at timestamptz;

do $$
declare table_name text;
begin
  foreach table_name in array array['training_plans','class_plans','scouting_logs','student_scouting_logs']
  loop
    execute format('drop trigger if exists %I_audit on public.%I', table_name, table_name);
    execute format('create trigger %I_audit before insert or update on public.%I for each row execute function public.set_audit_fields()', table_name, table_name);
  end loop;
end $$;

-- Backfill the currently configured team. created_at is the earliest known date, not a claimed real start.
insert into public.class_staff_tenures (
  organization_id, class_id, user_id, staff_profile_id, display_name_snapshot,
  staff_role, status, starts_on, date_precision, created_at
)
select
  staff.organization_id,
  staff.class_id,
  staff.user_id,
  staff.staff_profile_id,
  coalesce(
    nullif(trim(profile.display_name), ''),
    nullif(trim(member.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(member.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(member.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(split_part(coalesce(member.email, ''), '@', 1)), ''),
    'Profissional'
  ),
  staff.staff_role,
  'active',
  coalesce(staff.created_at::date, current_date),
  'estimated',
  coalesce(staff.created_at, now())
from public.class_staff staff
left join public.organization_staff_profiles profile on profile.id = staff.staff_profile_id
left join auth.users member on member.id = staff.user_id
where not exists (
  select 1 from public.class_staff_tenures tenure
  where tenure.class_id = staff.class_id
    and coalesce(tenure.user_id::text, tenure.staff_profile_id::text)
      = coalesce(staff.user_id::text, staff.staff_profile_id::text)
    and tenure.ends_on is null
);

insert into public.class_staff_versions(organization_id, class_id, version)
select distinct organization_id, class_id, 0 from public.class_staff
on conflict do nothing;

create or replace function public.can_read_class(_class_id text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.classes class
    where class.id = _class_id
      and (
        public.is_org_admin(class.organization_id)
        or exists (
          select 1 from public.class_staff staff
          where staff.organization_id = class.organization_id
            and staff.class_id = class.id
            and staff.user_id = auth.uid()
        )
        or exists (
          select 1 from public.class_staff_substitutions substitution
          where substitution.organization_id = class.organization_id
            and substitution.class_id = class.id
            and substitution.replacement_user_id = auth.uid()
            and substitution.status <> 'cancelled'
            and current_date between substitution.starts_on and substitution.ends_on
        )
      )
  );
$$;

create or replace function public.can_manage_class(_class_id text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.classes class
    where class.id = _class_id
      and (
        public.is_org_admin(class.organization_id)
        or exists (
          select 1 from public.class_staff staff
          where staff.organization_id = class.organization_id
            and staff.class_id = class.id
            and staff.user_id = auth.uid()
            and not exists (
              select 1 from public.class_staff_substitutions substitution
              where substitution.organization_id = staff.organization_id
                and substitution.class_id = staff.class_id
                and substitution.absent_user_id = staff.user_id
                and substitution.status <> 'cancelled'
                and current_date between substitution.starts_on and substitution.ends_on
            )
        )
        or exists (
          select 1 from public.class_staff_substitutions substitution
          where substitution.organization_id = class.organization_id
            and substitution.class_id = class.id
            and substitution.replacement_user_id = auth.uid()
            and substitution.status <> 'cancelled'
            and current_date between substitution.starts_on and substitution.ends_on
        )
      )
  );
$$;

create or replace function public.is_class_staff(_class_id text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$ select public.can_manage_class(_class_id); $$;

revoke all on function public.can_read_class(text), public.can_manage_class(text), public.is_class_staff(text) from public, anon;
grant execute on function public.can_read_class(text), public.can_manage_class(text), public.is_class_staff(text) to authenticated;

-- Read-only access for an absent head is additive; existing write policies continue through is_class_staff/can_manage_class.
do $$
declare target_table text;
declare class_column text;
begin
  for target_table, class_column in
    select * from (values
      ('classes','id'),
      ('students','classid'),
      ('attendance_logs','classid'),
      ('session_logs','classid'),
      ('training_plans','classid'),
      ('class_plans','classid'),
      ('scouting_logs','classid'),
      ('student_scouting_logs','classid'),
      ('absence_notices','class_id')
    ) as targets(table_name, column_name)
  loop
    if to_regclass('public.' || target_table) is not null then
      execute format('drop policy if exists temporal_staff_read on public.%I', target_table);
      execute format(
        'create policy temporal_staff_read on public.%I for select to authenticated using (public.can_read_class(%I::text))',
        target_table,
        class_column
      );
    end if;
  end loop;
end $$;

alter table public.class_staff_versions enable row level security;
alter table public.class_staff_tenures enable row level security;
alter table public.class_staff_substitutions enable row level security;
alter table public.class_transition_summaries enable row level security;
alter table public.class_transition_summary_revisions enable row level security;
alter table public.class_transition_jobs enable row level security;
alter table public.class_staff_change_receipts enable row level security;
alter table public.class_staff_tenure_revisions enable row level security;

create policy class_staff_tenures_read on public.class_staff_tenures for select to authenticated
  using (public.can_read_class(class_id));
create policy class_staff_versions_read on public.class_staff_versions for select to authenticated
  using (public.can_read_class(class_id));
create policy class_staff_substitutions_read on public.class_staff_substitutions for select to authenticated
  using (public.can_read_class(class_id));
create policy class_transition_summaries_read on public.class_transition_summaries for select to authenticated
  using (public.can_read_class(class_id));
create policy class_transition_revisions_read on public.class_transition_summary_revisions for select to authenticated
  using (exists (
    select 1 from public.class_transition_summaries summary
    where summary.id = summary_id and public.can_read_class(summary.class_id)
  ));
create policy class_staff_tenure_revisions_read on public.class_staff_tenure_revisions for select to authenticated
  using (exists (
    select 1 from public.class_staff_tenures tenure
    where tenure.id = tenure_id and public.can_read_class(tenure.class_id)
  ));

revoke all on public.class_staff_versions, public.class_staff_tenures, public.class_staff_substitutions,
  public.class_transition_summaries, public.class_transition_summary_revisions,
  public.class_transition_jobs, public.class_staff_change_receipts,
  public.class_staff_tenure_revisions from anon, public;
grant select on public.class_staff_versions, public.class_staff_tenures, public.class_staff_substitutions,
  public.class_transition_summaries, public.class_transition_summary_revisions,
  public.class_staff_tenure_revisions to authenticated;

create or replace function public.admin_apply_class_staff_assignments_v2(
  p_org_id uuid,
  p_class_id text,
  p_assignments jsonb,
  p_expected_version bigint,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  current_version bigint;
  existing_receipt jsonb;
  result jsonb;
begin
  if auth.uid() is null or not public.is_org_admin(p_org_id) then raise exception 'Not authorized'; end if;

  select receipt into existing_receipt
  from public.class_staff_change_receipts
  where organization_id = p_org_id and class_id = p_class_id and idempotency_key = p_idempotency_key;
  if existing_receipt is not null then return existing_receipt; end if;

  insert into public.class_staff_versions(organization_id, class_id, version)
  values (p_org_id, p_class_id, 0)
  on conflict do nothing;

  select version into current_version
  from public.class_staff_versions
  where organization_id = p_org_id and class_id = p_class_id
  for update;

  if current_version <> p_expected_version then raise exception 'STALE_CLASS_STAFF_VERSION'; end if;

  perform public.admin_replace_class_staff_assignments(p_org_id, p_class_id, p_assignments);

  update public.class_staff_tenures tenure
  set ends_on = current_date,
      status = 'completed',
      ended_by = auth.uid(),
      updated_at = now()
  where tenure.organization_id = p_org_id
    and tenure.class_id = p_class_id
    and tenure.ends_on is null
    and not exists (
      select 1 from public.class_staff staff
      where staff.organization_id = p_org_id
        and staff.class_id = p_class_id
        and coalesce(staff.user_id::text, staff.staff_profile_id::text)
          = coalesce(tenure.user_id::text, tenure.staff_profile_id::text)
        and staff.staff_role = tenure.staff_role
    );

  insert into public.class_staff_tenures(
    organization_id, class_id, user_id, staff_profile_id, display_name_snapshot,
    staff_role, status, starts_on, date_precision
  )
  select
    staff.organization_id,
    staff.class_id,
    staff.user_id,
    staff.staff_profile_id,
    coalesce(
      nullif(trim(profile.display_name), ''),
      nullif(trim(member.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(member.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(member.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(split_part(coalesce(member.email, ''), '@', 1)), ''),
      'Profissional'
    ),
    staff.staff_role,
    'active',
    current_date,
    'exact'
  from public.class_staff staff
  left join public.organization_staff_profiles profile on profile.id = staff.staff_profile_id
  left join auth.users member on member.id = staff.user_id
  where staff.organization_id = p_org_id and staff.class_id = p_class_id
    and not exists (
      select 1 from public.class_staff_tenures tenure
      where tenure.organization_id = p_org_id
        and tenure.class_id = p_class_id
        and tenure.ends_on is null
        and coalesce(tenure.user_id::text, tenure.staff_profile_id::text)
          = coalesce(staff.user_id::text, staff.staff_profile_id::text)
        and tenure.staff_role = staff.staff_role
    );

  current_version := current_version + 1;
  update public.class_staff_versions
  set version = current_version, updated_at = now()
  where organization_id = p_org_id and class_id = p_class_id;

  result := jsonb_build_object('class_id', p_class_id, 'version', current_version, 'applied_at', now());
  insert into public.class_staff_change_receipts(
    organization_id, class_id, idempotency_key, applied_version, receipt, applied_by
  ) values (p_org_id, p_class_id, p_idempotency_key, current_version, result, auth.uid());

  return result;
end;
$$;

create or replace function public.admin_schedule_class_substitution(
  p_org_id uuid,
  p_class_id text,
  p_absent_tenure_id uuid,
  p_replacement_user_id uuid,
  p_replacement_staff_profile_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_reason text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare substitution_id uuid;
declare absent_tenure public.class_staff_tenures%rowtype;
declare replacement_name text;
begin
  if auth.uid() is null or not public.is_org_admin(p_org_id) then raise exception 'Not authorized'; end if;
  if p_ends_on < p_starts_on then raise exception 'Invalid substitution period'; end if;

  select * into absent_tenure from public.class_staff_tenures
  where id = p_absent_tenure_id and organization_id = p_org_id and class_id = p_class_id and ends_on is null;
  if not found then raise exception 'Active tenure not found'; end if;

  if p_replacement_user_id is not null then
    select coalesce(
      nullif(trim(member.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(member.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(member.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(split_part(coalesce(member.email, ''), '@', 1)), ''),
      'Profissional'
    )
      into replacement_name
    from auth.users member
    where member.id = p_replacement_user_id
      and exists (
        select 1 from public.organization_members membership
        where membership.organization_id = p_org_id and membership.user_id = member.id
      );
  elsif p_replacement_staff_profile_id is not null then
    select display_name into replacement_name from public.organization_staff_profiles
    where organization_id = p_org_id and id = p_replacement_staff_profile_id;
  end if;
  if replacement_name is null then raise exception 'Replacement identity not found'; end if;

  if exists (
    select 1 from public.class_staff_substitutions substitution
    where substitution.organization_id = p_org_id
      and substitution.class_id = p_class_id
      and substitution.status <> 'cancelled'
      and daterange(substitution.starts_on, substitution.ends_on, '[]') && daterange(p_starts_on, p_ends_on, '[]')
  ) then raise exception 'Substitution period overlaps an existing substitution'; end if;

  insert into public.class_staff_substitutions(
    organization_id, class_id, absent_tenure_id, absent_user_id,
    replacement_user_id, replacement_staff_profile_id, replacement_name_snapshot,
    starts_on, ends_on, status, reason, notes
  ) values (
    p_org_id, p_class_id, absent_tenure.id, absent_tenure.user_id,
    p_replacement_user_id, p_replacement_staff_profile_id, replacement_name,
    p_starts_on, p_ends_on,
    case when current_date < p_starts_on then 'scheduled'
         when current_date > p_ends_on then 'completed'
         else 'active' end,
    nullif(trim(p_reason), ''), nullif(trim(p_notes), '')
  ) returning id into substitution_id;

  if current_date between p_starts_on and p_ends_on then
    update public.class_staff_tenures
    set status = 'away', updated_at = now()
    where id = absent_tenure.id;
  end if;

  -- Materialize the interval over the class schedule. A manually edited coverage remains
  -- the explicit per-session exception because only rows for this substitution are updated.
  insert into public.class_session_coverages(
    organization_id, class_id, session_date, absent_user_id, replacement_user_id,
    replacement_role, status, reason, notes, substitution_id, created_by, updated_by
  )
  select
    p_org_id, p_class_id, scheduled_day::date, absent_tenure.user_id, p_replacement_user_id,
    'substitute', 'confirmed', nullif(trim(p_reason), ''), nullif(trim(p_notes), ''),
    substitution_id, auth.uid(), auth.uid()
  from public.classes class
  cross join generate_series(p_starts_on, p_ends_on, interval '1 day') scheduled_day
  where class.id = p_class_id
    and class.organization_id = p_org_id
    and class.days @> jsonb_build_array(extract(dow from scheduled_day)::integer)
  on conflict (organization_id, class_id, session_date) do nothing;

  if p_ends_on < current_date then
    insert into public.class_transition_jobs(organization_id, class_id, substitution_id)
    values (p_org_id, p_class_id, substitution_id)
    on conflict do nothing;
  end if;

  return substitution_id;
end;
$$;

create or replace function public.admin_cancel_class_substitution(
  p_org_id uuid,
  p_substitution_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare substitution public.class_staff_substitutions%rowtype;
begin
  if auth.uid() is null or not public.is_org_admin(p_org_id) then raise exception 'Not authorized'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Cancellation reason is required'; end if;

  select * into substitution from public.class_staff_substitutions
  where id = p_substitution_id and organization_id = p_org_id for update;
  if not found then raise exception 'Substitution not found'; end if;
  if substitution.status = 'completed' then raise exception 'Completed substitution cannot be cancelled'; end if;

  update public.class_staff_substitutions
  set status = 'cancelled', notes = concat_ws(E'\n', notes, 'Cancelamento: ' || trim(p_reason)),
      updated_by = auth.uid(), updated_at = now()
  where id = substitution.id;
  update public.class_session_coverages
  set status = 'cancelled', updated_by = auth.uid(), updated_at = now()
  where substitution_id = substitution.id and status in ('pending', 'confirmed');
  update public.class_staff_tenures tenure
  set status = 'active', updated_at = now()
  where tenure.id = substitution.absent_tenure_id
    and not exists (
      select 1 from public.class_staff_substitutions other
      where other.absent_tenure_id = tenure.id and other.id <> substitution.id
        and other.status <> 'cancelled' and current_date between other.starts_on and other.ends_on
    );
end;
$$;

create or replace function public.admin_register_class_staff_return(
  p_org_id uuid,
  p_substitution_id uuid,
  p_returned_on date default current_date,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare substitution public.class_staff_substitutions%rowtype;
begin
  if auth.uid() is null or not public.is_org_admin(p_org_id) then raise exception 'Not authorized'; end if;
  select * into substitution from public.class_staff_substitutions
  where id = p_substitution_id and organization_id = p_org_id and status <> 'cancelled' for update;
  if not found then raise exception 'Substitution not found'; end if;
  if p_returned_on < substitution.starts_on then raise exception 'Return cannot precede substitution'; end if;

  update public.class_staff_substitutions
  set ends_on = least(ends_on, p_returned_on), status = 'completed', returned_at = now(),
      notes = concat_ws(E'\n', notes, nullif(trim(p_notes), '')),
      updated_by = auth.uid(), updated_at = now()
  where id = substitution.id;
  update public.class_session_coverages
  set status = 'cancelled', updated_by = auth.uid(), updated_at = now()
  where substitution_id = substitution.id and session_date > p_returned_on and status in ('pending', 'confirmed');
  update public.class_staff_tenures set status = 'active', updated_at = now()
  where id = substitution.absent_tenure_id;
  insert into public.class_transition_jobs(organization_id, class_id, substitution_id, available_at)
  values (substitution.organization_id, substitution.class_id, substitution.id, now())
  on conflict (substitution_id) do update set status = 'pending', available_at = now(), last_error = null;
  -- The processor is defined below in this migration and is also scheduled as a retry loop.
  perform public.process_class_transition_jobs(1);
end;
$$;

create or replace function public.admin_correct_class_staff_tenure_dates(
  p_org_id uuid,
  p_tenure_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_date_precision text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare tenure public.class_staff_tenures%rowtype;
begin
  if auth.uid() is null or not public.is_org_admin(p_org_id) then raise exception 'Not authorized'; end if;
  if p_ends_on is not null and p_ends_on < p_starts_on then raise exception 'Invalid tenure period'; end if;
  if p_date_precision not in ('exact', 'estimated') then raise exception 'Invalid date precision'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Correction reason is required'; end if;

  select * into tenure from public.class_staff_tenures
  where id = p_tenure_id and organization_id = p_org_id for update;
  if not found then raise exception 'Tenure not found'; end if;

  insert into public.class_staff_tenure_revisions(
    organization_id, tenure_id, previous_starts_on, previous_ends_on,
    revised_starts_on, revised_ends_on, previous_date_precision,
    revised_date_precision, reason, revised_by
  ) values (
    tenure.organization_id, tenure.id, tenure.starts_on, tenure.ends_on,
    p_starts_on, p_ends_on, tenure.date_precision, p_date_precision, trim(p_reason), auth.uid()
  );
  update public.class_staff_tenures
  set starts_on = p_starts_on, ends_on = p_ends_on, date_precision = p_date_precision,
      status = case when p_ends_on is not null and p_ends_on < current_date then 'completed' else status end,
      updated_at = now()
  where id = tenure.id;
end;
$$;

create or replace function public.complete_due_class_substitutions()
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare affected integer;
begin
  update public.class_staff_substitutions
  set status = 'active', updated_at = now()
  where status = 'scheduled' and current_date between starts_on and ends_on;

  update public.class_staff_tenures tenure
  set status = 'away', updated_at = now()
  where exists (
    select 1 from public.class_staff_substitutions substitution
    where substitution.absent_tenure_id = tenure.id and substitution.status = 'active'
      and current_date between substitution.starts_on and substitution.ends_on
  );

  update public.class_staff_substitutions
  set status = 'completed', returned_at = coalesce(returned_at, now()), updated_at = now()
  where status in ('scheduled', 'active') and ends_on < current_date;
  get diagnostics affected = row_count;

  update public.class_session_coverages coverage
  set status = 'completed', updated_at = now()
  where coverage.status = 'confirmed'
    and exists (
      select 1 from public.class_staff_substitutions substitution
      where substitution.id = coverage.substitution_id and substitution.status = 'completed'
    );

  update public.class_staff_tenures tenure
  set status = 'active', updated_at = now()
  where tenure.status = 'away'
    and not exists (
      select 1 from public.class_staff_substitutions substitution
      where substitution.absent_tenure_id = tenure.id and substitution.status = 'active'
        and current_date between substitution.starts_on and substitution.ends_on
    );

  insert into public.class_transition_jobs(organization_id, class_id, substitution_id)
  select organization_id, class_id, id
  from public.class_staff_substitutions
  where status = 'completed'
  on conflict do nothing;

  return affected;
end;
$$;

create or replace function public.process_class_transition_jobs(p_limit integer default 20)
returns integer
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare job public.class_transition_jobs%rowtype;
declare substitution public.class_staff_substitutions%rowtype;
declare session_count integer;
declare plan_count integer;
declare attendance_count integer;
declare scouting_count integer;
declare evidence_count integer;
declare focus_values jsonb;
declare evidence_refs jsonb;
declare evidence jsonb;
declare narrative text;
declare processed integer := 0;
begin
  for job in
    select * from public.class_transition_jobs
    where status in ('pending', 'failed') and available_at <= now()
    order by available_at, created_at
    limit greatest(1, least(coalesce(p_limit, 20), 100))
    for update skip locked
  loop
    begin
      update public.class_transition_jobs
      set status = 'processing', attempts = attempts + 1, locked_at = now(), last_error = null
      where id = job.id;

      select * into substitution from public.class_staff_substitutions where id = job.substitution_id;
      if not found or substitution.status <> 'completed' then raise exception 'Substitution is not completed'; end if;

      select count(*) into session_count from public.session_logs log
      where log.classid = substitution.class_id
        and log.created_by = substitution.replacement_user_id
        and log.createdat::date between substitution.starts_on and substitution.ends_on;
      select count(*) into plan_count from (
        select plan.id from public.training_plans plan
        where plan.classid = substitution.class_id and plan.created_by = substitution.replacement_user_id
          and plan.createdat::date between substitution.starts_on and substitution.ends_on
        union all
        select plan.id from public.class_plans plan
        where plan.classid = substitution.class_id and plan.created_by = substitution.replacement_user_id
          and plan.createdat::date between substitution.starts_on and substitution.ends_on
      ) authored_plans;
      select count(*) into attendance_count from public.attendance_logs log
      where log.classid = substitution.class_id and log.created_by = substitution.replacement_user_id
        and log.date between substitution.starts_on and substitution.ends_on;
      select count(*) into scouting_count from (
        select log.id from public.scouting_logs log
        where log.classid = substitution.class_id and log.created_by = substitution.replacement_user_id
          and log.date between substitution.starts_on and substitution.ends_on
        union all
        select log.id from public.student_scouting_logs log
        where log.classid = substitution.class_id and log.created_by = substitution.replacement_user_id
          and log.date between substitution.starts_on and substitution.ends_on
      ) authored_scouting;

      select coalesce(jsonb_agg(distinct value) filter (where value is not null and value <> ''), '[]'::jsonb)
      into focus_values
      from (
        select nullif(trim(log.technique), '') value from public.session_logs log
        where log.classid = substitution.class_id and log.created_by = substitution.replacement_user_id
          and log.createdat::date between substitution.starts_on and substitution.ends_on
        union all
        select nullif(trim(log.activity), '') value from public.session_logs log
        where log.classid = substitution.class_id and log.created_by = substitution.replacement_user_id
          and log.createdat::date between substitution.starts_on and substitution.ends_on
        union all
        select nullif(trim(plan.title), '') value from public.training_plans plan
        where plan.classid = substitution.class_id and plan.created_by = substitution.replacement_user_id
          and plan.createdat::date between substitution.starts_on and substitution.ends_on
      ) focuses;

      select coalesce(jsonb_agg(reference order by occurred_on desc), '[]'::jsonb)
      into evidence_refs
      from (
        select jsonb_build_object('type', 'session', 'id', log.id, 'date', log.createdat::date) reference, log.createdat occurred_on
        from public.session_logs log where log.classid = substitution.class_id
          and log.created_by = substitution.replacement_user_id and log.createdat::date between substitution.starts_on and substitution.ends_on
        union all
        select jsonb_build_object('type', 'training_plan', 'id', plan.id, 'date', plan.createdat::date), plan.createdat
        from public.training_plans plan where plan.classid = substitution.class_id
          and plan.created_by = substitution.replacement_user_id and plan.createdat::date between substitution.starts_on and substitution.ends_on
        union all
        select jsonb_build_object('type', 'class_plan', 'id', plan.id, 'date', plan.createdat::date), plan.createdat
        from public.class_plans plan where plan.classid = substitution.class_id
          and plan.created_by = substitution.replacement_user_id and plan.createdat::date between substitution.starts_on and substitution.ends_on
        union all
        select jsonb_build_object('type', 'attendance', 'id', log.id, 'date', log.date), log.createdat
        from public.attendance_logs log where log.classid = substitution.class_id
          and log.created_by = substitution.replacement_user_id and log.date between substitution.starts_on and substitution.ends_on
        union all
        select jsonb_build_object('type', 'scouting', 'id', log.id, 'date', log.date), log.createdat
        from public.scouting_logs log where log.classid = substitution.class_id
          and log.created_by = substitution.replacement_user_id and log.date between substitution.starts_on and substitution.ends_on
        union all
        select jsonb_build_object('type', 'student_scouting', 'id', log.id, 'date', log.date), log.createdat
        from public.student_scouting_logs log where log.classid = substitution.class_id
          and log.created_by = substitution.replacement_user_id and log.date between substitution.starts_on and substitution.ends_on
      ) references_with_dates;

      evidence_count := session_count + plan_count + attendance_count + scouting_count;
      evidence := jsonb_build_object(
        'period', jsonb_build_object('starts_on', substitution.starts_on, 'ends_on', substitution.ends_on),
        'absent_user_id', substitution.absent_user_id,
        'replacement_user_id', substitution.replacement_user_id,
        'replacement_name', substitution.replacement_name_snapshot,
        'counts', jsonb_build_object('sessions', session_count, 'plans', plan_count, 'attendance', attendance_count, 'scouting', scouting_count),
        'recurring_focuses', focus_values,
        'source_references', evidence_refs,
        'scope_rule', 'Only records authored by the replacement inside the substitution period are counted.'
      );
      narrative := case when evidence_count = 0 then
        format('%s substituiu o responsável de %s a %s. Não há registros autorais suficientes para descrever abordagem, evolução ou pendências pedagógicas.', substitution.replacement_name_snapshot, to_char(substitution.starts_on, 'DD/MM/YYYY'), to_char(substitution.ends_on, 'DD/MM/YYYY'))
      else
        format('%s atuou como substituto de %s a %s. Evidências autorais: %s sessões, %s planos, %s registros de frequência e %s registros de scouting. Focos registrados: %s. Este resumo descreve somente fatos sustentados pelos registros; estilo pessoal não é inferido.', substitution.replacement_name_snapshot, to_char(substitution.starts_on, 'DD/MM/YYYY'), to_char(substitution.ends_on, 'DD/MM/YYYY'), session_count, plan_count, attendance_count, scouting_count, case when jsonb_array_length(focus_values) = 0 then 'não identificados' else focus_values::text end)
      end;

      insert into public.class_transition_summaries(
        organization_id, class_id, substitution_id, evidence, generated_summary,
        current_summary, evidence_count, confidence, generation_status, generated_at
      ) values (
        substitution.organization_id, substitution.class_id, substitution.id, evidence, narrative,
        narrative, evidence_count, case when evidence_count = 0 then 0 else least(0.95, 0.35 + evidence_count * 0.05) end,
        case when evidence_count = 0 then 'insufficient_evidence' else 'generated' end, now()
      )
      on conflict (substitution_id) do update set
        evidence = excluded.evidence,
        generated_summary = excluded.generated_summary,
        current_summary = case
          when public.class_transition_summaries.current_summary = public.class_transition_summaries.generated_summary
            then excluded.current_summary
          else public.class_transition_summaries.current_summary
        end,
        evidence_count = excluded.evidence_count,
        confidence = excluded.confidence,
        generation_status = excluded.generation_status,
        generated_at = excluded.generated_at,
        updated_at = now();

      update public.class_transition_jobs
      set status = 'completed', completed_at = now(), locked_at = null
      where id = job.id;
      processed := processed + 1;
    exception when others then
      update public.class_transition_jobs
      set status = 'failed', last_error = left(sqlerrm, 500), locked_at = null,
          available_at = now() + make_interval(mins => least(60, greatest(1, attempts * 5)))
      where id = job.id;
    end;
  end loop;
  return processed;
end;
$$;

create or replace function public.revise_class_transition_summary(
  p_summary_id uuid,
  p_revised_summary text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare current_row public.class_transition_summaries%rowtype;
begin
  select * into current_row from public.class_transition_summaries where id = p_summary_id for update;
  if not found or not public.can_manage_class(current_row.class_id) then raise exception 'Not authorized'; end if;
  if length(trim(p_revised_summary)) < 10 or length(trim(p_reason)) < 3 then raise exception 'Summary and reason are required'; end if;

  insert into public.class_transition_summary_revisions(
    organization_id, summary_id, previous_summary, revised_summary, reason, revised_by
  ) values (
    current_row.organization_id, current_row.id, current_row.current_summary,
    trim(p_revised_summary), trim(p_reason), auth.uid()
  );

  update public.class_transition_summaries
  set current_summary = trim(p_revised_summary), updated_at = now()
  where id = p_summary_id;
end;
$$;

revoke all on function public.admin_apply_class_staff_assignments_v2(uuid,text,jsonb,bigint,uuid),
  public.admin_schedule_class_substitution(uuid,text,uuid,uuid,uuid,date,date,text,text),
  public.admin_cancel_class_substitution(uuid,uuid,text),
  public.admin_register_class_staff_return(uuid,uuid,date,text),
  public.admin_correct_class_staff_tenure_dates(uuid,uuid,date,date,text,text),
  public.complete_due_class_substitutions(),
  public.process_class_transition_jobs(integer),
  public.revise_class_transition_summary(uuid,text,text) from public, anon;
grant execute on function public.admin_apply_class_staff_assignments_v2(uuid,text,jsonb,bigint,uuid),
  public.admin_schedule_class_substitution(uuid,text,uuid,uuid,uuid,date,date,text,text),
  public.admin_cancel_class_substitution(uuid,uuid,text),
  public.admin_register_class_staff_return(uuid,uuid,date,text),
  public.admin_correct_class_staff_tenure_dates(uuid,uuid,date,date,text,text),
  public.revise_class_transition_summary(uuid,text,text) to authenticated;

-- Hosted environments with pg_cron process scheduled access changes and transition
-- summaries without requiring a client to be open. The block is safe in local stacks
-- where pg_cron is unavailable.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'class-staff-transition-maintenance') then
      perform cron.schedule(
        'class-staff-transition-maintenance',
        '*/15 * * * *',
        'select public.complete_due_class_substitutions(); select public.process_class_transition_jobs(50);'
      );
    end if;
  end if;
exception when undefined_table or invalid_schema_name or insufficient_privilege then
  null;
end;
$$;

comment on table public.class_staff_tenures is 'Append-preserving timeline of staff roles in a class.';
comment on table public.class_staff_substitutions is 'Scheduled temporary class access and absence intervals.';
comment on table public.class_transition_summaries is 'Evidence-backed automatic handoff summaries; corrections are versioned.';
comment on table public.class_staff_tenure_revisions is 'Append-only audit trail for historical date corrections.';
