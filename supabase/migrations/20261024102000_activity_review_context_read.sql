-- Read only the class/day evidence needed by the home suggestion. Raw athlete
-- attendance rows, notes and health fields never leave this projection.
-- SECURITY INVOKER keeps every underlying table's existing RLS in force.
create or replace function public.get_activity_review_context_v1(
  p_organization_id uuid,
  p_today date
) returns jsonb
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_organization_id is null or p_today is null then
    raise exception 'Missing activity review scope' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'enrolledClassIds', coalesce((
      select jsonb_agg(e.classid order by e.classid)
      from (select distinct s.classid from public.students s
        where s.organization_id = p_organization_id and s.classid is not null) e
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('classid', a.classid, 'date', a.date) order by a.date, a.classid)
      from (select distinct l.classid, l.date from public.attendance_logs l
        where l.organization_id = p_organization_id
          and l.date >= p_today - 28 and l.date < p_today) a
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(jsonb_build_object('class_ids', r.class_ids, 'start_date', r.start_date, 'end_date', r.end_date) order by r.end_date, r.id)
      from public.organization_activity_reviews r
      where r.organization_id = p_organization_id and r.end_date >= p_today - 28
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_activity_review_context_v1(uuid, date) from public, anon;
grant execute on function public.get_activity_review_context_v1(uuid, date) to authenticated;
