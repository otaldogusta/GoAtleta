create table if not exists public.weekly_autopilot_proposals (
  id text primary key,
  organization_id uuid not null,
  class_id text not null,
  week_start date not null,
  summary text not null,
  actions jsonb not null default '[]'::jsonb,
  proposed_plan_ids jsonb not null default '[]'::jsonb,
  status text not null default 'proposed',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_autopilot_status_check
    check (status in ('draft', 'proposed', 'approved', 'rejected'))
);

create index if not exists idx_weekly_autopilot_org_class_week
  on public.weekly_autopilot_proposals (organization_id, class_id, week_start desc);

alter table public.weekly_autopilot_proposals enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_autopilot_proposals'
      and policyname = 'weekly_autopilot_select_member'
  ) then
    create policy weekly_autopilot_select_member
      on public.weekly_autopilot_proposals
      for select
      using (public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_autopilot_proposals'
      and policyname = 'weekly_autopilot_insert_member'
  ) then
    create policy weekly_autopilot_insert_member
      on public.weekly_autopilot_proposals
      for insert
      with check (public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'weekly_autopilot_proposals'
      and policyname = 'weekly_autopilot_update_admin'
  ) then
    create policy weekly_autopilot_update_admin
      on public.weekly_autopilot_proposals
      for update
      using (public.is_org_admin(organization_id))
      with check (public.is_org_admin(organization_id));
  end if;
end $$;

create table if not exists public.assistant_memory_entries (
  id text primary key,
  organization_id uuid not null,
  class_id text not null default '',
  user_id uuid not null,
  scope text not null default 'class',
  role text not null default 'assistant',
  content text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint assistant_memory_scope_check
    check (scope in ('organization', 'class', 'coach')),
  constraint assistant_memory_role_check
    check (role in ('user', 'assistant'))
);

create index if not exists idx_assistant_memory_org_scope_created
  on public.assistant_memory_entries (organization_id, scope, created_at desc);
create index if not exists idx_assistant_memory_expires
  on public.assistant_memory_entries (expires_at);

alter table public.assistant_memory_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'assistant_memory_entries'
      and policyname = 'assistant_memory_select_member'
  ) then
    create policy assistant_memory_select_member
      on public.assistant_memory_entries
      for select
      using (public.is_org_member(organization_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'assistant_memory_entries'
      and policyname = 'assistant_memory_insert_member'
  ) then
    create policy assistant_memory_insert_member
      on public.assistant_memory_entries
      for insert
      with check (public.is_org_member(organization_id));
  end if;
end $$;
