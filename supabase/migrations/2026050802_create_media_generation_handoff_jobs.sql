create table if not exists public.media_generation_handoff_jobs (
  id text primary key,
  organization_id text null,
  provider_id text not null,
  status text not null,
  request jsonb not null,
  prompt text not null,
  error_message text null,
  result_asset_uri text null,
  result_thumbnail_uri text null,
  result_payload jsonb null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz null,
  constraint media_generation_handoff_jobs_status_check
    check (status in ('pending_agent', 'processing', 'completed', 'failed', 'cancelled'))
);

create index if not exists media_generation_handoff_jobs_status_idx
  on public.media_generation_handoff_jobs (status);

create index if not exists media_generation_handoff_jobs_org_idx
  on public.media_generation_handoff_jobs (organization_id);

create index if not exists media_generation_handoff_jobs_created_at_idx
  on public.media_generation_handoff_jobs (created_at desc);

alter table public.media_generation_handoff_jobs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'media_generation_handoff_jobs'
      and policyname = 'media_generation_handoff_jobs_authenticated_select'
  ) then
    create policy media_generation_handoff_jobs_authenticated_select
      on public.media_generation_handoff_jobs
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'media_generation_handoff_jobs'
      and policyname = 'media_generation_handoff_jobs_authenticated_insert'
  ) then
    create policy media_generation_handoff_jobs_authenticated_insert
      on public.media_generation_handoff_jobs
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'media_generation_handoff_jobs'
      and policyname = 'media_generation_handoff_jobs_authenticated_update'
  ) then
    create policy media_generation_handoff_jobs_authenticated_update
      on public.media_generation_handoff_jobs
      for update
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'media_generation_handoff_jobs'
      and policyname = 'media_generation_handoff_jobs_authenticated_delete'
  ) then
    create policy media_generation_handoff_jobs_authenticated_delete
      on public.media_generation_handoff_jobs
      for delete
      to authenticated
      using (true);
  end if;
end
$$;
