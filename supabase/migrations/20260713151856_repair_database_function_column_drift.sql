-- Keep the reproducible local schema aligned with the live, non-destructive
-- class_plans contract used by document reconciliation.
alter table public.class_plans
  add column if not exists ruleset text not null default '',
  add column if not exists updated_at timestamptz default now();

create or replace function public.log_health_data_access(
  p_student_id text,
  p_reason text,
  p_source text,
  p_ip_address text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and (
        s.owner_id = auth.uid()
        or s.student_user_id = auth.uid()
        or exists (
          select 1
          from public.class_staff cs
          join public.student_class_enrollments sce
            on sce.class_id = cs.class_id
           and sce.organization_id = cs.organization_id
          where sce.student_id = s.id
            and sce.organization_id = s.organization_id
            and sce.status = 'active'
            and cs.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.organization_members om
          join public.classes c
            on c.organization_id = om.organization_id
          join public.student_class_enrollments sce
            on sce.class_id = c.id
           and sce.organization_id = c.organization_id
          where sce.student_id = s.id
            and sce.organization_id = s.organization_id
            and sce.status = 'active'
            and om.user_id = auth.uid()
            and om.role_level >= 10
        )
      )
  ) then
    raise exception 'Unauthorized to access health data for student %', p_student_id;
  end if;

  insert into public.health_data_access_logs (
    student_id,
    accessed_by,
    reason,
    source,
    ip_address,
    metadata
  ) values (
    p_student_id,
    auth.uid(),
    p_reason,
    p_source,
    p_ip_address,
    p_metadata
  );
end;
$$;

revoke all on function public.log_health_data_access(text, text, text, text, jsonb)
  from public, anon;
grant execute on function public.log_health_data_access(text, text, text, text, jsonb)
  to authenticated, service_role;
