-- This DTO serves the organization-admin home suggestion only. Its attendance
-- evidence covers enrolled classes and the preceding 28 calendar dates; classes
-- without enrollment cannot affect that suggestion. Historical rows stay intact.
-- Keep SECURITY INVOKER and all table RLS. Test existence per class/day instead
-- of loading and authorizing every athlete attendance record in the window.
create or replace function public.get_activity_review_context_v1(
  p_organization_id uuid,
  p_today date
) returns jsonb
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare
  context jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_organization_id is null or p_today is null then
    raise exception 'Missing activity review scope' using errcode = '22023';
  end if;
  if not coalesce(public.is_org_admin(p_organization_id), false) then
    raise exception 'Activity review admin access required' using errcode = '42501';
  end if;

  with enrolled as materialized (
    select distinct student.classid
    from public.students student
    where student.organization_id = p_organization_id
      and student.classid is not null
  ), days as (
    select p_today - 28 + value as date
    from generate_series(0, 27) as day_offset(value)
  ), attendance_days as (
    select enrolled.classid, days.date
    from enrolled cross join days
    -- EXISTS can be decorrelated into a full-table semi-join. Keep LIMIT in a
    -- lateral lookup so each class/date stops at the first RLS-visible record.
    cross join lateral (
      select 1 as found
      from public.attendance_logs attendance
      where attendance.organization_id = p_organization_id
        and attendance.classid = enrolled.classid
        and attendance.date = days.date
      limit 1
    ) evidence
  )
  select jsonb_build_object(
    'enrolledClassIds', coalesce((
      select jsonb_agg(classid order by classid) from enrolled
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('classid', classid, 'date', date) order by date, classid)
      from attendance_days
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object('class_ids', review.class_ids, 'start_date', review.start_date, 'end_date', review.end_date) order by review.end_date, review.id)
      from public.organization_activity_reviews review
      where review.organization_id = p_organization_id
        and review.end_date >= p_today - 28
    ), '[]'::jsonb)
  ) into context;
  return context;
end;
$$;
revoke all on function public.get_activity_review_context_v1(uuid, date) from public, anon;
grant execute on function public.get_activity_review_context_v1(uuid, date) to authenticated;
