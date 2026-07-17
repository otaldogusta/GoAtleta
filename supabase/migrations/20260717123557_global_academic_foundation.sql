-- Curated global academic knowledge. Private Drive sources remain unchanged.

create table public.global_capability_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  primary key (user_id, capability),
  constraint global_capability_grants_capability_check
    check (capability = 'manage_global_academic_knowledge'),
  constraint global_capability_grants_revocation_check
    check ((revoked_at is null) = (revoked_by is null))
);

create table public.global_capability_bootstraps (
  capability text primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  completed_at timestamptz not null default now(),
  constraint global_capability_bootstraps_capability_check
    check (capability = 'manage_global_academic_knowledge')
);

create or replace function public.has_global_capability(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.global_capability_grants grant_row
    where grant_row.user_id = (select auth.uid())
      and grant_row.capability = p_capability
      and grant_row.revoked_at is null
  );
$$;

revoke all on function public.has_global_capability(text) from public, anon;
grant execute on function public.has_global_capability(text) to authenticated, service_role;

do $$
declare
  academic_owner uuid;
  owner_count integer;
begin
  if not exists (
    select 1 from public.global_capability_bootstraps
    where capability = 'manage_global_academic_knowledge'
  ) then
    select count(*), (array_agg(owner_user_id order by owner_user_id))[1]
      into owner_count, academic_owner
    from (
      select distinct owner_user_id
      from public.document_sources
      where source_scope = 'user_academic'
        and owner_user_id is not null
    ) owners;

    -- Empty databases are valid in CI/local development. Production currently
    -- has one owner and completes the one-time bootstrap in this migration.
    if owner_count > 1 then
      raise exception
        'Global academic curator bootstrap requires exactly one academic owner; found %',
        owner_count;
    end if;

    if owner_count = 1 then
      insert into public.global_capability_grants (
        user_id, capability, granted_by
      ) values (
        academic_owner, 'manage_global_academic_knowledge', academic_owner
      ) on conflict (user_id, capability) do update
        set revoked_by = null, revoked_at = null;

      insert into public.global_capability_bootstraps (capability, owner_user_id)
      values ('manage_global_academic_knowledge', academic_owner);
    end if;
  end if;
end;
$$;

alter table public.scientific_sources
  add column if not exists public_identity_id text,
  add column if not exists authors text[] not null default '{}'::text[],
  add column if not exists publication_venue text,
  add column if not exists doi text,
  add column if not exists official_url text,
  add column if not exists material_type text,
  add column if not exists study_design text,
  add column if not exists evidence_level text,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists verified_at timestamptz,
  add constraint scientific_sources_verification_status_check
    check (verification_status in ('unverified', 'confirmed', 'rejected')),
  add constraint scientific_sources_scientific_confirmation_check
    check (
      verification_status <> 'confirmed'
      or (
        cardinality(authors) > 0
        and year is not null
        and nullif(btrim(title), '') is not null
        and nullif(btrim(coalesce(publication_venue, '')), '') is not null
        and nullif(btrim(coalesce(study_design, '')), '') is not null
        and nullif(btrim(coalesce(evidence_level, '')), '') is not null
        and verified_by is not null
        and verified_at is not null
      )
    );

create unique index scientific_sources_public_identity_unique
  on public.scientific_sources (public_identity_id)
  where public_identity_id is not null;
create unique index scientific_sources_normalized_doi_unique
  on public.scientific_sources (
    lower(regexp_replace(doi, '^https?://(dx\.)?doi\.org/', '', 'i'))
  ) where doi is not null;

