-- Reconcile manually-created media tables with migration history and restrict
-- every API capability without changing or deleting existing rows.

create table if not exists public.exercise_media_assets (
  id text primary key,
  organization_id text,
  exercise_key text not null,
  title text not null,
  kind text not null check (kind in ('image', 'video', 'thumbnail', 'qr')),
  source text not null,
  status text not null check (status in ('draft', 'approved', 'archived')),
  uri text not null,
  thumbnail_uri text,
  qr_uri text,
  modality text,
  sport text,
  age_band text,
  level text,
  tags jsonb not null default '[]'::jsonb,
  approved_by text,
  approval_note text,
  approved_at timestamptz,
  archived_by text,
  archive_note text,
  archived_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz
);

create index if not exists exercise_media_assets_exercise_key_idx
  on public.exercise_media_assets (exercise_key);
create index if not exists exercise_media_assets_kind_idx
  on public.exercise_media_assets (kind);
create index if not exists exercise_media_assets_organization_id_idx
  on public.exercise_media_assets (organization_id);
create index if not exists exercise_media_assets_status_idx
  on public.exercise_media_assets (status);

alter table public.exercise_media_assets enable row level security;

drop policy if exists "exercise_media_assets authenticated select"
  on public.exercise_media_assets;
drop policy if exists "exercise_media_assets authenticated insert"
  on public.exercise_media_assets;
drop policy if exists "exercise_media_assets authenticated update"
  on public.exercise_media_assets;
drop policy if exists "exercise_media_assets authenticated delete"
  on public.exercise_media_assets;

create policy "exercise_media_assets scoped select"
on public.exercise_media_assets
for select
to authenticated
using (
  organization_id is null
  or case
    when organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_org_member(organization_id::uuid)
    else false
  end
);

create policy "exercise_media_assets admin insert"
on public.exercise_media_assets
for insert
to authenticated
with check (
  organization_id is not null
  and case
    when organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_org_admin(organization_id::uuid)
    else false
  end
);

create policy "exercise_media_assets admin update"
on public.exercise_media_assets
for update
to authenticated
using (
  organization_id is not null
  and case
    when organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_org_admin(organization_id::uuid)
    else false
  end
)
with check (
  organization_id is not null
  and case
    when organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_org_admin(organization_id::uuid)
    else false
  end
);

create policy "exercise_media_assets admin delete"
on public.exercise_media_assets
for delete
to authenticated
using (
  organization_id is not null
  and case
    when organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_org_admin(organization_id::uuid)
    else false
  end
);

revoke all on table public.exercise_media_assets from public, anon, authenticated;
grant select, insert, update, delete on table public.exercise_media_assets to authenticated;
grant all on table public.exercise_media_assets to service_role;

create table if not exists public.media_generation_handoff_jobs (
  id text primary key,
  organization_id text,
  provider_id text not null,
  status text not null check (
    status in ('pending_agent', 'processing', 'completed', 'failed', 'cancelled')
  ),
  request jsonb not null,
  prompt text not null,
  error_message text,
  result_asset_uri text,
  result_thumbnail_uri text,
  result_payload jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  completed_at timestamptz
);

create index if not exists media_generation_handoff_jobs_created_at_idx
  on public.media_generation_handoff_jobs (created_at desc);
create index if not exists media_generation_handoff_jobs_org_idx
  on public.media_generation_handoff_jobs (organization_id);
create index if not exists media_generation_handoff_jobs_status_idx
  on public.media_generation_handoff_jobs (status);

alter table public.media_generation_handoff_jobs enable row level security;

drop policy if exists media_generation_handoff_jobs_authenticated_select
  on public.media_generation_handoff_jobs;
drop policy if exists media_generation_handoff_jobs_authenticated_insert
  on public.media_generation_handoff_jobs;
drop policy if exists media_generation_handoff_jobs_authenticated_update
  on public.media_generation_handoff_jobs;
drop policy if exists media_generation_handoff_jobs_authenticated_delete
  on public.media_generation_handoff_jobs;

create policy "media_generation_handoff_jobs admin select"
on public.media_generation_handoff_jobs
for select
to authenticated
using (
  organization_id is not null
  and case
    when organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_org_admin(organization_id::uuid)
    else false
  end
);

create policy "media_generation_handoff_jobs admin insert"
on public.media_generation_handoff_jobs
for insert
to authenticated
with check (
  organization_id is not null
  and case
    when organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_org_admin(organization_id::uuid)
    else false
  end
);

create policy "media_generation_handoff_jobs admin update"
on public.media_generation_handoff_jobs
for update
to authenticated
using (
  organization_id is not null
  and case
    when organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_org_admin(organization_id::uuid)
    else false
  end
)
with check (
  organization_id is not null
  and case
    when organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_org_admin(organization_id::uuid)
    else false
  end
);

create policy "media_generation_handoff_jobs admin delete"
on public.media_generation_handoff_jobs
for delete
to authenticated
using (
  organization_id is not null
  and case
    when organization_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_org_admin(organization_id::uuid)
    else false
  end
);

revoke all on table public.media_generation_handoff_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.media_generation_handoff_jobs
  to authenticated;
grant all on table public.media_generation_handoff_jobs to service_role;

-- Public buckets already serve known object URLs. Removing this SELECT policy
-- prevents anonymous users from enumerating every profile photo through the
-- objects API while preserving public image rendering.
drop policy if exists "profile_photos public read" on storage.objects;

-- The trainer helper is required by authenticated RLS policies, but it must not
-- be exposed as an anonymous SECURITY DEFINER RPC.
alter function public.is_trainer() set search_path = public, pg_temp;
revoke all on function public.is_trainer() from public, anon;
grant execute on function public.is_trainer() to authenticated, service_role;

-- Pure helpers still need a deterministic search path even though they do not
-- use SECURITY DEFINER.
do $block$
declare
  helper record;
begin
  for helper in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'app_role',
        'app_tenant_id',
        'event_sport_to_regulation_sport'
      ])
  loop
    execute format(
      'alter function %s set search_path = public, pg_temp',
      helper.signature
    );
  end loop;
end
$block$;

-- Profile data remains reachable only through the authenticated self-service
-- RPCs; no direct Data API table grant is necessary.
revoke all on table public.user_profiles from public, anon, authenticated;
grant all on table public.user_profiles to service_role;
