alter table public.students
  add column if not exists college_course text null;

create index if not exists students_org_college_course_idx
  on public.students (organization_id, college_course)
  where college_course is not null and btrim(college_course) <> '';
