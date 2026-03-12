create table if not exists public.class_competitive_profiles (
  class_id text primary key references public.classes(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  planning_mode text not null default 'adulto-competitivo'
    check (planning_mode in ('adulto-competitivo')),
  cycle_start_date date null,
  target_competition text null,
  target_date date null,
  tactical_system text null,
  current_phase text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists class_competitive_profiles_org_idx
  on public.class_competitive_profiles (organization_id);

create index if not exists class_competitive_profiles_target_date_idx
  on public.class_competitive_profiles (organization_id, target_date);

alter table public.class_competitive_profiles enable row level security;

drop policy if exists "class_competitive_profiles select trainer" on public.class_competitive_profiles;
create policy "class_competitive_profiles select trainer"
  on public.class_competitive_profiles
  for select
  using (
    public.is_org_admin(class_competitive_profiles.organization_id)
    or public.is_class_staff(class_competitive_profiles.class_id)
  );

drop policy if exists "class_competitive_profiles insert trainer" on public.class_competitive_profiles;
create policy "class_competitive_profiles insert trainer"
  on public.class_competitive_profiles
  for insert
  with check (
    public.is_org_admin(class_competitive_profiles.organization_id)
    or public.is_class_staff(class_competitive_profiles.class_id)
  );

drop policy if exists "class_competitive_profiles update trainer" on public.class_competitive_profiles;
create policy "class_competitive_profiles update trainer"
  on public.class_competitive_profiles
  for update
  using (
    public.is_org_admin(class_competitive_profiles.organization_id)
    or public.is_class_staff(class_competitive_profiles.class_id)
  )
  with check (
    public.is_org_admin(class_competitive_profiles.organization_id)
    or public.is_class_staff(class_competitive_profiles.class_id)
  );

drop policy if exists "class_competitive_profiles delete trainer" on public.class_competitive_profiles;
create policy "class_competitive_profiles delete trainer"
  on public.class_competitive_profiles
  for delete
  using (public.is_org_admin(class_competitive_profiles.organization_id));

revoke all on table public.class_competitive_profiles from anon;
grant select, insert, update, delete on table public.class_competitive_profiles to authenticated;
