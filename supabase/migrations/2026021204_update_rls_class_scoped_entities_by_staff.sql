-- PR5: class-scoped entities RLS by class_staff

alter table public.students enable row level security;
drop policy if exists "students select trainer" on public.students;
create policy "students select trainer" on public.students
  for select
  using (
    public.is_org_admin(students.organization_id)
    or public.is_class_staff(students.classid)
  );
drop policy if exists "students insert trainer" on public.students;
create policy "students insert trainer" on public.students
  for insert
  with check (
    public.is_org_admin(students.organization_id)
    or public.is_class_staff(students.classid)
  );
drop policy if exists "students update trainer" on public.students;
create policy "students update trainer" on public.students
  for update
  using (
    public.is_org_admin(students.organization_id)
    or public.is_class_staff(students.classid)
  )
  with check (
    public.is_org_admin(students.organization_id)
    or public.is_class_staff(students.classid)
  );
drop policy if exists "students delete trainer" on public.students;
create policy "students delete trainer" on public.students
  for delete
  using (public.is_org_admin(students.organization_id));

alter table public.attendance_logs enable row level security;
drop policy if exists "attendance_logs select trainer" on public.attendance_logs;
create policy "attendance_logs select trainer" on public.attendance_logs
  for select
  using (
    public.is_org_admin(attendance_logs.organization_id)
    or public.is_class_staff(attendance_logs.classid)
  );
drop policy if exists "attendance_logs insert trainer" on public.attendance_logs;
create policy "attendance_logs insert trainer" on public.attendance_logs
  for insert
  with check (
    public.is_org_admin(attendance_logs.organization_id)
    or public.is_class_staff(attendance_logs.classid)
  );
drop policy if exists "attendance_logs update trainer" on public.attendance_logs;
create policy "attendance_logs update trainer" on public.attendance_logs
  for update
  using (
    public.is_org_admin(attendance_logs.organization_id)
    or public.is_class_staff(attendance_logs.classid)
  )
  with check (
    public.is_org_admin(attendance_logs.organization_id)
    or public.is_class_staff(attendance_logs.classid)
  );
drop policy if exists "attendance_logs delete trainer" on public.attendance_logs;
create policy "attendance_logs delete trainer" on public.attendance_logs
  for delete
  using (public.is_org_admin(attendance_logs.organization_id));

alter table public.session_logs enable row level security;
drop policy if exists "session_logs select trainer" on public.session_logs;
create policy "session_logs select trainer" on public.session_logs
  for select
  using (
    public.is_org_admin(session_logs.organization_id)
    or public.is_class_staff(session_logs.classid)
  );
drop policy if exists "session_logs insert trainer" on public.session_logs;
create policy "session_logs insert trainer" on public.session_logs
  for insert
  with check (
    public.is_org_admin(session_logs.organization_id)
    or public.is_class_staff(session_logs.classid)
  );
drop policy if exists "session_logs update trainer" on public.session_logs;
create policy "session_logs update trainer" on public.session_logs
  for update
  using (
    public.is_org_admin(session_logs.organization_id)
    or public.is_class_staff(session_logs.classid)
  )
  with check (
    public.is_org_admin(session_logs.organization_id)
    or public.is_class_staff(session_logs.classid)
  );
drop policy if exists "session_logs delete trainer" on public.session_logs;
create policy "session_logs delete trainer" on public.session_logs
  for delete
  using (public.is_org_admin(session_logs.organization_id));

alter table public.training_plans enable row level security;
drop policy if exists "training_plans select trainer" on public.training_plans;
create policy "training_plans select trainer" on public.training_plans
  for select
  using (
    public.is_org_admin(training_plans.organization_id)
    or public.is_class_staff(training_plans.classid)
  );
drop policy if exists "training_plans insert trainer" on public.training_plans;
create policy "training_plans insert trainer" on public.training_plans
  for insert
  with check (
    public.is_org_admin(training_plans.organization_id)
    or public.is_class_staff(training_plans.classid)
  );
