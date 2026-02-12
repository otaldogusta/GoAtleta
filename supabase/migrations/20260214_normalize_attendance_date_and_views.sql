-- PR7 follow-up: normalize attendance_logs.date semantics and remove textual date comparisons

do $$
declare
  v_data_type text;
  v_invalid_count bigint;
begin
  select c.data_type
    into v_data_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'attendance_logs'
    and c.column_name = 'date';

  if v_data_type is null then
    raise exception 'Column public.attendance_logs.date not found';
  end if;

  if v_data_type in ('character varying', 'text') then
    select count(*)
      into v_invalid_count
    from public.attendance_logs al
    where al.date is not null
      and left(al.date::text, 10) !~ '^\d{4}-\d{2}-\d{2}$';

    if v_invalid_count > 0 then
      raise exception
        'Cannot normalize attendance_logs.date: % rows have invalid format',
        v_invalid_count;
    end if;

    execute $sql$
      alter table public.attendance_logs
      alter column date type date
      using left(date::text, 10)::date
    $sql$;
  elsif v_data_type like 'timestamp%' then
    execute $sql$
      alter table public.attendance_logs
      alter column date type date
      using date::date
    $sql$;
  elsif v_data_type = 'date' then
    null;
  else
    raise exception
      'Unsupported type for attendance_logs.date: %',
      v_data_type;
  end if;
end $$;

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
      and al.date::date = current_date
  );

create or replace view public.v_admin_recent_activity as
with attendance_actions as (
  select
    al.organization_id,
    al.classid as class_id,
    c.name as class_name,
    c.unit,
    'attendance'::text as kind,
    max(coalesce(al.updated_at, al.createdat::timestamptz)) as occurred_at,
    coalesce(max(al.updated_by), max(al.created_by), c.owner_id) as actor_user_id,
    count(*)::int as affected_rows,
    to_char(al.date::date, 'YYYY-MM-DD') as reference_date
  from public.attendance_logs al
  join public.classes c
    on c.id = al.classid
   and c.organization_id = al.organization_id
  where al.date::date >= current_date - 7
  group by
    al.organization_id,
    al.classid,
    c.name,
    c.unit,
    c.owner_id,
    al.date::date
),
session_actions as (
  select
    sl.organization_id,
    sl.classid as class_id,
    c.name as class_name,
    c.unit,
    'session_log'::text as kind,
    max(coalesce(sl.updated_at, sl.createdat::timestamptz)) as occurred_at,
    coalesce(max(sl.updated_by), max(sl.created_by), c.owner_id) as actor_user_id,
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
