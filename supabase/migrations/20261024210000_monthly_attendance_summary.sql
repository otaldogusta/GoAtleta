-- Monthly indicators need counts, while the detailed XLSX remains an on-demand
-- read. A scalar JSON object avoids PostgREST row caps on class/day groups.
-- SECURITY INVOKER preserves every existing attendance SELECT/RLS branch,
-- including permitted historical orphan rows; no extra class/student join.
create function public.get_monthly_attendance_summary_v1(
  p_organization_id uuid,
  p_start date,
  p_end date
) returns jsonb
language plpgsql stable security invoker
set search_path = ''
as $$
begin
  if p_organization_id is null or p_start is null or p_end is null
     or not pg_catalog.isfinite(p_start) or not pg_catalog.isfinite(p_end)
     or p_start <> pg_catalog.date_trunc('month', p_start)::date
     or p_end <> (p_start + interval '1 month')::date then
    raise exception 'A complete calendar month and organization are required' using errcode = '22023';
  end if;
  return (
    select pg_catalog.jsonb_build_object('days', coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('classId', day.classid, 'date', day.date, 'total', day.total, 'present', day.present)
      order by day.date, day.classid
    ), '[]'::jsonb))
    from (
      select attendance.classid, attendance.date, count(*) as total,
        -- The existing reader maps every status except "faltou" to "presente".
        count(*) filter (where attendance.status is distinct from 'faltou') as present
      from public.attendance_logs attendance
      where attendance.organization_id = p_organization_id
        and attendance.date >= p_start and attendance.date < p_end
      group by attendance.classid, attendance.date
    ) day
  );
end;
$$;
revoke all on function public.get_monthly_attendance_summary_v1(uuid, date, date) from public, anon;
grant execute on function public.get_monthly_attendance_summary_v1(uuid, date, date) to authenticated;
