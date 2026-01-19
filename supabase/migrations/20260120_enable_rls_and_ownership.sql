-- Ownership columns
alter table if exists public.units
  add column if not exists owner_id uuid references auth.users(id);
alter table if exists public.units
  alter column owner_id set default auth.uid();

alter table if exists public.classes
  add column if not exists owner_id uuid references auth.users(id);
alter table if exists public.classes
  alter column owner_id set default auth.uid();

alter table if exists public.students
  add column if not exists owner_id uuid references auth.users(id);
alter table if exists public.students
  alter column owner_id set default auth.uid();
alter table if exists public.students
  add column if not exists student_user_id uuid references auth.users(id);

alter table if exists public.training_plans
  add column if not exists owner_id uuid references auth.users(id);
alter table if exists public.training_plans
  alter column owner_id set default auth.uid();

alter table if exists public.training_templates
  add column if not exists owner_id uuid references auth.users(id);
alter table if exists public.training_templates
  alter column owner_id set default auth.uid();

alter table if exists public.training_template_hides
  add column if not exists owner_id uuid references auth.users(id);
alter table if exists public.training_template_hides
  alter column owner_id set default auth.uid();

alter table if exists public.class_plans
  add column if not exists owner_id uuid references auth.users(id);
alter table if exists public.class_plans
  alter column owner_id set default auth.uid();

alter table if exists public.session_logs
  add column if not exists owner_id uuid references auth.users(id);
alter table if exists public.session_logs
  alter column owner_id set default auth.uid();

alter table if exists public.attendance_logs
  add column if not exists owner_id uuid references auth.users(id);
alter table if exists public.attendance_logs
  alter column owner_id set default auth.uid();

alter table if exists public.exercises
  add column if not exists owner_id uuid references auth.users(id);
alter table if exists public.exercises
  alter column owner_id set default auth.uid();

alter table if exists public.scouting_logs
  add column if not exists owner_id uuid references auth.users(id);
alter table if exists public.scouting_logs
  alter column owner_id set default auth.uid();

-- Trainer registry
create table if not exists public.trainers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.trainers enable row level security;

drop policy if exists "trainers read own" on public.trainers;
create policy "trainers read own" on public.trainers
  for select
  using (user_id = auth.uid());

create or replace function public.is_trainer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.trainers t
    where t.user_id = auth.uid()
  );
$$;

-- RLS policies
alter table public.units enable row level security;

drop policy if exists "units select trainer" on public.units;
create policy "units select trainer" on public.units
  for select
  using (is_trainer() and owner_id = auth.uid());

drop policy if exists "units insert trainer" on public.units;
create policy "units insert trainer" on public.units
  for insert
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "units update trainer" on public.units;
create policy "units update trainer" on public.units
  for update
  using (is_trainer() and owner_id = auth.uid())
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "units delete trainer" on public.units;
create policy "units delete trainer" on public.units
  for delete
  using (is_trainer() and owner_id = auth.uid());

alter table public.classes enable row level security;

drop policy if exists "classes select trainer" on public.classes;
create policy "classes select trainer" on public.classes
  for select
  using (is_trainer() and owner_id = auth.uid());

drop policy if exists "classes select student" on public.classes;
create policy "classes select student" on public.classes
  for select
  using (
    exists (
      select 1
      from public.students s
      where s.student_user_id = auth.uid()
        and s.classid = classes.id
    )
  );

drop policy if exists "classes insert trainer" on public.classes;
create policy "classes insert trainer" on public.classes
  for insert
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "classes update trainer" on public.classes;
create policy "classes update trainer" on public.classes
  for update
  using (is_trainer() and owner_id = auth.uid())
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "classes delete trainer" on public.classes;
create policy "classes delete trainer" on public.classes
  for delete
  using (is_trainer() and owner_id = auth.uid());

alter table public.students enable row level security;

drop policy if exists "students select trainer" on public.students;
create policy "students select trainer" on public.students
  for select
  using (is_trainer() and owner_id = auth.uid());

drop policy if exists "students select self" on public.students;
create policy "students select self" on public.students
  for select
  using (student_user_id = auth.uid());

