create table if not exists public.student_pre_registrations (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  child_name text not null,
  guardian_name text not null,
  guardian_phone text not null,
  age_or_birth text null,
  class_interest text null,
  unit_interest text null,
  trial_date date null,
  status text not null default 'lead' check (status in ('lead', 'trial_scheduled', 'trial_done', 'converted', 'lost')),
  notes text null,
  converted_student_id text null references public.students(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_source_pre_registration_fk'
  ) then
    alter table public.students
      add constraint students_source_pre_registration_fk
      foreign key (source_pre_registration_id)
      references public.student_pre_registrations(id)
      on delete set null;
  end if;
end $$;

create index if not exists student_pre_registrations_org_status_created_idx
  on public.student_pre_registrations (organization_id, status, created_at desc);

create index if not exists student_pre_registrations_org_guardian_phone_idx
  on public.student_pre_registrations (organization_id, guardian_phone);

create index if not exists student_pre_registrations_org_trial_date_idx
  on public.student_pre_registrations (organization_id, trial_date);

alter table public.student_pre_registrations enable row level security;

drop policy if exists "student_pre_registrations_select_admin" on public.student_pre_registrations;
create policy "student_pre_registrations_select_admin"
  on public.student_pre_registrations
  for select
  using (public.is_org_admin(organization_id));

drop policy if exists "student_pre_registrations_insert_admin" on public.student_pre_registrations;
create policy "student_pre_registrations_insert_admin"
  on public.student_pre_registrations
  for insert
  with check (public.is_org_admin(organization_id));

drop policy if exists "student_pre_registrations_update_admin" on public.student_pre_registrations;
create policy "student_pre_registrations_update_admin"
  on public.student_pre_registrations
  for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "student_pre_registrations_delete_admin" on public.student_pre_registrations;
create policy "student_pre_registrations_delete_admin"
  on public.student_pre_registrations
  for delete
  using (public.is_org_admin(organization_id));
