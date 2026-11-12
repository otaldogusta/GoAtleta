-- Apply only the students edited offline, using the same lock and permissions
-- as a regular attendance save. A replay is safe after a lost response.
create function public.apply_attendance_draft(
  p_org_id uuid, p_class_id text, p_date date, p_edits jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or p_org_id is null or p_date is null or not exists (
    select 1 from public.classes c
    where c.id = p_class_id and c.organization_id = p_org_id
      and (public.is_org_admin(p_org_id) or public.is_class_staff(c.id))
  ) then
    raise exception 'Attendance access denied' using errcode = '42501';
  end if;

  if p_edits is null or jsonb_typeof(p_edits) <> 'array' then
    raise exception 'Invalid attendance edits' using errcode = '22023';
  end if;
  if jsonb_array_length(p_edits) not between 1 and 1000 or exists (
    select 1 from jsonb_array_elements(p_edits) e
    where nullif(btrim(e->>'studentId'), '') is null
      or not (e ? 'before' and e ? 'after')
      or exists (
        select 1 from (values (e->'before'), (e->'after')) as state(value)
        where value <> 'null'::jsonb and (
          jsonb_typeof(value) <> 'object'
          or coalesce(value->>'status', '') not in ('presente', 'faltou')
          or jsonb_typeof(value->'note') is distinct from 'string'
          or jsonb_typeof(value->'painScore') is distinct from 'number'
        )
      )
  ) or (select count(distinct e->>'studentId') from jsonb_array_elements(p_edits) e)
       <> jsonb_array_length(p_edits) then
    raise exception 'Invalid attendance edits' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'attendance:' || p_org_id::text || ':' || p_class_id || ':' || p_date::text, 0
  ));

  if exists (
    select a.studentid from public.attendance_logs a
    join jsonb_array_elements(p_edits) e on e->>'studentId' = a.studentid
    where a.organization_id = p_org_id and a.classid = p_class_id and a.date = p_date
    group by a.studentid having count(*) > 1
  ) then
    raise exception 'Attendance edit has duplicate existing records' using errcode = 'PT409';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_edits) e
    left join public.attendance_logs a on a.studentid = e->>'studentId'
      and a.organization_id = p_org_id and a.classid = p_class_id and a.date = p_date
    cross join lateral (values (case when a.id is null then 'null'::jsonb
      else jsonb_build_object('status', a.status, 'note', coalesce(a.note, ''),
        'painScore', coalesce(a.pain_score, 0)) end)) as current_state(value)
    where current_state.value <> e->'before' and current_state.value <> e->'after'
  ) then
    raise exception 'ATTENDANCE_DRAFT_CONFLICT' using errcode = 'PT409';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_edits) e where e->'after' <> 'null'::jsonb
      and not exists (
        select 1 from public.students s where s.id = e->>'studentId' and s.organization_id = p_org_id
          and (s.classid = p_class_id or exists (
            select 1 from public.student_class_enrollments m
            where m.student_id = s.id and m.organization_id = p_org_id
              and m.class_id = p_class_id and m.status = 'active'
          ))
      )
  ) then
    raise exception 'Attendance student scope changed' using errcode = 'PT409';
  end if;

  delete from public.attendance_logs a using jsonb_array_elements(p_edits) e
  where a.organization_id = p_org_id and a.classid = p_class_id and a.date = p_date
    and a.studentid = e->>'studentId' and e->'after' = 'null'::jsonb;

  insert into public.attendance_logs as target
    (id, organization_id, classid, date, studentid, status, note, pain_score, createdat)
  select coalesce(a.id, p_class_id || '_' || (e->>'studentId') || '_' || p_date::text),
    p_org_id, p_class_id, p_date, e->>'studentId', e->'after'->>'status', e->'after'->>'note',
    (e->'after'->>'painScore')::integer, coalesce(a.createdat, now())
  from jsonb_array_elements(p_edits) e
  left join public.attendance_logs a on a.studentid = e->>'studentId'
    and a.organization_id = p_org_id and a.classid = p_class_id and a.date = p_date
  where e->'after' <> 'null'::jsonb and (a.id is null or
    jsonb_build_object('status', a.status, 'note', coalesce(a.note, ''),
      'painScore', coalesce(a.pain_score, 0)) <> e->'after')
  on conflict (id) do update set status = excluded.status, note = excluded.note, pain_score = excluded.pain_score
  where target.organization_id = p_org_id and target.classid = p_class_id
    and target.date = p_date and target.studentid = excluded.studentid;

  if exists (
    select 1 from jsonb_array_elements(p_edits) e
    left join public.attendance_logs a on a.studentid = e->>'studentId'
      and a.organization_id = p_org_id and a.classid = p_class_id and a.date = p_date
    where (case when a.id is null then 'null'::jsonb
      else jsonb_build_object('status', a.status, 'note', coalesce(a.note, ''),
        'painScore', coalesce(a.pain_score, 0)) end) <> e->'after'
  ) then
    raise exception 'Attendance edit was not authorized in full' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.apply_attendance_draft(uuid, text, date, jsonb) from public, anon, authenticated;
grant execute on function public.apply_attendance_draft(uuid, text, date, jsonb) to authenticated;