drop policy if exists "students insert trainer" on public.students;
create policy "students insert trainer" on public.students
  for insert
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "students update trainer" on public.students;
create policy "students update trainer" on public.students
  for update
  using (is_trainer() and owner_id = auth.uid())
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "students delete trainer" on public.students;
create policy "students delete trainer" on public.students
  for delete
  using (is_trainer() and owner_id = auth.uid());

alter table public.training_plans enable row level security;

drop policy if exists "training_plans select trainer" on public.training_plans;
create policy "training_plans select trainer" on public.training_plans
  for select
  using (is_trainer() and owner_id = auth.uid());

drop policy if exists "training_plans select student" on public.training_plans;
create policy "training_plans select student" on public.training_plans
  for select
  using (
    exists (
      select 1
      from public.students s
      where s.student_user_id = auth.uid()
        and s.classid = training_plans.classid
    )
  );

drop policy if exists "training_plans insert trainer" on public.training_plans;
create policy "training_plans insert trainer" on public.training_plans
  for insert
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "training_plans update trainer" on public.training_plans;
create policy "training_plans update trainer" on public.training_plans
  for update
  using (is_trainer() and owner_id = auth.uid())
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "training_plans delete trainer" on public.training_plans;
create policy "training_plans delete trainer" on public.training_plans
  for delete
  using (is_trainer() and owner_id = auth.uid());

alter table public.class_plans enable row level security;

drop policy if exists "class_plans select trainer" on public.class_plans;
create policy "class_plans select trainer" on public.class_plans
  for select
  using (is_trainer() and owner_id = auth.uid());

drop policy if exists "class_plans select student" on public.class_plans;
create policy "class_plans select student" on public.class_plans
  for select
  using (
    exists (
      select 1
      from public.students s
      where s.student_user_id = auth.uid()
        and s.classid = class_plans.classid
    )
  );

drop policy if exists "class_plans insert trainer" on public.class_plans;
create policy "class_plans insert trainer" on public.class_plans
  for insert
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "class_plans update trainer" on public.class_plans;
create policy "class_plans update trainer" on public.class_plans
  for update
  using (is_trainer() and owner_id = auth.uid())
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "class_plans delete trainer" on public.class_plans;
create policy "class_plans delete trainer" on public.class_plans
  for delete
  using (is_trainer() and owner_id = auth.uid());

alter table public.session_logs enable row level security;

drop policy if exists "session_logs select trainer" on public.session_logs;
create policy "session_logs select trainer" on public.session_logs
  for select
  using (is_trainer() and owner_id = auth.uid());

drop policy if exists "session_logs select student" on public.session_logs;
create policy "session_logs select student" on public.session_logs
  for select
  using (
    exists (
      select 1
      from public.students s
      where s.student_user_id = auth.uid()
        and s.classid = session_logs.classid
    )
  );

drop policy if exists "session_logs insert trainer" on public.session_logs;
create policy "session_logs insert trainer" on public.session_logs
  for insert
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "session_logs update trainer" on public.session_logs;
create policy "session_logs update trainer" on public.session_logs
  for update
  using (is_trainer() and owner_id = auth.uid())
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "session_logs delete trainer" on public.session_logs;
create policy "session_logs delete trainer" on public.session_logs
  for delete
  using (is_trainer() and owner_id = auth.uid());

alter table public.scouting_logs enable row level security;

drop policy if exists "scouting_logs select trainer" on public.scouting_logs;
create policy "scouting_logs select trainer" on public.scouting_logs
  for select
  using (is_trainer() and owner_id = auth.uid());

drop policy if exists "scouting_logs select student" on public.scouting_logs;
create policy "scouting_logs select student" on public.scouting_logs
  for select
  using (
    exists (
      select 1
      from public.students s
      where s.student_user_id = auth.uid()
        and s.classid = scouting_logs.classid
    )
  );

drop policy if exists "scouting_logs insert trainer" on public.scouting_logs;
create policy "scouting_logs insert trainer" on public.scouting_logs
  for insert
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "scouting_logs update trainer" on public.scouting_logs;
create policy "scouting_logs update trainer" on public.scouting_logs
  for update
  using (is_trainer() and owner_id = auth.uid())
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "scouting_logs delete trainer" on public.scouting_logs;
create policy "scouting_logs delete trainer" on public.scouting_logs
  for delete
  using (is_trainer() and owner_id = auth.uid());

alter table public.attendance_logs enable row level security;

