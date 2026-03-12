create table if not exists public.student_class_enrollments (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  modality text null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_class_enrollments_org_idx
  on public.student_class_enrollments (organization_id);

create index if not exists student_class_enrollments_class_idx
  on public.student_class_enrollments (class_id, status);

create index if not exists student_class_enrollments_student_idx
  on public.student_class_enrollments (student_id, status);

create unique index if not exists student_class_enrollments_org_student_class_uidx
  on public.student_class_enrollments (organization_id, student_id, class_id);

alter table public.student_class_enrollments enable row level security;

drop policy if exists "student_class_enrollments select trainer" on public.student_class_enrollments;
create policy "student_class_enrollments select trainer" on public.student_class_enrollments
  for select
  using (
    public.is_org_admin(student_class_enrollments.organization_id)
    or public.is_class_staff(student_class_enrollments.class_id)
  );

drop policy if exists "student_class_enrollments insert trainer" on public.student_class_enrollments;
create policy "student_class_enrollments insert trainer" on public.student_class_enrollments
  for insert
  with check (
    (
      public.is_org_admin(student_class_enrollments.organization_id)
      or public.is_class_staff(student_class_enrollments.class_id)
    )
    and exists (
      select 1
      from public.classes c
      where c.id = student_class_enrollments.class_id
        and c.organization_id = student_class_enrollments.organization_id
    )
    and exists (
      select 1
      from public.students s
      where s.id = student_class_enrollments.student_id
        and s.organization_id = student_class_enrollments.organization_id
    )
  );

drop policy if exists "student_class_enrollments update trainer" on public.student_class_enrollments;
create policy "student_class_enrollments update trainer" on public.student_class_enrollments
  for update
  using (
    public.is_org_admin(student_class_enrollments.organization_id)
    or public.is_class_staff(student_class_enrollments.class_id)
  )
  with check (
    (
      public.is_org_admin(student_class_enrollments.organization_id)
      or public.is_class_staff(student_class_enrollments.class_id)
    )
    and exists (
      select 1
      from public.classes c
      where c.id = student_class_enrollments.class_id
        and c.organization_id = student_class_enrollments.organization_id
    )
    and exists (
      select 1
      from public.students s
      where s.id = student_class_enrollments.student_id
        and s.organization_id = student_class_enrollments.organization_id
    )
  );

drop policy if exists "student_class_enrollments delete trainer" on public.student_class_enrollments;
create policy "student_class_enrollments delete trainer" on public.student_class_enrollments
  for delete
  using (public.is_org_admin(student_class_enrollments.organization_id));

insert into public.student_class_enrollments (id, organization_id, student_id, class_id, modality, status, created_at, updated_at)
select
  'sce_backfill_' || s.id || '_' || s.classid,
  s.organization_id,
  s.id,
  s.classid,
  c.modality,
  'active',
  now(),
  now()
from public.students s
join public.classes c on c.id = s.classid
where s.organization_id is not null
on conflict (organization_id, student_id, class_id) do nothing;
