-- PR7: Add audit fields for admin dashboard activity feed

-- attendance_logs audit columns
alter table public.attendance_logs
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz;

-- session_logs audit columns
alter table public.session_logs
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz;

create or replace function public.set_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
    new.updated_by := auth.uid();
    new.updated_at := now();
  elsif tg_op = 'UPDATE' then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_logs_audit on public.attendance_logs;
create trigger attendance_logs_audit
before insert or update on public.attendance_logs
for each row
execute function public.set_audit_fields();

drop trigger if exists session_logs_audit on public.session_logs;
create trigger session_logs_audit
before insert or update on public.session_logs
for each row
execute function public.set_audit_fields();
