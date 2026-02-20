-- Fix: only mark pending session logs for classes that had at least one scheduled day in the last 7 days.

create or replace view public.v_admin_pending_session_logs as
with window_days as (
  select
    gs::date as day_date,
    extract(isodow from gs)::int as weekday_id
  from generate_series(current_date - interval '6 days', current_date, interval '1 day') gs
)
select
  c.organization_id,
  c.id as class_id,
  c.name as class_name,
  c.unit,
  (now() - interval '7 days') as period_start,
  (
    select count(*)
    from public.session_logs sl
    where sl.classid = c.id
      and sl.createdat::timestamptz >= now() - interval '7 days'
  )::int as reports_last_7d,
  (
    select max(sl.createdat::timestamptz)
    from public.session_logs sl
    where sl.classid = c.id
  ) as last_report_at
from public.classes c
where public.is_org_admin(c.organization_id)
  and (
    case
      when coalesce(array_length(c.days, 1), 0) > 0 then exists (
        select 1
        from window_days wd
        where wd.weekday_id = any(c.days)
      )
      else coalesce(c.daysperweek, 0) > 0
    end
  )
  and (
    select count(*)
    from public.session_logs sl
    where sl.classid = c.id
      and sl.createdat::timestamptz >= now() - interval '7 days'
  ) = 0;
