-- PR: regulation updates v1 (safe, auditable, no AI)

create table if not exists public.regulation_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  authority text not null check (authority in ('FIVB', 'FPV', 'PARANAENSE', 'OUTRO')),
  source_url text not null,
  sport text not null default 'volleyball',
  topic_hints text[] not null default '{}'::text[],
  enabled boolean not null default true,
  check_interval_hours int not null default 6,
  last_checked_at timestamptz null,
  last_seen_checksum text null,
  last_seen_published_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_url)
);

create index if not exists regulation_sources_org_idx
  on public.regulation_sources (organization_id, enabled);

create table if not exists public.regulation_rule_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sport text not null default 'volleyball',
  version_label text not null,
  status text not null check (status in ('draft', 'active', 'pending_next_cycle', 'archived')),
  activation_policy text not null default 'new_cycles_only'
    check (activation_policy in ('new_cycles_only', 'effective_from', 'immediate')),
  effective_from date null,
  source_authority text not null default '',
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sport, version_label)
);

create unique index if not exists regulation_rule_sets_active_uidx
  on public.regulation_rule_sets (organization_id, sport)
  where status = 'active';

create unique index if not exists regulation_rule_sets_pending_uidx
  on public.regulation_rule_sets (organization_id, sport)
  where status = 'pending_next_cycle';

create index if not exists regulation_rule_sets_org_status_idx
  on public.regulation_rule_sets (organization_id, status, updated_at desc);

create table if not exists public.regulation_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.regulation_sources(id) on delete cascade,
  rule_set_id uuid not null references public.regulation_rule_sets(id) on delete cascade,
  source_url text not null,
  storage_path text null,
  checksum_sha256 text not null,
  etag text null,
  last_modified text null,
  mime_type text null,
  byte_size bigint null,
  published_at timestamptz null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, source_id, checksum_sha256)
);

create index if not exists regulation_documents_org_fetched_idx
  on public.regulation_documents (organization_id, fetched_at desc);

create table if not exists public.regulation_updates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_set_id uuid not null references public.regulation_rule_sets(id) on delete cascade,
  source_id uuid not null references public.regulation_sources(id) on delete cascade,
  document_id uuid not null references public.regulation_documents(id) on delete cascade,
  published_at timestamptz null,
  changed_topics text[] not null default '{}'::text[],
  diff_summary text not null,
  source_url text not null,
  checksum_sha256 text not null,
  status text not null default 'published' check (status in ('detected', 'published')),
  created_at timestamptz not null default now(),
  unique (organization_id, source_id, checksum_sha256)
);

create index if not exists regulation_updates_org_created_idx
  on public.regulation_updates (organization_id, created_at desc);

create table if not exists public.regulation_update_reads (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_update_id uuid not null references public.regulation_updates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (organization_id, rule_update_id, user_id)
);

create index if not exists regulation_update_reads_user_idx
  on public.regulation_update_reads (user_id, read_at desc);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'regulation-docs',
  'regulation-docs',
  false,
  15728640,
  array['application/pdf', 'application/octet-stream', 'text/html', 'text/plain']
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_regulation_doc_object(
  p_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_parts text[];
  v_org_id uuid;
begin
  v_parts := storage.foldername(p_object_name);

  if coalesce(array_length(v_parts, 1), 0) < 1 then
    return false;
  end if;

  if v_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_org_id := v_parts[1]::uuid;
  return public.is_org_admin(v_org_id);
end;
$$;

create or replace function public.can_read_regulation_doc_object(
  p_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_parts text[];
  v_org_id uuid;
begin
  v_parts := storage.foldername(p_object_name);

  if coalesce(array_length(v_parts, 1), 0) < 1 then
    return false;
  end if;

  if v_parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_org_id := v_parts[1]::uuid;
  return public.is_org_member(v_org_id);
end;
$$;

revoke all on function public.can_manage_regulation_doc_object(text) from anon, public;
grant execute on function public.can_manage_regulation_doc_object(text) to authenticated;
revoke all on function public.can_read_regulation_doc_object(text) from anon, public;
grant execute on function public.can_read_regulation_doc_object(text) to authenticated;

drop policy if exists "regulation_docs_select_member" on storage.objects;
create policy "regulation_docs_select_member"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'regulation-docs'
    and public.can_read_regulation_doc_object(name)
  );

drop policy if exists "regulation_docs_insert_admin" on storage.objects;
create policy "regulation_docs_insert_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'regulation-docs'
    and public.can_manage_regulation_doc_object(name)
  );