create table public.global_academic_interpretations (
  id uuid primary key default gen_random_uuid(),
  public_identity_id text not null,
  claim text not null,
  practical_application text not null,
  limitations text[] not null default '{}'::text[],
  citation_label text not null,
  authors text[] not null default '{}'::text[],
  publication_year integer,
  title text not null,
  publication_venue text,
  doi text,
  official_url text,
  material_type text not null,
  evidence_level text not null,
  license_code text,
  classification_confidence numeric not null,
  scientific_source_id uuid references public.scientific_sources(id) on delete restrict,
  source_document_id uuid not null references public.document_sources(id) on delete restrict,
  source_revision_id uuid not null references public.document_source_revisions(id) on delete restrict,
  source_content_hash text not null,
  administrative_excerpt text,
  publication_version integer not null default 1,
  publication_status text not null default 'awaiting_review',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  supersedes_id uuid references public.global_academic_interpretations(id) on delete restrict,
  withdrawn_by uuid references auth.users(id) on delete set null,
  withdrawn_at timestamptz,
  blocked_by uuid references auth.users(id) on delete set null,
  blocked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint global_academic_status_check check (
    publication_status in (
      'awaiting_review', 'published', 'published_outdated',
      'superseded', 'withdrawn', 'blocked'
    )
  ),
  constraint global_academic_confidence_check
    check (classification_confidence between 0 and 1),
  constraint global_academic_excerpt_check
    check (administrative_excerpt is null or length(administrative_excerpt) <= 600),
  constraint global_academic_no_personal_summary_check
    check (material_type not in ('student_summary', 'personal_note')),
  constraint global_academic_approval_check check (
    publication_status = 'awaiting_review'
    or (approved_by is not null and approved_at is not null)
  ),
  unique (source_revision_id, public_identity_id, publication_version)
);

create unique index global_academic_one_current_publication
  on public.global_academic_interpretations (public_identity_id)
  where publication_status in ('published', 'published_outdated');
create index global_academic_retrieval_idx
  on public.global_academic_interpretations (publication_status, public_identity_id);
create index global_academic_private_origin_idx
  on public.global_academic_interpretations (source_document_id, source_revision_id);

