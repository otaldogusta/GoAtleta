-- Correção do BOLA nas tabelas de Consultoria e Vazamento de Push Deliveries

-- ==============================================================================
-- 1. SECURITY DEFINER HELPERS
-- ==============================================================================

-- A. owns_student
create or replace function public.owns_student(p_student_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists(
    select 1
    from public.students
    where id = p_student_id
      and student_user_id = auth.uid()
  );
$$;

revoke all on function public.owns_student(text) from public;
grant execute on function public.owns_student(text) to authenticated;

-- B. owns_workout
create or replace function public.owns_workout(p_workout_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists(
    select 1
    from public.prescribed_workouts pw
    join public.students s on pw.student_id = s.id
    where pw.id = p_workout_id
      and s.student_user_id = auth.uid()
  );
$$;

revoke all on function public.owns_workout(text) from public;
grant execute on function public.owns_workout(text) to authenticated;

-- C. owns_execution_log
create or replace function public.owns_execution_log(p_log_id text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
  select exists(
    select 1
    from public.workout_execution_logs wel
    join public.students s on wel.student_id = s.id
    where wel.id = p_log_id
      and s.student_user_id = auth.uid()
  );
$$;

revoke all on function public.owns_execution_log(text) from public;
grant execute on function public.owns_execution_log(text) to authenticated;


-- ==============================================================================
-- 2. ÍNDICES DE PERFORMANCE (se ainda não existirem)
-- ==============================================================================
create index if not exists prescribed_workouts_student_idx on public.prescribed_workouts (student_id);
create index if not exists prescribed_exercises_workout_idx on public.prescribed_exercises (workout_id);
create index if not exists workout_execution_logs_student_idx on public.workout_execution_logs (student_id);
create index if not exists completed_exercise_logs_execution_idx on public.completed_exercise_logs (execution_log_id);


-- ==============================================================================
-- 3. CONSULTATION PROFILES
-- ==============================================================================
drop policy if exists "consultation_profiles org members select" on public.consultation_profiles;
create policy "consultation_profiles select policy" on public.consultation_profiles
  for select to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
    or public.owns_student(student_id)
  );

drop policy if exists "consultation_profiles org members insert" on public.consultation_profiles;
create policy "consultation_profiles insert policy" on public.consultation_profiles
  for insert to authenticated
  with check (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
  );

drop policy if exists "consultation_profiles org members update" on public.consultation_profiles;
create policy "consultation_profiles update policy" on public.consultation_profiles
  for update to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
    or public.owns_student(student_id)
  )
  with check (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
    or public.owns_student(student_id)
  );

drop policy if exists "consultation_profiles org admins delete" on public.consultation_profiles;
create policy "consultation_profiles delete policy" on public.consultation_profiles
  for delete to authenticated
  using (public.is_org_admin(organization_id));


-- ==============================================================================
-- 4. PRESCRIBED WORKOUTS
-- ==============================================================================
drop policy if exists "prescribed_workouts org members select" on public.prescribed_workouts;
create policy "prescribed_workouts select policy" on public.prescribed_workouts
  for select to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
    or (
      public.owns_student(student_id)
      and status in ('published', 'completed', 'archived')
    )
  );

drop policy if exists "prescribed_workouts org members insert" on public.prescribed_workouts;
create policy "prescribed_workouts insert policy" on public.prescribed_workouts
  for insert to authenticated
  with check (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
  );

drop policy if exists "prescribed_workouts org members update" on public.prescribed_workouts;
create policy "prescribed_workouts update policy" on public.prescribed_workouts
  for update to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
  )
  with check (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
  );

drop policy if exists "prescribed_workouts org members delete" on public.prescribed_workouts;
create policy "prescribed_workouts delete policy" on public.prescribed_workouts
  for delete to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
  );


-- ==============================================================================
-- 5. PRESCRIBED EXERCISES
-- ==============================================================================
drop policy if exists "prescribed_exercises org members select" on public.prescribed_exercises;
create policy "prescribed_exercises select policy" on public.prescribed_exercises
  for select to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
    or (
      public.owns_workout(workout_id)
      and exists (
        select 1 from public.prescribed_workouts pw
        where pw.id = prescribed_exercises.workout_id
          and pw.status in ('published', 'completed', 'archived')
      )
    )
  );