drop policy if exists "regulation_docs_update_admin" on storage.objects;
create policy "regulation_docs_update_admin"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'regulation-docs'
    and public.can_manage_regulation_doc_object(name)
  )
  with check (
    bucket_id = 'regulation-docs'
    and public.can_manage_regulation_doc_object(name)
  );

drop policy if exists "regulation_docs_delete_admin" on storage.objects;
create policy "regulation_docs_delete_admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'regulation-docs'
    and public.can_manage_regulation_doc_object(name)
  );

alter table public.regulation_sources enable row level security;
alter table public.regulation_rule_sets enable row level security;
alter table public.regulation_documents enable row level security;
alter table public.regulation_updates enable row level security;
alter table public.regulation_update_reads enable row level security;

drop policy if exists "regulation_sources_select_member" on public.regulation_sources;
create policy "regulation_sources_select_member"
  on public.regulation_sources
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "regulation_sources_insert_admin" on public.regulation_sources;
create policy "regulation_sources_insert_admin"
  on public.regulation_sources
  for insert
  with check (
    public.is_org_admin(organization_id)
    and (
      created_by is null
      or created_by = auth.uid()
    )
  );

drop policy if exists "regulation_sources_update_admin" on public.regulation_sources;
create policy "regulation_sources_update_admin"
  on public.regulation_sources
  for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "regulation_sources_delete_admin" on public.regulation_sources;
create policy "regulation_sources_delete_admin"
  on public.regulation_sources
  for delete
  using (public.is_org_admin(organization_id));

drop policy if exists "regulation_rule_sets_select_member" on public.regulation_rule_sets;
create policy "regulation_rule_sets_select_member"
  on public.regulation_rule_sets
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "regulation_rule_sets_insert_admin" on public.regulation_rule_sets;
create policy "regulation_rule_sets_insert_admin"
  on public.regulation_rule_sets
  for insert
  with check (public.is_org_admin(organization_id));

drop policy if exists "regulation_rule_sets_update_admin" on public.regulation_rule_sets;
create policy "regulation_rule_sets_update_admin"
  on public.regulation_rule_sets
  for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "regulation_rule_sets_delete_admin" on public.regulation_rule_sets;
create policy "regulation_rule_sets_delete_admin"
  on public.regulation_rule_sets
  for delete
  using (public.is_org_admin(organization_id));

drop policy if exists "regulation_documents_select_member" on public.regulation_documents;
create policy "regulation_documents_select_member"
  on public.regulation_documents
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "regulation_documents_insert_admin" on public.regulation_documents;
create policy "regulation_documents_insert_admin"
  on public.regulation_documents
  for insert
  with check (public.is_org_admin(organization_id));

drop policy if exists "regulation_documents_update_admin" on public.regulation_documents;
create policy "regulation_documents_update_admin"
  on public.regulation_documents
  for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "regulation_documents_delete_admin" on public.regulation_documents;
create policy "regulation_documents_delete_admin"
  on public.regulation_documents
  for delete
  using (public.is_org_admin(organization_id));

drop policy if exists "regulation_updates_select_member" on public.regulation_updates;
create policy "regulation_updates_select_member"
  on public.regulation_updates
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "regulation_updates_insert_admin" on public.regulation_updates;
create policy "regulation_updates_insert_admin"
  on public.regulation_updates
  for insert
  with check (public.is_org_admin(organization_id));

drop policy if exists "regulation_updates_update_admin" on public.regulation_updates;
create policy "regulation_updates_update_admin"
  on public.regulation_updates
  for update
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "regulation_updates_delete_admin" on public.regulation_updates;
create policy "regulation_updates_delete_admin"
  on public.regulation_updates
  for delete
  using (public.is_org_admin(organization_id));

