alter table public.notifications
  add column if not exists archived_at timestamptz null;

create index if not exists notifications_recipient_archive_created_idx
  on public.notifications (recipient_user_id, archived_at, created_at desc);

create index if not exists notifications_retention_created_idx
  on public.notifications (created_at);

grant update (archived_at) on table public.notifications to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.prune_expired_notifications(
  max_rows integer default 2000
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  removed_count integer := 0;
begin
  with doomed as (
    select notification.id
    from public.notifications as notification
    where notification.created_at < now() - interval '7 days'
    order by notification.created_at asc
    limit greatest(least(coalesce(max_rows, 2000), 10000), 1)
    for update skip locked
  )
  delete from public.notifications as notification
  using doomed
  where notification.id = doomed.id;

  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

revoke all on function private.prune_expired_notifications(integer)
  from public, anon, authenticated;

comment on function private.prune_expired_notifications(integer)
is 'Remove somente notificações com mais de 7 dias, em lotes limitados.';

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'notifications_retention_daily',
  '20 6 * * *',
  'select private.prune_expired_notifications(2000);'
);
