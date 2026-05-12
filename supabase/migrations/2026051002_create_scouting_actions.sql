create table if not exists public.scouting_actions (
  id text primary key,
  scouting_session_id text not null references public.scouting_sessions(id) on delete cascade,
  class_id text not null,
  athlete_id text null,
  athlete_name text null,
  skill text not null,
  action_type text not null,
  quality text not null,
  score int null,
  label text null,
  game_phase text null,
  pressure_level text null,
  rotation text null,
  zone text null,
  video_timestamp_sec int null,
  notes text null,
  source text not null,
  created_at timestamptz not null,
  constraint scouting_actions_quality_check
    check (quality in ('error', 'low', 'medium', 'high', 'excellent')),
  constraint scouting_actions_source_check
    check (source in ('coach', 'athlete_self', 'assistant', 'import')),
  constraint scouting_actions_score_check
    check (score is null or (score >= 0 and score <= 3))
);

create index if not exists scouting_actions_scouting_session_id_idx
  on public.scouting_actions(scouting_session_id);

create index if not exists scouting_actions_class_id_idx
  on public.scouting_actions(class_id);

create index if not exists scouting_actions_athlete_id_idx
  on public.scouting_actions(athlete_id);

create index if not exists scouting_actions_skill_idx
  on public.scouting_actions(skill);

create index if not exists scouting_actions_created_at_idx
  on public.scouting_actions(created_at);

alter table public.scouting_actions enable row level security;

drop policy if exists "scouting_actions authenticated select" on public.scouting_actions;
create policy "scouting_actions authenticated select" on public.scouting_actions
  for select
  to authenticated
  using (true);

drop policy if exists "scouting_actions authenticated insert" on public.scouting_actions;
create policy "scouting_actions authenticated insert" on public.scouting_actions
  for insert
  to authenticated
  with check (true);

drop policy if exists "scouting_actions authenticated update" on public.scouting_actions;
create policy "scouting_actions authenticated update" on public.scouting_actions
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "scouting_actions authenticated delete" on public.scouting_actions;
create policy "scouting_actions authenticated delete" on public.scouting_actions
  for delete
  to authenticated
  using (true);
