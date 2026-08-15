alter table if exists public.students
  add column if not exists inactivated_by uuid references auth.users(id) on delete set null,
  add column if not exists inactivation_reason text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'students_inactivation_reason_length_check'
  ) then
    alter table public.students
      add constraint students_inactivation_reason_length_check
      check (inactivation_reason is null or char_length(inactivation_reason) <= 240);
  end if;
end
$$;

comment on column public.students.inactivated_by is
  'Authenticated user who last inactivated the athlete. Operational audit only.';

comment on column public.students.inactivation_reason is
  'Optional operational reason for the latest inactivation. Athlete history remains preserved.';
