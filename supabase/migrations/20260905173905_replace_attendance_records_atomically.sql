-- Atomic replacement using the caller's existing RLS permissions. No elevated
-- privileges and no fallback to a client-side DELETE followed by INSERT.
create or replace function public.replace_attendance_records(
  p_org_id uuid,
  p_class_id text,
  p_date date,
  p_records jsonb
)
returns table(saved_count integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected integer;
  v_written integer;
begin
  if auth.uid() is null or p_org_id is null or p_date is null or nullif(btrim(p_class_id), '') is null then
    raise exception 'Attendance access denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.classes c
    where c.id = p_class_id and c.organization_id = p_org_id
      and (public.is_org_admin(p_org_id) or public.is_class_staff(c.id))
  ) then
    raise exception 'Attendance access denied' using errcode = '42501';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'Invalid attendance records' using errcode = '22023';
  end if;
  v_expected := jsonb_array_length(p_records);
  if exists (
    select 1 from jsonb_array_elements(p_records) r
    where jsonb_typeof(r) <> 'object'
      or nullif(btrim(r->>'id'), '') is null
      or nullif(btrim(r->>'studentid'), '') is null
      or (r->>'classid') is distinct from p_class_id
      or (r->>'organization_id') is distinct from p_org_id::text
      or (r->>'date') is distinct from p_date::text
      or coalesce(r->>'status', '') not in ('presente', 'faltou')
      or not exists (
        select 1 from public.students s
        where s.id = r->>'studentid' and s.organization_id = p_org_id
          and (s.classid = p_class_id or exists (
            select 1 from public.student_class_enrollments e
            where e.student_id = s.id and e.organization_id = p_org_id
              and e.class_id = p_class_id and e.status = 'active'
          ))
      )
  ) or (select count(distinct r->>'id') from jsonb_array_elements(p_records) r) <> v_expected
    or (select count(distinct r->>'studentid') from jsonb_array_elements(p_records) r) <> v_expected then
    raise exception 'Invalid attendance records or student scope' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'attendance:' || p_org_id::text || ':' || p_class_id || ':' || p_date::text, 0
  ));

  insert into public.attendance_logs as target
    (id, classid, studentid, date, status, note, organization_id, pain_score, createdat)
  select r.id, p_class_id, r.studentid, p_date, r.status, coalesce(r.note, ''),
    p_org_id, r.pain_score, coalesce(r.createdat, now())
  from jsonb_to_recordset(p_records) as r(
    id text, studentid text, status text, note text, pain_score integer, createdat timestamptz
  )
  on conflict (id) do update set
    studentid = excluded.studentid,
    status = excluded.status,
    note = excluded.note,
    pain_score = excluded.pain_score
  where target.organization_id = p_org_id and target.classid = p_class_id and target.date = p_date;
  get diagnostics v_written = row_count;
  if v_written <> v_expected then
    raise exception 'Attendance identifier belongs to another scope' using errcode = '42501';
  end if;

  delete from public.attendance_logs a
  where a.organization_id = p_org_id and a.classid = p_class_id and a.date = p_date
    and not exists (select 1 from jsonb_array_elements(p_records) r where r->>'id' = a.id);
  -- DELETE can silently affect zero rows under RLS. Never confirm a partial
  -- replacement; preserve the pre-call state if the caller cannot remove rows.
  if (select count(*) from public.attendance_logs a
      where a.organization_id = p_org_id and a.classid = p_class_id and a.date = p_date) <> v_expected then
    raise exception 'Attendance replacement was not authorized in full' using errcode = '42501';
  end if;
  return query select v_written;
end;
$$;

revoke all on function public.replace_attendance_records(uuid, text, date, jsonb) from public, anon, authenticated;
grant execute on function public.replace_attendance_records(uuid, text, date, jsonb) to authenticated;
