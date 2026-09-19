create table public.scientific_evidence_searches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  redacted_query text not null check (char_length(redacted_query) between 3 and 500),
  query_hash text not null check (query_hash ~ '^[a-f0-9]{64}$'),
  trigger text not null check (trigger in ('explicit', 'internal_gap', 'stale', 'conflict', 'high_impact')),
  provider text not null check (provider in ('consensus', 'pubmed')),
  filters jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'searched', 'fallback', 'quota_exceeded', 'failed')),
  call_units integer not null default 0 check (call_units between 0 and 100),
  warnings text[] not null default '{}',
  expires_at timestamptz not null default (now() + interval '90 days'),
  created_at timestamptz not null default now()
);

create table public.scientific_evidence_candidates (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.scientific_evidence_searches(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('consensus', 'pubmed')),
  external_id text not null,
  doi text,
  pmid text,
  title text not null,
  authors text[] not null default '{}',
  journal text,
  publication_year integer,
  abstract text,
  relevant_passages text[] not null default '{}',
  study_type text,
  population text,
  limitations text[] not null default '{}',
  citation_count integer,
  relevance_score numeric,
  source_url text not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  state text not null default 'candidate' check (state in ('candidate', 'quarantined', 'global', 'rejected')),
  gate_reasons text[] not null default '{}',
  scientific_source_id uuid references public.scientific_sources(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (search_id, provider, external_id)
);

create table public.scientific_evidence_publication_audit (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.scientific_evidence_candidates(id) on delete restrict,
  scientific_source_id uuid references public.scientific_sources(id) on delete set null,
  action text not null check (action in ('auto_publish', 'quarantine', 'reject', 'withdraw')),
  reason text not null,
  actor text not null default 'system:scientific-evidence-gate',
  operation_id uuid not null default gen_random_uuid(),
  previous_state jsonb,
  resulting_state jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.scientific_evidence_searches enable row level security;
alter table public.scientific_evidence_candidates enable row level security;
alter table public.scientific_evidence_publication_audit enable row level security;

create policy scientific_evidence_searches_member_select
  on public.scientific_evidence_searches for select to authenticated
  using (public.is_org_member(organization_id));

create policy scientific_evidence_candidates_member_select
  on public.scientific_evidence_candidates for select to authenticated
  using (public.is_org_member(organization_id));

create policy scientific_evidence_audit_global_curator_select
  on public.scientific_evidence_publication_audit for select to authenticated
  using (public.has_global_capability('manage_global_academic_knowledge'));

revoke all on public.scientific_evidence_searches from anon, authenticated;
revoke all on public.scientific_evidence_candidates from anon, authenticated;
revoke all on public.scientific_evidence_publication_audit from anon, authenticated;
grant select on public.scientific_evidence_searches to authenticated;
grant select on public.scientific_evidence_candidates to authenticated;
grant select on public.scientific_evidence_publication_audit to authenticated;

create index scientific_evidence_search_cache_idx
  on public.scientific_evidence_searches (organization_id, query_hash, expires_at desc);
create index scientific_evidence_search_quota_idx
  on public.scientific_evidence_searches (organization_id, provider, created_at desc);
create index scientific_evidence_search_user_quota_idx
  on public.scientific_evidence_searches (user_id, provider, created_at desc);
create index scientific_evidence_candidate_doi_idx
  on public.scientific_evidence_candidates (lower(doi)) where doi is not null;

create or replace function public.reserve_scientific_evidence_consensus_call(
  p_organization_id uuid,
  p_user_id uuid,
  p_redacted_query text,
  p_query_hash text,
  p_trigger text,
  p_warnings text[] default '{}'
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_search_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('scientific-evidence-org:' || p_organization_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('scientific-evidence-user:' || p_user_id::text, 0)
  );

  if (
    select count(*) >= 50
    from public.scientific_evidence_searches
    where organization_id = p_organization_id
      and provider = 'consensus'
      and call_units > 0
      and created_at >= date_trunc('month', now())
  ) or (
    select count(*) >= 5
    from public.scientific_evidence_searches
    where user_id = p_user_id
      and provider = 'consensus'
      and call_units > 0
      and created_at >= date_trunc('day', now())
  ) then
    return null;
  end if;

  insert into public.scientific_evidence_searches (
    organization_id, user_id, redacted_query, query_hash, trigger,
    provider, status, call_units, warnings, filters
  ) values (
    p_organization_id, p_user_id, p_redacted_query, p_query_hash, p_trigger,
    'consensus', 'pending', 1, coalesce(p_warnings, '{}'),
    '{"limit":20,"excludePreprints":true}'::jsonb
  ) returning id into v_search_id;

  return v_search_id;
end;
$$;

revoke all on function public.reserve_scientific_evidence_consensus_call(uuid, uuid, text, text, text, text[])
  from public, anon, authenticated;
grant execute on function public.reserve_scientific_evidence_consensus_call(uuid, uuid, text, text, text, text[])
  to service_role;

alter table public.scientific_sources
  add column if not exists discovery_provider text,
  add column if not exists discovery_external_id text,
  add column if not exists auto_published boolean not null default false,
  add column if not exists abstract text,
  add column if not exists relevant_passages text[] not null default '{}',
  add column if not exists population text,
  add column if not exists limitations text[] not null default '{}',
  add column if not exists relevance_score numeric,
  add column if not exists withdrawn_at timestamptz,
  add constraint scientific_sources_discovery_provider_check
    check (discovery_provider is null or discovery_provider in ('consensus', 'pubmed'));

create unique index scientific_sources_discovery_identity_unique
  on public.scientific_sources (discovery_provider, discovery_external_id)
  where discovery_provider is not null and discovery_external_id is not null;

alter table public.scientific_sources
  add column if not exists search_document tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(abstract, '') || ' ' || coalesce(population, ''))
  ) stored;

create index scientific_sources_auto_search_idx
  on public.scientific_sources using gin (search_document)
  where auto_published and withdrawn_at is null;

create schema if not exists private;

create or replace function private.withdraw_auto_published_scientific_evidence(
  p_candidate_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.scientific_evidence_candidates;
begin
  select * into item
  from public.scientific_evidence_candidates
  where id = p_candidate_id
  for update;

  if item.id is null or item.state <> 'global' or item.scientific_source_id is null then
    raise exception 'candidate is not an active automatic publication';
  end if;

  update public.scientific_sources
  set withdrawn_at = now()
  where id = item.scientific_source_id and auto_published;

  update public.scientific_evidence_candidates
  set state = 'rejected', gate_reasons = array['withdrawn']
  where id = item.id;

  insert into public.scientific_evidence_publication_audit (
    candidate_id, scientific_source_id, action, reason, previous_state, resulting_state
  ) values (
    item.id, item.scientific_source_id, 'withdraw', coalesce(nullif(btrim(p_reason), ''), 'withdrawn_by_operator'),
    jsonb_build_object('state', 'global'), jsonb_build_object('state', 'rejected')
  );
end;
$$;

revoke all on function private.withdraw_auto_published_scientific_evidence(uuid, text)
  from public, anon, authenticated;
grant execute on function private.withdraw_auto_published_scientific_evidence(uuid, text)
  to service_role;
