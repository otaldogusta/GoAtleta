alter table if exists public.scouting_logs
add column if not exists client_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scouting_logs_client_id_key'
  ) then
    alter table public.scouting_logs
    add constraint scouting_logs_client_id_key unique (client_id);
  end if;
end $$;
