-- Schema-only snapshot from the authorized preflight on 2026-10-07.
-- No identities or application records. Exercises pre-existing compatibility columns/triggers.
create table public.scouting_sessions (id text not null,
class_id text,
date date not null,
type text default 'treino'::text not null,
title text default ''::text not null,
opponent text,
location text,
video_url text,
status text default 'em_andamento'::text not null,
source text,
related_event_id text,
created_at timestamptz default now(),
updated_at timestamptz,
source_type text,
video_clip_type text,
video_notes text,
organization_id uuid not null,
classid text not null,
initial_note text,
createdat timestamptz default now() not null,
updatedat timestamptz default now() not null,
completed_at timestamptz, primary key(id));
create table public.scouting_actions (id text not null,
scouting_session_id text,
class_id text,
athlete_id text,
athlete_name text,
skill text,
action_type text,
quality text,
score integer,
label text,
game_phase text,
pressure_level text,
rotation text,
zone text,
video_timestamp_sec integer,
notes text,
source text default 'coach'::text not null,
created_at timestamptz default now() not null,
video_timestamp_ms integer,
video_label text,
clip_reference text,
rally_id text,
rally_number integer,
sequence_index integer,
rally_outcome text,
setter_position text,
game_system text,
court_zone text,
transition_type text,
organization_id uuid not null,
set_number integer,
team_score integer,
opponent_score integer,
score_moment text,
updated_at timestamptz,
session_id text not null,
classid text not null,
student_id text,
fundamental text not null,
phase text not null,
result_key text not null,
result_label text not null,
result_level integer not null,
createdat timestamptz default now() not null, primary key(id));
alter table scouting_sessions add constraint scouting_sessions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table scouting_sessions add constraint scouting_sessions_source_check CHECK (((source IS NULL) OR (source = ANY (ARRAY['manual'::text, 'session'::text, 'event'::text]))));
alter table scouting_sessions add constraint scouting_sessions_source_type_check CHECK (((source_type IS NULL) OR (source_type = ANY (ARRAY['live_training'::text, 'live_match'::text, 'video'::text, 'manual'::text]))));
alter table scouting_sessions add constraint scouting_sessions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_progress'::text, 'completed'::text, 'archived'::text, 'em_andamento'::text, 'concluido'::text])));
alter table scouting_sessions add constraint scouting_sessions_type_check CHECK ((type = ANY (ARRAY['training'::text, 'friendly'::text, 'official_match'::text, 'treino'::text, 'amistoso'::text, 'jogo'::text])));
alter table scouting_actions add constraint scouting_actions_court_zone_check CHECK (((court_zone IS NULL) OR (court_zone = ANY (ARRAY['1'::text, '2'::text, '3'::text, '4'::text, '5'::text, '6'::text, 'unknown'::text]))));
alter table scouting_actions add constraint scouting_actions_fundamental_check CHECK (((fundamental IS NULL) OR (fundamental = ANY (ARRAY['saque'::text, 'recepcao'::text, 'levantamento'::text, 'ataque'::text, 'bloqueio'::text, 'defesa'::text, 'cobertura'::text, 'transicao'::text, 'comunicacao'::text]))));
alter table scouting_actions add constraint scouting_actions_game_system_check CHECK (((game_system IS NULL) OR (game_system = ANY (ARRAY['6x0'::text, '4x2'::text, '5x1'::text, 'other'::text, 'unknown'::text]))));
alter table scouting_actions add constraint scouting_actions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table scouting_actions add constraint scouting_actions_phase_check CHECK (((phase IS NULL) OR (phase = ANY (ARRAY['saque'::text, 'side_out'::text, 'transicao'::text, 'pressao'::text, 'freeball'::text]))));
alter table scouting_actions add constraint scouting_actions_quality_check CHECK ((quality = ANY (ARRAY['error'::text, 'low'::text, 'medium'::text, 'high'::text, 'excellent'::text])));
alter table scouting_actions add constraint scouting_actions_rally_outcome_check CHECK (((rally_outcome IS NULL) OR (rally_outcome = ANY (ARRAY['point_for'::text, 'point_against'::text, 'replay'::text, 'unknown'::text]))));
alter table scouting_actions add constraint scouting_actions_result_level_check CHECK (((result_level IS NULL) OR ((result_level >= 0) AND (result_level <= 3))));
alter table scouting_actions add constraint scouting_actions_score_check CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 3))));
alter table scouting_actions add constraint scouting_actions_score_moment_check CHECK (((score_moment IS NULL) OR (score_moment = ANY (ARRAY['early_set'::text, 'mid_set'::text, 'end_set'::text, 'deuce'::text, 'unknown'::text]))));
alter table scouting_actions add constraint scouting_actions_scouting_session_id_fkey FOREIGN KEY (scouting_session_id) REFERENCES scouting_sessions(id) ON DELETE CASCADE;
alter table scouting_actions add constraint scouting_actions_session_id_fkey FOREIGN KEY (session_id) REFERENCES scouting_sessions(id) ON DELETE CASCADE;
alter table scouting_actions add constraint scouting_actions_setter_position_check CHECK (((setter_position IS NULL) OR (setter_position = ANY (ARRAY['1'::text, '2'::text, '3'::text, '4'::text, '5'::text, '6'::text, 'unknown'::text]))));
alter table scouting_actions add constraint scouting_actions_source_check CHECK ((source = ANY (ARRAY['coach'::text, 'athlete_self'::text, 'assistant'::text, 'import'::text])));
alter table scouting_actions add constraint scouting_actions_transition_type_check CHECK (((transition_type IS NULL) OR (transition_type = ANY (ARRAY['serve_receive'::text, 'defense_transition'::text, 'free_ball'::text, 'counterattack'::text, 'unknown'::text]))));
CREATE OR REPLACE FUNCTION public.sync_scouting_session_compat_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.classid := coalesce(new.classid, new.class_id);
  new.class_id := coalesce(new.class_id, new.classid);
  if new.organization_id is null and new.classid is not null then
    select c.organization_id into new.organization_id
    from public.classes c
    where c.id = new.classid
    limit 1;
  end if;
  new.title := coalesce(new.title, '');
  new.createdat := coalesce(new.createdat, new.created_at, now());
  new.created_at := coalesce(new.created_at, new.createdat, now());
  new.updatedat := coalesce(new.updatedat, new.updated_at, new.createdat, now());
  new.updated_at := coalesce(new.updated_at, new.updatedat, now());
  if new.status = 'completed' then
    new.status := 'concluido';
  elsif new.status in ('draft', 'in_progress') then
    new.status := 'em_andamento';
  end if;
  if new.type = 'training' then
    new.type := 'treino';
  elsif new.type = 'friendly' then
    new.type := 'amistoso';
  elsif new.type = 'official_match' then
    new.type := 'jogo';
  end if;
  if new.status = 'concluido' and new.completed_at is null then
    new.completed_at := coalesce(new.updatedat, now());
  end if;
  return new;