drop policy if exists "attendance_logs select trainer" on public.attendance_logs;
create policy "attendance_logs select trainer" on public.attendance_logs
  for select
  using (is_trainer() and owner_id = auth.uid());

drop policy if exists "attendance_logs select student" on public.attendance_logs;
create policy "attendance_logs select student" on public.attendance_logs
  for select
  using (
    exists (
      select 1
      from public.students s
      where s.student_user_id = auth.uid()
        and s.id = attendance_logs.studentid
    )
  );

drop policy if exists "attendance_logs insert trainer" on public.attendance_logs;
create policy "attendance_logs insert trainer" on public.attendance_logs
  for insert
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "attendance_logs update trainer" on public.attendance_logs;
create policy "attendance_logs update trainer" on public.attendance_logs
  for update
  using (is_trainer() and owner_id = auth.uid())
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "attendance_logs delete trainer" on public.attendance_logs;
create policy "attendance_logs delete trainer" on public.attendance_logs
  for delete
  using (is_trainer() and owner_id = auth.uid());

alter table public.training_templates enable row level security;

drop policy if exists "training_templates select trainer" on public.training_templates;
create policy "training_templates select trainer" on public.training_templates
  for select
  using (is_trainer() and owner_id = auth.uid());

drop policy if exists "training_templates insert trainer" on public.training_templates;
create policy "training_templates insert trainer" on public.training_templates
  for insert
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "training_templates update trainer" on public.training_templates;
create policy "training_templates update trainer" on public.training_templates
  for update
  using (is_trainer() and owner_id = auth.uid())
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "training_templates delete trainer" on public.training_templates;
create policy "training_templates delete trainer" on public.training_templates
  for delete
  using (is_trainer() and owner_id = auth.uid());

alter table public.training_template_hides enable row level security;

drop policy if exists "training_template_hides select trainer" on public.training_template_hides;
create policy "training_template_hides select trainer" on public.training_template_hides
  for select
  using (is_trainer() and owner_id = auth.uid());

drop policy if exists "training_template_hides insert trainer" on public.training_template_hides;
create policy "training_template_hides insert trainer" on public.training_template_hides
  for insert
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "training_template_hides delete trainer" on public.training_template_hides;
create policy "training_template_hides delete trainer" on public.training_template_hides
  for delete
  using (is_trainer() and owner_id = auth.uid());

alter table public.exercises enable row level security;

drop policy if exists "exercises select trainer" on public.exercises;
create policy "exercises select trainer" on public.exercises
  for select
  using (is_trainer() and owner_id = auth.uid());

drop policy if exists "exercises insert trainer" on public.exercises;
create policy "exercises insert trainer" on public.exercises
  for insert
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "exercises update trainer" on public.exercises;
create policy "exercises update trainer" on public.exercises
  for update
  using (is_trainer() and owner_id = auth.uid())
  with check (is_trainer() and owner_id = auth.uid());

drop policy if exists "exercises delete trainer" on public.exercises;
create policy "exercises delete trainer" on public.exercises
  for delete
  using (is_trainer() and owner_id = auth.uid());

-- Privileges: authenticated only
revoke all on table public.units from anon;
revoke all on table public.classes from anon;
revoke all on table public.students from anon;
revoke all on table public.training_plans from anon;
revoke all on table public.training_templates from anon;
revoke all on table public.training_template_hides from anon;
revoke all on table public.class_plans from anon;
revoke all on table public.session_logs from anon;
revoke all on table public.attendance_logs from anon;
revoke all on table public.exercises from anon;
revoke all on table public.scouting_logs from anon;

grant select, insert, update, delete on table public.units to authenticated;
grant select, insert, update, delete on table public.classes to authenticated;
grant select, insert, update, delete on table public.students to authenticated;
grant select, insert, update, delete on table public.training_plans to authenticated;
grant select, insert, update, delete on table public.training_templates to authenticated;
grant select, insert, update, delete on table public.training_template_hides to authenticated;
grant select, insert, update, delete on table public.class_plans to authenticated;
grant select, insert, update, delete on table public.session_logs to authenticated;
grant select, insert, update, delete on table public.attendance_logs to authenticated;
grant select, insert, update, delete on table public.exercises to authenticated;
grant select, insert, update, delete on table public.scouting_logs to authenticated;

grant select on table public.trainers to authenticated;
