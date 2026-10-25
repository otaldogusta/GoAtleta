-- Cache only the caller's existing permission scopes once per SELECT instead
-- of repeating the same class/admin helpers for every attendance record.
-- No table grants, write policies, RLS flags, indexes or records change.
-- Refuse unknown/modified SELECT policies rather than dropping authorization.
do $migration$
declare
  original_predicate text := $predicate$((EXISTS ( SELECT 1
    FROM students s
    WHERE ((s.id = attendance_logs.studentid) AND (s.student_user_id = ( SELECT auth.uid() AS uid))))) OR (is_org_admin(organization_id) OR is_class_staff(classid)))$predicate$;
begin
  if (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'attendance_logs'
        and cmd in ('SELECT', 'ALL')) <> 2
    or not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'attendance_logs'
        and policyname = 'authenticated_4992c9cc37_select'
        and cmd = 'SELECT' and permissive = 'PERMISSIVE'
        and roles = array['authenticated']::name[]
        and regexp_replace(qual, '\s+', '', 'g') = regexp_replace(original_predicate, '\s+', '', 'g')
    )
    or not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'attendance_logs'
        and policyname = 'temporal_staff_read'
        and cmd = 'SELECT' and permissive = 'PERMISSIVE'
        and roles = array['authenticated']::name[]
        and qual = 'can_read_class(classid)'
    ) then
    raise exception 'Unexpected attendance SELECT policies; review authorization before migrating'
      using errcode = 'P0001';
  end if;
end
$migration$;

-- Private, no-argument, caller-bound lookups. Existing canonical helpers remain
-- the authority; no role thresholds or temporal assignment rules are duplicated.
-- organization_members supplies every candidate for is_org_admin, including
-- legacy orphan organization IDs. The original helper itself requires a member.
create function private.attendance_admin_organization_ids()
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select candidate.organization_id
  from (
    select distinct member.organization_id
    from public.organization_members member
    where member.user_id = (select auth.uid())
  ) candidate
  where (select auth.uid()) is not null
    and public.is_org_admin(candidate.organization_id);
$$;

create function private.attendance_readable_class_ids()
returns setof text
language sql stable security definer
set search_path = ''
as $$
  select class.id
  from public.classes class
  where (select auth.uid()) is not null
    and (public.can_read_class(class.id) or public.is_class_staff(class.id));
$$;

revoke all on function private.attendance_admin_organization_ids(),
  private.attendance_readable_class_ids() from public, anon;
grant execute on function private.attendance_admin_organization_ids(),
  private.attendance_readable_class_ids() to authenticated;

drop policy "authenticated_4992c9cc37_select" on public.attendance_logs;
drop policy temporal_staff_read on public.attendance_logs;
create policy "authenticated_4992c9cc37_select" on public.attendance_logs
for select to authenticated
using (
  -- Preserve the student branch and its students-table RLS exactly.
  exists (
    select 1 from public.students student
    where student.id = attendance_logs.studentid
      and student.student_user_id = (select auth.uid())
  )
  or attendance_logs.organization_id in (
    select private.attendance_admin_organization_ids()
  )
  or attendance_logs.classid in (
    select private.attendance_readable_class_ids()
  )
);
