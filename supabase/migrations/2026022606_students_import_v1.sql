-- Students import v1: auditability, idempotency, and deterministic matching identifiers.

alter table if exists public.students
  add column if not exists external_id text null,
  add column if not exists rg_normalized text null,
  add column if not exists guardian_cpf_hmac text null;

create index if not exists students_org_external_id_idx
  on public.students (organization_id, external_id)
  where external_id is not null;

create index if not exists students_org_rg_idx
  on public.students (organization_id, rg_normalized)
  where rg_normalized is not null;

create index if not exists students_org_guardian_cpf_hmac_idx
  on public.students (organization_id, guardian_cpf_hmac)
  where guardian_cpf_hmac is not null;

create table if not exists public.student_import_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  source_filename text null,
  source_sha256 text not null,
  mode text not null check (mode in ('preview', 'apply')),
  policy text not null check (policy in ('conservador', 'misto', 'agressivo')),
  status text not null check (status in ('preview', 'applied', 'failed', 'partial')),
  summary jsonb null,
  created_at timestamptz not null default now(),
  applied_at timestamptz null
);

create index if not exists student_import_runs_org_created_idx
  on public.student_import_runs (organization_id, created_at desc);

create unique index if not exists student_import_runs_applied_unique_idx
  on public.student_import_runs (organization_id, source_sha256, policy)
  where mode = 'apply' and status in ('applied', 'partial');

create table if not exists public.student_import_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.student_import_runs(id) on delete cascade,
  row_number int not null check (row_number > 0),
  action text not null check (action in ('create', 'update', 'conflict', 'skip', 'error')),
  matched_by text null,
  confidence text not null default 'low' check (confidence in ('high', 'medium', 'low')),
  student_id text null references public.students(id) on delete set null,
  class_id text null references public.classes(id) on delete set null,
  incoming jsonb not null,
  patch jsonb null,
  conflicts jsonb null,
  flags text[] null default '{}'::text[],
  error_message text null,
  created_at timestamptz not null default now()
);

create index if not exists student_import_logs_run_idx
  on public.student_import_logs (run_id, row_number);

create index if not exists student_import_logs_action_idx
  on public.student_import_logs (action, created_at desc);

alter table public.student_import_runs enable row level security;
alter table public.student_import_logs enable row level security;

drop policy if exists "student_import_runs_select_admin" on public.student_import_runs;
create policy "student_import_runs_select_admin"
  on public.student_import_runs
  for select
  using (public.is_org_admin(organization_id));

drop policy if exists "student_import_logs_select_admin" on public.student_import_logs;
create policy "student_import_logs_select_admin"
  on public.student_import_logs
  for select
  using (
    exists (
      select 1
      from public.student_import_runs r
      where r.id = student_import_logs.run_id
        and public.is_org_admin(r.organization_id)
    )
  );

revoke all on table public.student_import_runs from anon, authenticated, public;
revoke all on table public.student_import_logs from anon, authenticated, public;
grant select on table public.student_import_runs to authenticated;
grant select on table public.student_import_logs to authenticated;
