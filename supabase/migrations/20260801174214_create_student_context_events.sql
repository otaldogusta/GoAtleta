create table public.student_context_events (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id text not null references public.students(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  source_type text not null check (source_type in ('attendance_note', 'pain_score', 'absence_notice')),
  source_id text not null,
  raw_text text not null default '',
  category text not null check (
    category in ('absence', 'withdrawal_risk', 'health', 'logistics', 'wellbeing', 'return_expected')
  ),
  severity text not null check (severity in ('info', 'attention', 'urgent')),
  confidence text not null check (confidence in ('medium', 'high')),
  status text not null default 'confirmed' check (status in ('confirmed', 'resolved', 'ignored')),
  title text not null,
  summary text not null,
  event_date date not null,
  created_by uuid not null references auth.users(id),
  confirmed_by uuid not null references auth.users(id),
  confirmed_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_type, source_id, category)
);

create index student_context_events_class_status_date_idx
  on public.student_context_events (organization_id, class_id, status, event_date desc);

create index student_context_events_student_status_date_idx
  on public.student_context_events (organization_id, student_id, status, event_date desc);

alter table public.student_context_events enable row level security;

create policy "student context select assigned staff"
  on public.student_context_events
  for select
  using (
    public.is_org_admin(organization_id)
    or public.is_class_staff(class_id)
  );

create policy "student context insert assigned staff"
  on public.student_context_events
  for insert
  with check (
    auth.uid() = created_by
    and auth.uid() = confirmed_by
    and (
      public.is_org_admin(organization_id)
      or public.is_class_staff(class_id)
    )
    and exists (
      select 1
      from public.classes c
      where c.id = class_id
        and c.organization_id = organization_id
    )
    and exists (
      select 1
      from public.students s
      where s.id = student_id
        and s.organization_id = organization_id
    )
  );

create policy "student context update assigned staff"
  on public.student_context_events
  for update
  using (
    public.is_org_admin(organization_id)
    or public.is_class_staff(class_id)
  )
  with check (
    public.is_org_admin(organization_id)
    or public.is_class_staff(class_id)
  );

revoke all on table public.student_context_events from anon, public;
grant select, insert, update on table public.student_context_events to authenticated;