drop policy if exists "prescribed_exercises org members insert" on public.prescribed_exercises;
create policy "prescribed_exercises insert policy" on public.prescribed_exercises
  for insert to authenticated
  with check (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
  );

drop policy if exists "prescribed_exercises org members update" on public.prescribed_exercises;
create policy "prescribed_exercises update policy" on public.prescribed_exercises
  for update to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
  )
  with check (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
  );

drop policy if exists "prescribed_exercises org members delete" on public.prescribed_exercises;
create policy "prescribed_exercises delete policy" on public.prescribed_exercises
  for delete to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
  );


-- ==============================================================================
-- 6. WORKOUT EXECUTION LOGS
-- ==============================================================================
drop policy if exists "workout_execution_logs org members select" on public.workout_execution_logs;
create policy "workout_execution_logs select policy" on public.workout_execution_logs
  for select to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
    or public.owns_student(student_id)
  );

drop policy if exists "workout_execution_logs org members insert" on public.workout_execution_logs;
create policy "workout_execution_logs insert policy" on public.workout_execution_logs
  for insert to authenticated
  with check (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
    or public.owns_student(student_id)
  );

drop policy if exists "workout_execution_logs org members update" on public.workout_execution_logs;
create policy "workout_execution_logs update policy" on public.workout_execution_logs
  for update to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
    or public.owns_student(student_id)
  )
  with check (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
    or public.owns_student(student_id)
  );

-- Delete is fully restricted for athletes.
drop policy if exists "workout_execution_logs org members delete" on public.workout_execution_logs;
create policy "workout_execution_logs delete policy" on public.workout_execution_logs
  for delete to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
  );


-- ==============================================================================
-- 7. COMPLETED EXERCISE LOGS
-- ==============================================================================
drop policy if exists "completed_exercise_logs org members select" on public.completed_exercise_logs;
create policy "completed_exercise_logs select policy" on public.completed_exercise_logs
  for select to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
    or public.owns_execution_log(execution_log_id)
  );

drop policy if exists "completed_exercise_logs org members insert" on public.completed_exercise_logs;
create policy "completed_exercise_logs insert policy" on public.completed_exercise_logs
  for insert to authenticated
  with check (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
    or public.owns_execution_log(execution_log_id)
  );

drop policy if exists "completed_exercise_logs org members update" on public.completed_exercise_logs;
create policy "completed_exercise_logs update policy" on public.completed_exercise_logs
  for update to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
    or public.owns_execution_log(execution_log_id)
  )
  with check (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
    or public.owns_execution_log(execution_log_id)
  );

drop policy if exists "completed_exercise_logs org members delete" on public.completed_exercise_logs;
create policy "completed_exercise_logs delete policy" on public.completed_exercise_logs
  for delete to authenticated
  using (
    public.is_org_admin(organization_id)
    or (public.is_trainer() and public.is_org_member(organization_id))
  );


-- ==============================================================================
-- 8. PUSH DELIVERIES
-- ==============================================================================
drop policy if exists "push_deliveries_select_member" on public.push_deliveries;
create policy "push_deliveries_select_scoped" on public.push_deliveries
  for select to authenticated
  using (
    auth.uid() = to_user_id
    or auth.uid() = from_user_id
  );

-- Create Administrative View
-- Security_invoker = false means it runs as definer (postgres).
-- It will read all rows from push_deliveries, but we filter them so the caller 
-- only sees rows for the org they administrate.

drop view if exists public.admin_push_deliveries_view;
create view public.admin_push_deliveries_view
  with (security_invoker = false)
as
  select id, organization_id, to_user_id, from_user_id, status, provider_response, created_at
  from public.push_deliveries
  where public.is_org_admin(organization_id);

revoke all on public.admin_push_deliveries_view from public;
grant select on public.admin_push_deliveries_view to authenticated;
