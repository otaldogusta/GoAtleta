create or replace function public.prune_expired_assistant_memories(max_rows integer default 5000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_count integer := 0;
begin
  with doomed as (
    select id
    from public.assistant_memory_entries
    where expires_at <= now()
    order by expires_at asc
    limit greatest(coalesce(max_rows, 5000), 1)
  )
  delete from public.assistant_memory_entries mem
  using doomed
  where mem.id = doomed.id;

  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

revoke all on function public.prune_expired_assistant_memories(integer) from public;
revoke all on function public.prune_expired_assistant_memories(integer) from anon;
revoke all on function public.prune_expired_assistant_memories(integer) from authenticated;
grant execute on function public.prune_expired_assistant_memories(integer) to service_role;
grant execute on function public.prune_expired_assistant_memories(integer) to postgres;

comment on function public.prune_expired_assistant_memories(integer)
is 'Remove assistant_memory_entries expiradas em lotes para retenção contínua.';

do $$
declare
  existing_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute 'select jobid from cron.job where jobname = ''assistant_memory_purge_hourly'' limit 1'
      into existing_job_id;

    if existing_job_id is not null then
      execute format('select cron.unschedule(%s)', existing_job_id);
    end if;

    execute $job$
      select cron.schedule(
        'assistant_memory_purge_hourly',
        '15 * * * *',
        'select public.prune_expired_assistant_memories(5000);'
      )
    $job$;
  end if;
end $$;
