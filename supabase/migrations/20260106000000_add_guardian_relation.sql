alter table if exists public.students
add column if not exists guardian_relation text;
