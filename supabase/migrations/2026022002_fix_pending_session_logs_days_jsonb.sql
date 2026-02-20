-- Fix: classes.days is jsonb in production; use jsonb-safe checks in pending session logs view.

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
      when jsonb_typeof(c.days) = 'array' and coalesce(jsonb_array_length(c.days), 0) > 0 then exists (
        select 1
        from window_days wd
        where exists (
          select 1
          from jsonb_array_elements_text(c.days) as d(value)
          where d.value ~ '^[0-9]+$'
            and d.value::int = wd.weekday_id
        )
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
