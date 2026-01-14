alter table if exists public.scouting_logs
add column if not exists client_id text;

create unique index if not exists scouting_logs_client_id_idx
on public.scouting_logs (client_id)
where client_id is not null;
