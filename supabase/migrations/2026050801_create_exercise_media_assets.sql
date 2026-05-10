create table if not exists public.exercise_media_assets (
  id text primary key,
  organization_id text null,
  exercise_key text not null,
  title text not null,
  kind text not null,
  source text not null,
  status text not null,
  uri text not null,
  thumbnail_uri text null,
  qr_uri text null,
  modality text null,
  sport text null,
  age_band text null,
  level text null,
  tags jsonb not null default '[]'::jsonb,
  approved_by text null,
  approval_note text null,
  approved_at timestamptz null,
  archived_by text null,
  archive_note text null,
  archived_at timestamptz null,
  created_at timestamptz not null,
  updated_at timestamptz null,
  constraint exercise_media_assets_status_check
    check (status in ('draft', 'approved', 'archived')),
  constraint exercise_media_assets_kind_check
    check (kind in ('image', 'video', 'thumbnail', 'qr'))
);

create index if not exists exercise_media_assets_status_idx
  on public.exercise_media_assets(status);

create index if not exists exercise_media_assets_exercise_key_idx
  on public.exercise_media_assets(exercise_key);

create index if not exists exercise_media_assets_organization_id_idx
  on public.exercise_media_assets(organization_id);

create index if not exists exercise_media_assets_kind_idx
  on public.exercise_media_assets(kind);

alter table public.exercise_media_assets enable row level security;

drop policy if exists "exercise_media_assets authenticated select" on public.exercise_media_assets;
create policy "exercise_media_assets authenticated select" on public.exercise_media_assets
  for select
  to authenticated
  using (true);

drop policy if exists "exercise_media_assets authenticated insert" on public.exercise_media_assets;
create policy "exercise_media_assets authenticated insert" on public.exercise_media_assets
  for insert
  to authenticated
  with check (true);

drop policy if exists "exercise_media_assets authenticated update" on public.exercise_media_assets;
create policy "exercise_media_assets authenticated update" on public.exercise_media_assets
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "exercise_media_assets authenticated delete" on public.exercise_media_assets;
create policy "exercise_media_assets authenticated delete" on public.exercise_media_assets
  for delete
  to authenticated
  using (true);
