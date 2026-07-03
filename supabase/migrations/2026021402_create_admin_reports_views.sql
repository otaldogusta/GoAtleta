-- PR7: Admin reports views (pending attendance, pending session logs, recent activity)

create or replace view public.v_admin_pending_attendance as
select
  c.organization_id,
  c.id as class_id,
  c.name as class_name,
  c.unit,
  current_date as target_date,
  (
    select count(*)
    from public.students s
    where s.classid = c.id
  )::int as student_count,
  false as has_attendance_today
from public.classes c
where public.is_org_admin(c.organization_id)
  and not exists (
    select 1
    from public.attendance_logs al
    where al.classid = c.id
      and al.date::text = to_char(current_date, 'YYYY-MM-DD')
  );

create or replace view public.v_admin_pending_session_logs as
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
    select count(*)
    from public.session_logs sl
    where sl.classid = c.id
      and sl.createdat::timestamptz >= now() - interval '7 days'
  ) = 0;

create or replace view public.v_admin_recent_activity as
with attendance_actions as (
  select
    al.organization_id,
    al.classid as class_id,
    c.name as class_name,
    c.unit,
    'attendance'::text as kind,
    max(coalesce(al.updated_at, al.createdat::timestamptz)) as occurred_at,
    coalesce(
      (
        array_agg(al.updated_by order by coalesce(al.updated_at, al.createdat::timestamptz) desc)
        filter (where al.updated_by is not null)
      )[1],
      (
        array_agg(al.created_by order by coalesce(al.updated_at, al.createdat::timestamptz) desc)
        filter (where al.created_by is not null)
      )[1],
      c.owner_id
    ) as actor_user_id,
    count(*)::int as affected_rows,
    al.date::text as reference_date
  from public.attendance_logs al
  join public.classes c
    on c.id = al.classid
   and c.organization_id = al.organization_id
  where al.date::text >= to_char(current_date - interval '7 days', 'YYYY-MM-DD')
  group by
    al.organization_id,
    al.classid,
    c.name,
    c.unit,
    c.owner_id,
    al.date::text
),
session_actions as (
  select
    sl.organization_id,
    sl.classid as class_id,
    c.name as class_name,
    c.unit,
    'session_log'::text as kind,
    max(coalesce(sl.updated_at, sl.createdat::timestamptz)) as occurred_at,
    coalesce(
      (
        array_agg(sl.updated_by order by coalesce(sl.updated_at, sl.createdat::timestamptz) desc)
        filter (where sl.updated_by is not null)
      )[1],
      (
        array_agg(sl.created_by order by coalesce(sl.updated_at, sl.createdat::timestamptz) desc)
        filter (where sl.created_by is not null)
      )[1],
      c.owner_id
    ) as actor_user_id,
    count(*)::int as affected_rows,
    null::text as reference_date
  from public.session_logs sl
  join public.classes c
    on c.id = sl.classid
   and c.organization_id = sl.organization_id
  where sl.createdat::timestamptz >= now() - interval '7 days'
  group by
    sl.organization_id,
    sl.classid,
    c.name,
    c.unit,
    c.owner_id,
    date_trunc('day', sl.createdat::timestamptz)
)
select
  x.organization_id,
  x.kind,
  x.class_id,
  x.class_name,
  x.unit,
  x.occurred_at,
  x.actor_user_id,
  x.affected_rows,
  x.reference_date
from (
  select * from attendance_actions
  union all
  select * from session_actions
) x
where public.is_org_admin(x.organization_id);

grant select on public.v_admin_pending_attendance to authenticated;
grant select on public.v_admin_pending_session_logs to authenticated;
grant select on public.v_admin_recent_activity to authenticated;
