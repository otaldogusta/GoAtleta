create table if not exists public.technical_visuals (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null,
  source_kind text not null default 'free' check (
    source_kind in ('rotation', 'lesson', 'scouting', 'free')
  ),
  source_id text,
  title text not null default '',
  payload_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists technical_visuals_org_class_updated_idx
  on public.technical_visuals (organization_id, class_id, updated_at desc);

create index if not exists technical_visuals_org_class_source_idx
  on public.technical_visuals (organization_id, class_id, source_kind, source_id);

alter table public.technical_visuals enable row level security;

drop policy if exists "technical_visuals select staff" on public.technical_visuals;
create policy "technical_visuals select staff" on public.technical_visuals
  for select
  using (
    public.is_org_admin(technical_visuals.organization_id)
    or public.is_class_staff(technical_visuals.class_id)
  );

drop policy if exists "technical_visuals insert staff" on public.technical_visuals;
create policy "technical_visuals insert staff" on public.technical_visuals
  for insert
  with check (
    public.is_org_admin(technical_visuals.organization_id)
    or public.is_class_staff(technical_visuals.class_id)
  );

drop policy if exists "technical_visuals update staff" on public.technical_visuals;
create policy "technical_visuals update staff" on public.technical_visuals
  for update
  using (
    public.is_org_admin(technical_visuals.organization_id)
    or public.is_class_staff(technical_visuals.class_id)
  )
  with check (
    public.is_org_admin(technical_visuals.organization_id)
    or public.is_class_staff(technical_visuals.class_id)
  );

drop policy if exists "technical_visuals delete admin" on public.technical_visuals;
create policy "technical_visuals delete admin" on public.technical_visuals
  for delete
  using (public.is_org_admin(technical_visuals.organization_id));

revoke all on table public.technical_visuals from anon;
grant select, insert, update, delete on table public.technical_visuals to authenticated;
