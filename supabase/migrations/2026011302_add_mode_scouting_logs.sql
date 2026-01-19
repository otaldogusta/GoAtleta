alter table if exists public.scouting_logs
add column if not exists mode text not null default 'treino';
