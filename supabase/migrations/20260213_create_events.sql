-- PR6: Events / Tournaments (organization-aware)

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null default '',
  event_type text not null check (event_type in ('torneio', 'amistoso', 'treino', 'reuniao', 'outro')),
  sport text not null check (sport in ('geral', 'volei_quadra', 'volei_praia', 'futebol')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  unit_id text,
  location_label text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.event_classes (
  event_id uuid not null references public.events(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, class_id)
);

create index if not exists events_org_starts_at on public.events(organization_id, starts_at);
create index if not exists events_org_type_sport_starts_at on public.events(organization_id, event_type, sport, starts_at);
create index if not exists event_classes_org_class_id on public.event_classes(organization_id, class_id);
create index if not exists event_classes_event_id on public.event_classes(event_id);

create or replace function public.set_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row
execute function public.set_events_updated_at();

alter table public.events enable row level security;
alter table public.event_classes enable row level security;

drop policy if exists "events select org member" on public.events;
create policy "events select org member" on public.events
  for select
  using (public.is_org_member(events.organization_id));

drop policy if exists "events insert org admin" on public.events;
create policy "events insert org admin" on public.events
  for insert
  with check (
    public.is_org_admin(events.organization_id)
    and created_by = auth.uid()
  );

drop policy if exists "events update org admin" on public.events;
create policy "events update org admin" on public.events
  for update
  using (public.is_org_admin(events.organization_id))
  with check (public.is_org_admin(events.organization_id));

drop policy if exists "events delete org admin" on public.events;
create policy "events delete org admin" on public.events
  for delete
  using (public.is_org_admin(events.organization_id));

drop policy if exists "event_classes select org member" on public.event_classes;
create policy "event_classes select org member" on public.event_classes
  for select
  using (public.is_org_member(event_classes.organization_id));

drop policy if exists "event_classes insert org admin" on public.event_classes;
create policy "event_classes insert org admin" on public.event_classes
  for insert
  with check (
    public.is_org_admin(event_classes.organization_id)
    and exists (
      select 1
      from public.events e
      where e.id = event_classes.event_id
        and e.organization_id = event_classes.organization_id
    )
    and exists (
      select 1
      from public.classes c
      where c.id = event_classes.class_id
        and c.organization_id = event_classes.organization_id
    )
  );

drop policy if exists "event_classes update org admin" on public.event_classes;
create policy "event_classes update org admin" on public.event_classes
  for update
  using (public.is_org_admin(event_classes.organization_id))
  with check (
    public.is_org_admin(event_classes.organization_id)
    and exists (
      select 1
      from public.events e
      where e.id = event_classes.event_id
        and e.organization_id = event_classes.organization_id
    )
    and exists (
      select 1
      from public.classes c
      where c.id = event_classes.class_id
        and c.organization_id = event_classes.organization_id
    )
  );

drop policy if exists "event_classes delete org admin" on public.event_classes;
create policy "event_classes delete org admin" on public.event_classes
  for delete
  using (public.is_org_admin(event_classes.organization_id));

revoke all on table public.events from anon;
revoke all on table public.event_classes from anon;
grant select, insert, update, delete on table public.events to authenticated;
grant select, insert, update, delete on table public.event_classes to authenticated;
