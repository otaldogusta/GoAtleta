create table if not exists public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  student_id text references public.students(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'rejected')),
  request_type text not null check (request_type in ('export', 'deletion')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  deadline timestamptz not null default (now() + interval '15 days'),
  reason text,
  responsible_user uuid references auth.users(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.data_subject_requests enable row level security;

create policy "Users can view own DSR"
on public.data_subject_requests
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own DSR"
on public.data_subject_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    student_id is null
    or exists (
      select 1 from public.students s
      where s.id = data_subject_requests.student_id
      and (
        s.owner_id = auth.uid()
        or s.student_user_id = auth.uid()
        or exists (
          select 1 from public.organization_members om
          where om.organization_id = s.organization_id
          and om.user_id = auth.uid()
          and om.role_level >= 30
        )
      )
    )
  )
);

create policy "Staff can view DSR for their org students"
on public.data_subject_requests
for select
to authenticated
using (
  student_id is not null
  and exists (
    select 1 from public.organization_members om
    join public.classes c on c.organization_id = om.organization_id
    join public.student_class_enrollments sce on sce.class_id = c.id
    where sce.student_id = data_subject_requests.student_id
      and om.user_id = auth.uid()
      and om.role_level >= 30
  )
);

create policy "Staff can update DSR"
on public.data_subject_requests
for update
to authenticated
using (
  exists (
    select 1 from public.organization_members om
    join public.classes c on c.organization_id = om.organization_id
    join public.student_class_enrollments sce on sce.class_id = c.id
    where sce.student_id = data_subject_requests.student_id
      and om.user_id = auth.uid()
      and om.role_level >= 30
  )
);

create trigger handle_dsr_updated_at before update on public.data_subject_requests
  for each row execute function private.set_lgpd_updated_at();