end;
$function$;

CREATE TRIGGER scouting_sessions_sync_compat BEFORE INSERT OR UPDATE ON public.scouting_sessions FOR EACH ROW EXECUTE FUNCTION sync_scouting_session_compat_columns();
CREATE OR REPLACE FUNCTION public.sync_scouting_action_compat_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.session_id := coalesce(new.session_id, new.scouting_session_id);
  new.scouting_session_id := coalesce(new.scouting_session_id, new.session_id);
  new.classid := coalesce(new.classid, new.class_id);
  new.class_id := coalesce(new.class_id, new.classid);
  new.student_id := coalesce(new.student_id, new.athlete_id);
  new.athlete_id := coalesce(new.athlete_id, new.student_id);
  new.fundamental := coalesce(new.fundamental, new.skill);
  new.skill := coalesce(new.skill, new.fundamental);
  new.phase := coalesce(new.phase, new.game_phase, 'side_out');
  new.game_phase := coalesce(new.game_phase, new.phase);
  new.result_key := coalesce(new.result_key, new.quality);
  new.result_level := coalesce(new.result_level, new.score, 0);
  new.quality := coalesce(
    case
      when new.quality in ('error', 'low', 'medium', 'high', 'excellent') then new.quality
      when new.result_level <= 0 then 'error'
      when new.result_level = 1 then 'low'
      when new.result_level = 2 then 'high'
      else 'excellent'
    end,
    'medium'
  );
  new.result_label := coalesce(new.result_label, new.label, initcap(new.result_key), initcap(new.quality));
  new.label := coalesce(new.label, new.result_label);
  new.score := coalesce(new.score, new.result_level);
  new.source := coalesce(new.source, 'coach');
  new.createdat := coalesce(new.createdat, new.created_at, now());
  new.created_at := coalesce(new.created_at, new.createdat, now());
  if new.organization_id is null and new.session_id is not null then
    select ss.organization_id into new.organization_id
    from public.scouting_sessions ss
    where ss.id = new.session_id
    limit 1;
  end if;
  return new;
end;
$function$;

CREATE TRIGGER scouting_actions_sync_compat BEFORE INSERT OR UPDATE ON public.scouting_actions FOR EACH ROW EXECUTE FUNCTION sync_scouting_action_compat_columns();