drop policy if exists "training_plans update trainer" on public.training_plans;
create policy "training_plans update trainer" on public.training_plans
  for update
  using (
    public.is_org_admin(training_plans.organization_id)
    or public.is_class_staff(training_plans.classid)
  )
  with check (
    public.is_org_admin(training_plans.organization_id)
    or public.is_class_staff(training_plans.classid)
  );
drop policy if exists "training_plans delete trainer" on public.training_plans;
create policy "training_plans delete trainer" on public.training_plans
  for delete
  using (public.is_org_admin(training_plans.organization_id));

alter table public.class_plans enable row level security;
drop policy if exists "class_plans select trainer" on public.class_plans;
create policy "class_plans select trainer" on public.class_plans
  for select
  using (
    public.is_org_admin(class_plans.organization_id)
    or public.is_class_staff(class_plans.classid)
  );
drop policy if exists "class_plans insert trainer" on public.class_plans;
create policy "class_plans insert trainer" on public.class_plans
  for insert
  with check (
    public.is_org_admin(class_plans.organization_id)
    or public.is_class_staff(class_plans.classid)
  );
drop policy if exists "class_plans update trainer" on public.class_plans;
create policy "class_plans update trainer" on public.class_plans
  for update
  using (
    public.is_org_admin(class_plans.organization_id)
    or public.is_class_staff(class_plans.classid)
  )
  with check (
    public.is_org_admin(class_plans.organization_id)
    or public.is_class_staff(class_plans.classid)
  );
drop policy if exists "class_plans delete trainer" on public.class_plans;
create policy "class_plans delete trainer" on public.class_plans
  for delete
  using (public.is_org_admin(class_plans.organization_id));

alter table public.scouting_logs enable row level security;
drop policy if exists "scouting_logs select trainer" on public.scouting_logs;
create policy "scouting_logs select trainer" on public.scouting_logs
  for select
  using (
    public.is_org_admin(scouting_logs.organization_id)
    or public.is_class_staff(scouting_logs.classid)
  );
drop policy if exists "scouting_logs insert trainer" on public.scouting_logs;
create policy "scouting_logs insert trainer" on public.scouting_logs
  for insert
  with check (
    public.is_org_admin(scouting_logs.organization_id)
    or public.is_class_staff(scouting_logs.classid)
  );
drop policy if exists "scouting_logs update trainer" on public.scouting_logs;
create policy "scouting_logs update trainer" on public.scouting_logs
  for update
  using (
    public.is_org_admin(scouting_logs.organization_id)
    or public.is_class_staff(scouting_logs.classid)
  )
  with check (
    public.is_org_admin(scouting_logs.organization_id)
    or public.is_class_staff(scouting_logs.classid)
  );
drop policy if exists "scouting_logs delete trainer" on public.scouting_logs;
create policy "scouting_logs delete trainer" on public.scouting_logs
  for delete
  using (public.is_org_admin(scouting_logs.organization_id));

alter table public.absence_notices enable row level security;
drop policy if exists "absence_notices select trainer" on public.absence_notices;
create policy "absence_notices select trainer" on public.absence_notices
  for select
  using (
    public.is_org_admin(absence_notices.organization_id)
    or public.is_class_staff(absence_notices.class_id)
  );
drop policy if exists "absence_notices insert trainer" on public.absence_notices;
create policy "absence_notices insert trainer" on public.absence_notices
  for insert
  with check (
    public.is_org_admin(absence_notices.organization_id)
    or public.is_class_staff(absence_notices.class_id)
  );
drop policy if exists "absence_notices update trainer" on public.absence_notices;
create policy "absence_notices update trainer" on public.absence_notices
  for update
  using (
    public.is_org_admin(absence_notices.organization_id)
    or public.is_class_staff(absence_notices.class_id)
  )
  with check (
    public.is_org_admin(absence_notices.organization_id)
    or public.is_class_staff(absence_notices.class_id)
  );
drop policy if exists "absence_notices delete trainer" on public.absence_notices;
create policy "absence_notices delete trainer" on public.absence_notices
  for delete
  using (public.is_org_admin(absence_notices.organization_id));