drop policy if exists "regulation_update_reads_select_own" on public.regulation_update_reads;
create policy "regulation_update_reads_select_own"
  on public.regulation_update_reads
  for select
  using (
    user_id = auth.uid()
    and public.is_org_member(organization_id)
  );

drop policy if exists "regulation_update_reads_insert_own" on public.regulation_update_reads;
create policy "regulation_update_reads_insert_own"
  on public.regulation_update_reads
  for insert
  with check (
    user_id = auth.uid()
    and public.is_org_member(organization_id)
    and exists (
      select 1
      from public.regulation_updates ru
      where ru.id = regulation_update_reads.rule_update_id
        and ru.organization_id = regulation_update_reads.organization_id
    )
  );

drop policy if exists "regulation_update_reads_delete_own" on public.regulation_update_reads;
create policy "regulation_update_reads_delete_own"
  on public.regulation_update_reads
  for delete
  using (
    user_id = auth.uid()
    and public.is_org_member(organization_id)
  );

grant select, insert, update, delete on table public.regulation_sources to authenticated;
grant select, insert, update, delete on table public.regulation_rule_sets to authenticated;
grant select, insert, update, delete on table public.regulation_documents to authenticated;
grant select, insert, update, delete on table public.regulation_updates to authenticated;
grant select, insert, delete on table public.regulation_update_reads to authenticated;

drop function if exists public.list_regulation_updates(uuid, boolean, int, timestamptz);
create function public.list_regulation_updates(
  p_organization_id uuid,
  p_unread_only boolean default false,
  p_limit int default 20,
  p_created_before timestamptz default null
)
returns table (
  id uuid,
  organization_id uuid,
  rule_set_id uuid,
  source_id uuid,
  document_id uuid,
  published_at timestamptz,
  changed_topics text[],
  diff_summary text,
  source_url text,
  checksum_sha256 text,
  status text,
  created_at timestamptz,
  source_label text,
  source_authority text,
  read_at timestamptz,
  is_read boolean
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_limit int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_org_member(p_organization_id) then
    raise exception 'Not authorized';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 20), 50));

  return query
  select
    ru.id,
    ru.organization_id,
    ru.rule_set_id,
    ru.source_id,
    ru.document_id,
    ru.published_at,
    ru.changed_topics,
    ru.diff_summary,
    ru.source_url,
    ru.checksum_sha256,
    ru.status,
    ru.created_at,
    rs.label as source_label,
    rs.authority as source_authority,
    rur.read_at,
    (rur.read_at is not null) as is_read
  from public.regulation_updates ru
  join public.regulation_sources rs
    on rs.id = ru.source_id
  left join public.regulation_update_reads rur
    on rur.organization_id = ru.organization_id
   and rur.rule_update_id = ru.id
   and rur.user_id = auth.uid()
  where ru.organization_id = p_organization_id
    and (p_created_before is null or ru.created_at < p_created_before)
    and (not coalesce(p_unread_only, false) or rur.read_at is null)
  order by ru.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.list_regulation_updates(uuid, boolean, int, timestamptz) from anon, public;
grant execute on function public.list_regulation_updates(uuid, boolean, int, timestamptz) to authenticated;

drop function if exists public.mark_regulation_update_read(uuid, uuid);
create function public.mark_regulation_update_read(
  p_organization_id uuid,
  p_rule_update_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_org_member(p_organization_id) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1
    from public.regulation_updates ru
    where ru.id = p_rule_update_id
      and ru.organization_id = p_organization_id
  ) then
    raise exception 'Regulation update not found';
  end if;

  insert into public.regulation_update_reads (
    organization_id,
    rule_update_id,
    user_id,
    read_at
  )
  values (
    p_organization_id,
    p_rule_update_id,
    auth.uid(),
    now()
  )
  on conflict (organization_id, rule_update_id, user_id)
  do update set read_at = excluded.read_at;
end;
$$;

revoke all on function public.mark_regulation_update_read(uuid, uuid) from anon, public;
grant execute on function public.mark_regulation_update_read(uuid, uuid) to authenticated;
