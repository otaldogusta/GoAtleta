alter table if exists public.students
  add column if not exists login_email text;

update public.students
set login_email = lower(login_email)
where login_email is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_login_email_lowercase'
  ) then
    alter table public.students
      add constraint students_login_email_lowercase
      check (login_email is null or login_email = lower(login_email));
  end if;
end $$;

create unique index if not exists students_login_email_unique
  on public.students (login_email);
