create table if not exists public.class_calendar_exceptions (
  id text primary key,
  class_id text not null references public.classes(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  date date not null,
  reason text null,
  kind text not null default 'no_training'
    check (kind in ('no_training')),
  created_at timestamptz not null default now()
);

create unique index if not exists class_calendar_exceptions_unique_day
  on public.class_calendar_exceptions (class_id, date, kind);

create index if not exists class_calendar_exceptions_org_date_idx
  on public.class_calendar_exceptions (organization_id, date);

alter table public.class_calendar_exceptions enable row level security;

drop policy if exists "class_calendar_exceptions select trainer" on public.class_calendar_exceptions;
create policy "class_calendar_exceptions select trainer"
  on public.class_calendar_exceptions
  for select
  using (
    public.is_org_admin(class_calendar_exceptions.organization_id)
    or public.is_class_staff(class_calendar_exceptions.class_id)
  );

drop policy if exists "class_calendar_exceptions insert trainer" on public.class_calendar_exceptions;
create policy "class_calendar_exceptions insert trainer"
  on public.class_calendar_exceptions
  for insert
  with check (
    public.is_org_admin(class_calendar_exceptions.organization_id)
    or public.is_class_staff(class_calendar_exceptions.class_id)
  );

drop policy if exists "class_calendar_exceptions update trainer" on public.class_calendar_exceptions;
create policy "class_calendar_exceptions update trainer"
  on public.class_calendar_exceptions
  for update
  using (
    public.is_org_admin(class_calendar_exceptions.organization_id)
    or public.is_class_staff(class_calendar_exceptions.class_id)
  )
  with check (
    public.is_org_admin(class_calendar_exceptions.organization_id)
    or public.is_class_staff(class_calendar_exceptions.class_id)
  );

drop policy if exists "class_calendar_exceptions delete trainer" on public.class_calendar_exceptions;
create policy "class_calendar_exceptions delete trainer"
  on public.class_calendar_exceptions
  for delete
  using (public.is_org_admin(class_calendar_exceptions.organization_id));

revoke all on table public.class_calendar_exceptions from anon;
grant select, insert, update, delete on table public.class_calendar_exceptions to authenticated;