create table public.global_academic_audit_log (
  id bigint generated always as identity primary key,
  interpretation_id uuid references public.global_academic_interpretations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  idempotency_key text,
  previous_status text,
  resulting_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index global_academic_audit_idempotency_unique
  on public.global_academic_audit_log (actor_user_id, action, idempotency_key)
  where idempotency_key is not null;

create or replace function public.mark_global_academic_publication_outdated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.global_academic_interpretations interpretation
    set publication_status = 'published_outdated', updated_at = now()
  where interpretation.source_document_id = new.source_id
    and interpretation.source_revision_id <> new.id
    and interpretation.publication_status = 'published';
  return new;
end;
$$;

create trigger document_revision_marks_global_publication_outdated
after insert on public.document_source_revisions
for each row execute function public.mark_global_academic_publication_outdated();

alter table public.global_capability_grants enable row level security;
alter table public.global_capability_bootstraps enable row level security;
alter table public.global_academic_interpretations enable row level security;
alter table public.global_academic_audit_log enable row level security;

create policy global_capability_grants_read_own
  on public.global_capability_grants for select to authenticated
  using ((select auth.uid()) = user_id);
create policy global_academic_admin_select
  on public.global_academic_interpretations for select to authenticated
  using (public.has_global_capability('manage_global_academic_knowledge'));
create policy global_academic_audit_admin_select
  on public.global_academic_audit_log for select to authenticated
  using (public.has_global_capability('manage_global_academic_knowledge'));

revoke all on public.global_capability_grants from anon, authenticated;
revoke all on public.global_capability_bootstraps from anon, authenticated;
revoke all on public.global_academic_interpretations from anon, authenticated;
revoke all on public.global_academic_audit_log from anon, authenticated;
grant select on public.global_capability_grants to authenticated;
grant select on public.global_academic_interpretations to authenticated;
grant select on public.global_academic_audit_log to authenticated;

create or replace function public.publish_global_academic_interpretation(
  p_interpretation_id uuid,
  p_expected_status text,
  p_idempotency_key text
)
returns public.global_academic_interpretations
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.global_academic_interpretations;
  prior public.global_academic_interpretations;
begin
  if not public.has_global_capability('manage_global_academic_knowledge') then
    raise exception 'Not authorized';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  end if;

  select * into item from public.global_academic_interpretations
    where id = p_interpretation_id for update;
  if not found then raise exception 'Interpretation not found'; end if;
  if item.publication_status = 'published' then return item; end if;
  if item.publication_status <> p_expected_status
     or item.publication_status <> 'awaiting_review' then
    raise exception 'Stale interpretation state';
  end if;

  select * into prior from public.global_academic_interpretations
    where public_identity_id = item.public_identity_id
      and publication_status in ('published', 'published_outdated')
    for update;

  if prior.id is not null then
    update public.global_academic_interpretations
      set publication_status = 'superseded', updated_at = now()
      where id = prior.id;
  end if;

  update public.global_academic_interpretations
    set publication_status = 'published',
        approved_by = (select auth.uid()), approved_at = now(),
        supersedes_id = prior.id, updated_at = now()
    where id = item.id returning * into item;

  insert into public.global_academic_audit_log (
    interpretation_id, actor_user_id, action, previous_status,
    resulting_status, idempotency_key, details
  ) values (
    item.id, (select auth.uid()), 'publish', p_expected_status, 'published',
    p_idempotency_key,
    jsonb_build_object('idempotencyKey', p_idempotency_key)
  );
  return item;
end;
$$;

create or replace function public.set_global_academic_publication_status(
  p_interpretation_id uuid,
  p_status text,
  p_idempotency_key text
)
returns public.global_academic_interpretations
language plpgsql
security definer
set search_path = ''
as $$
declare item public.global_academic_interpretations;
begin
  if not public.has_global_capability('manage_global_academic_knowledge') then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('withdrawn', 'blocked') then
    raise exception 'Invalid terminal status';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Idempotency key is required';
  end if;
  select * into item from public.global_academic_interpretations
    where id = p_interpretation_id for update;
  if not found then raise exception 'Interpretation not found'; end if;
  if item.publication_status = p_status then return item; end if;
  update public.global_academic_interpretations set
    publication_status = p_status,
    withdrawn_by = case when p_status = 'withdrawn' then (select auth.uid()) else withdrawn_by end,
    withdrawn_at = case when p_status = 'withdrawn' then now() else withdrawn_at end,
    blocked_by = case when p_status = 'blocked' then (select auth.uid()) else blocked_by end,
    blocked_at = case when p_status = 'blocked' then now() else blocked_at end,
    updated_at = now()
  where id = p_interpretation_id returning * into item;
  insert into public.global_academic_audit_log (
    interpretation_id, actor_user_id, action, previous_status,
    resulting_status, idempotency_key, details
  ) values (
    item.id, (select auth.uid()), p_status, null, p_status,
    p_idempotency_key,
    jsonb_build_object('idempotencyKey', p_idempotency_key)
  );
  return item;
end;
$$;

create or replace function public.list_published_global_academic_knowledge()
returns table (
  id uuid,
  public_identity_id text,
  claim text,
  practical_application text,
  limitations text[],
  citation_label text,
  authors text[],
  publication_year integer,
  title text,
  publication_venue text,
  doi text,
  official_url text,
  material_type text,
  evidence_level text,
  scientific_source_id uuid,
  study_design text,
  scientific_verification_status text,
  publication_version integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select interpretation.id, interpretation.public_identity_id,
    interpretation.claim, interpretation.practical_application,
    interpretation.limitations, interpretation.citation_label,
    interpretation.authors, interpretation.publication_year,
    interpretation.title, interpretation.publication_venue,
    interpretation.doi, interpretation.official_url,
    interpretation.material_type, interpretation.evidence_level,
    interpretation.scientific_source_id, scientific.study_design,
    scientific.verification_status, interpretation.publication_version
  from public.global_academic_interpretations interpretation
  left join public.scientific_sources scientific
    on scientific.id = interpretation.scientific_source_id
  where (select auth.uid()) is not null
    and interpretation.publication_status in ('published', 'published_outdated');
$$;

revoke all on function public.publish_global_academic_interpretation(uuid, text, text) from public, anon;
revoke all on function public.set_global_academic_publication_status(uuid, text, text) from public, anon;
revoke all on function public.list_published_global_academic_knowledge() from public, anon;
grant execute on function public.publish_global_academic_interpretation(uuid, text, text) to authenticated;
grant execute on function public.set_global_academic_publication_status(uuid, text, text) to authenticated;
grant execute on function public.list_published_global_academic_knowledge() to authenticated;
