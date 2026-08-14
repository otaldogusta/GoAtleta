-- Applied remotely on 2026-08-13 as migration 20260813200627.
alter table if exists public.students
  add column if not exists membership_status text not null default 'active',
  add column if not exists financial_status text not null default 'regular',
  add column if not exists inactivated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'students_membership_status_check'
  ) then
    alter table public.students
      add constraint students_membership_status_check
      check (membership_status in ('active', 'inactive'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'students_financial_status_check'
  ) then
    alter table public.students
      add constraint students_financial_status_check
      check (financial_status in ('regular', 'delinquent'));
  end if;
end
$$;

create index if not exists students_org_membership_status_idx
  on public.students (organization_id, membership_status);

create index if not exists students_org_financial_status_idx
  on public.students (organization_id, financial_status);

comment on column public.students.membership_status is
  'Operational lifecycle of the athlete. Inactive athletes keep history but are excluded from new attendance calls.';

comment on column public.students.financial_status is
  'Independent financial signal. It must not change attendance or membership state.';
