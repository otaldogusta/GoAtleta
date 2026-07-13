create table if not exists public.health_data_access_logs (
  id uuid primary key default gen_random_uuid(),
  student_id text references public.students(id) on delete cascade not null,
  accessed_by uuid references auth.users(id) on delete set null,
  accessed_at timestamptz not null default now(),
  reason text not null,
  source text not null,
  ip_address text,
  metadata jsonb
);

alter table public.health_data_access_logs enable row level security;

-- Only admins/org staff can view these logs if needed for audit, but usually only backend.
-- We will allow org members with level >= 30 (moderators/admins) to view logs for their org's students.
create policy "Staff can view health access logs"
on public.health_data_access_logs
for select
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    join public.classes c on c.organization_id = om.organization_id
    join public.student_class_enrollments sce on sce.class_id = c.id
    where sce.student_id = health_data_access_logs.student_id
      and om.user_id = auth.uid()
      and om.role_level >= 30
  )
);

-- Users can insert access logs via RPC to enforce consistency and prevent tampering
create policy "Insert strictly via security definer RPC"
on public.health_data_access_logs
for insert
to authenticated
with check (false);

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
  -- Validate that the user has legitimate access to the student (e.g. is staff or guardian)
  if not exists (
    select 1 from students s
    where s.id = p_student_id
    and (
      s.owner_id = auth.uid()
      or s.student_user_id = auth.uid()
      or exists (
        select 1 from class_staff cs
        join student_class_enrollments sce on sce.class_id = cs.class_id
        where sce.student_id = s.id and cs.trainer_id = auth.uid()
      )
      or exists (
        select 1 from organization_members om
        join classes c on c.organization_id = om.organization_id
        join student_class_enrollments sce on sce.class_id = c.id
        where sce.student_id = s.id and om.user_id = auth.uid() and om.role_level >= 10
      )
    )
  ) then
    raise exception 'Unauthorized to access health data for student %', p_student_id;
  end if;

  insert into public.health_data_access_logs (
    student_id, accessed_by, reason, source, ip_address, metadata
  ) values (
    p_student_id, auth.uid(), p_reason, p_source, p_ip_address, p_metadata
  );
end;
$$;

revoke all on function public.log_health_data_access(text, text, text, text, jsonb) from public;
grant execute on function public.log_health_data_access(text, text, text, text, jsonb) to authenticated;
