create table if not exists public.scouting_sessions (
  id text primary key,
  class_id text not null,
  date date not null,
  type text not null,
  title text not null,
  opponent text null,
  location text null,
  video_url text null,
  status text not null,
  source text null,
  related_event_id text null,
  created_at timestamptz not null,
  updated_at timestamptz null,
  constraint scouting_sessions_type_check
    check (type in ('training', 'friendly', 'official_match')),
  constraint scouting_sessions_status_check
    check (status in ('draft', 'in_progress', 'completed', 'archived')),
  constraint scouting_sessions_source_check
    check (source is null or source in ('manual', 'session', 'event'))
);

create index if not exists scouting_sessions_class_id_idx
  on public.scouting_sessions(class_id);

create index if not exists scouting_sessions_date_idx
  on public.scouting_sessions(date);

create index if not exists scouting_sessions_status_idx
  on public.scouting_sessions(status);

create index if not exists scouting_sessions_type_idx
  on public.scouting_sessions(type);

alter table public.scouting_sessions enable row level security;

drop policy if exists "scouting_sessions authenticated select" on public.scouting_sessions;
create policy "scouting_sessions authenticated select" on public.scouting_sessions
  for select
  to authenticated
  using (true);

drop policy if exists "scouting_sessions authenticated insert" on public.scouting_sessions;
create policy "scouting_sessions authenticated insert" on public.scouting_sessions
  for insert
  to authenticated
  with check (true);

drop policy if exists "scouting_sessions authenticated update" on public.scouting_sessions;
create policy "scouting_sessions authenticated update" on public.scouting_sessions
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "scouting_sessions authenticated delete" on public.scouting_sessions;
create policy "scouting_sessions authenticated delete" on public.scouting_sessions
  for delete
  to authenticated
  using (true);
