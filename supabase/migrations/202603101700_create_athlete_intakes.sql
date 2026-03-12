create table if not exists public.athlete_intakes (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text null references public.classes(id) on delete set null,
  student_id text null references public.students(id) on delete set null,
  full_name text not null,
  ra text null,
  sex text null check (sex in ('masculino', 'feminino', 'outro')),
  birth_date date null,
  email text null,
  modalities text[] not null default '{}',
  parq_positive boolean not null default false,
  cardio_risk boolean not null default false,
  ortho_risk boolean not null default false,
  current_injury boolean not null default false,
  smoker boolean not null default false,
  allergies boolean not null default false,
  major_surgery boolean not null default false,
  family_history_risk boolean not null default false,
  dizziness_or_syncope boolean not null default false,
  needs_medical_clearance boolean not null default false,
  needs_individual_attention boolean not null default false,
  jump_restriction text not null default 'nenhuma' check (jump_restriction in ('nenhuma', 'avaliar')),
  risk_status text not null default 'apto' check (risk_status in ('apto', 'atencao', 'revisar')),
  tags text[] not null default '{}',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists athlete_intakes_org_class_idx
  on public.athlete_intakes (organization_id, class_id, updated_at desc);

create index if not exists athlete_intakes_org_student_idx
  on public.athlete_intakes (organization_id, student_id, updated_at desc)
  where student_id is not null;

create index if not exists athlete_intakes_org_ra_idx
  on public.athlete_intakes (organization_id, ra)
  where ra is not null and btrim(ra) <> '';

create index if not exists athlete_intakes_org_email_idx
  on public.athlete_intakes (organization_id, lower(email))
  where email is not null and btrim(email) <> '';

alter table public.athlete_intakes enable row level security;

drop policy if exists "athlete_intakes select trainer" on public.athlete_intakes;
create policy "athlete_intakes select trainer"
  on public.athlete_intakes
  for select
  using (
    public.is_org_admin(athlete_intakes.organization_id)
    or (
      athlete_intakes.class_id is not null
      and public.is_class_staff(athlete_intakes.class_id)
    )
  );

drop policy if exists "athlete_intakes insert trainer" on public.athlete_intakes;
create policy "athlete_intakes insert trainer"
  on public.athlete_intakes
  for insert
  with check (
    public.is_org_admin(athlete_intakes.organization_id)
    or (
      athlete_intakes.class_id is not null
      and public.is_class_staff(athlete_intakes.class_id)
    )
  );

drop policy if exists "athlete_intakes update trainer" on public.athlete_intakes;
create policy "athlete_intakes update trainer"
  on public.athlete_intakes
  for update
  using (
    public.is_org_admin(athlete_intakes.organization_id)
    or (
      athlete_intakes.class_id is not null
      and public.is_class_staff(athlete_intakes.class_id)
    )
  )
  with check (
    public.is_org_admin(athlete_intakes.organization_id)
    or (
      athlete_intakes.class_id is not null
      and public.is_class_staff(athlete_intakes.class_id)
    )
  );

drop policy if exists "athlete_intakes delete trainer" on public.athlete_intakes;
create policy "athlete_intakes delete trainer"
  on public.athlete_intakes
  for delete
  using (public.is_org_admin(athlete_intakes.organization_id));

revoke all on table public.athlete_intakes from anon;
grant select, insert, update, delete on table public.athlete_intakes to authenticated;
