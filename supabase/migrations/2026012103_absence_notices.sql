create table if not exists public.absence_notices (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  session_date date not null,
  reason text not null,
  note text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.absence_notices enable row level security;

drop policy if exists "absence_notices select trainer" on public.absence_notices;
create policy "absence_notices select trainer" on public.absence_notices
  for select
  using (
    is_trainer()
    and exists (
      select 1
      from public.classes c
      where c.id = absence_notices.class_id
        and c.owner_id = auth.uid()
    )
  );

drop policy if exists "absence_notices select student" on public.absence_notices;
create policy "absence_notices select student" on public.absence_notices
  for select
  using (
    exists (
      select 1
      from public.students s
      where s.id = absence_notices.student_id
        and s.student_user_id = auth.uid()
    )
  );

drop policy if exists "absence_notices insert student" on public.absence_notices;
create policy "absence_notices insert student" on public.absence_notices
  for insert
  with check (
    exists (
      select 1
      from public.students s
      where s.id = absence_notices.student_id
        and s.student_user_id = auth.uid()
    )
  );

drop policy if exists "absence_notices update trainer" on public.absence_notices;
create policy "absence_notices update trainer" on public.absence_notices
  for update
  using (
    is_trainer()
    and exists (
      select 1
      from public.classes c
      where c.id = absence_notices.class_id
        and c.owner_id = auth.uid()
    )
  )
  with check (
    is_trainer()
    and exists (
      select 1
      from public.classes c
      where c.id = absence_notices.class_id
        and c.owner_id = auth.uid()
    )
  );

revoke all on table public.absence_notices from anon;
grant select, insert, update on table public.absence_notices to authenticated;
