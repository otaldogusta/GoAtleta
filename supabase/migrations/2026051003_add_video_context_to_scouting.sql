alter table public.scouting_sessions
  add column if not exists source_type text null,
  add column if not exists video_clip_type text null,
  add column if not exists video_notes text null;

alter table public.scouting_sessions
  drop constraint if exists scouting_sessions_source_type_check;

alter table public.scouting_sessions
  add constraint scouting_sessions_source_type_check
    check (
      source_type is null
      or source_type in ('live_training', 'live_match', 'video', 'manual')
    );

create index if not exists scouting_sessions_source_type_idx
  on public.scouting_sessions(source_type);

alter table public.scouting_actions
  add column if not exists video_timestamp_ms int null,
  add column if not exists video_label text null,
  add column if not exists clip_reference text null;

create index if not exists scouting_actions_clip_reference_idx
  on public.scouting_actions(clip_reference);
