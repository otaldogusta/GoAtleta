alter table if exists public.session_logs
add column if not exists client_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'session_logs_client_id_key'
  ) then
    alter table public.session_logs
    add constraint session_logs_client_id_key unique (client_id);
  end if;
end $$;
