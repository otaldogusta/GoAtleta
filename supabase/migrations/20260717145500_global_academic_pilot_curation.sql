-- Pilot curation workflow: multiple atomic interpretations per private revision.

drop index public.global_academic_audit_idempotency_unique;
alter table public.global_academic_audit_log
  add constraint global_academic_audit_idempotency_unique
  unique (actor_user_id, action, idempotency_key);

alter table public.global_academic_interpretations
  drop constraint global_academic_status_check,
  add constraint global_academic_status_check check (
    publication_status in (
      'awaiting_review', 'published', 'published_outdated', 'superseded',
      'withdrawn', 'blocked', 'rejected'
    )
  ),
  drop constraint global_academic_approval_check,
  add constraint global_academic_approval_check check (
    publication_status in ('awaiting_review', 'rejected')
    or (approved_by is not null and approved_at is not null)
  );

create or replace function public.list_global_academic_source_interpretations(
  p_source_revision_id uuid
)
returns table (
  id uuid,
  publication_status text,
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
  license_code text,
  classification_confidence numeric,
  administrative_excerpt text,
  scientific_source_id uuid,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    interpretation.id,
    interpretation.publication_status,
    interpretation.public_identity_id,
    interpretation.claim,
    interpretation.practical_application,
    interpretation.limitations,
    interpretation.citation_label,
    interpretation.authors,
    interpretation.publication_year,
    interpretation.title,
    interpretation.publication_venue,
    interpretation.doi,
    interpretation.official_url,
    interpretation.material_type,
    interpretation.evidence_level,
    interpretation.license_code,
    interpretation.classification_confidence,
    case
      when interpretation.publication_status = 'blocked' then null
      else interpretation.administrative_excerpt
    end,
    interpretation.scientific_source_id,
    interpretation.updated_at
  from public.global_academic_interpretations interpretation
  join public.document_source_revisions revision
    on revision.id = interpretation.source_revision_id
  join public.document_sources source
    on source.id = revision.source_id
  where p_source_revision_id = revision.id
    and source.source_scope = 'user_academic'
    and source.owner_user_id = (select auth.uid())
    and public.has_global_capability('manage_global_academic_knowledge')
  order by interpretation.created_at, interpretation.id;
$$;

create or replace function public.list_global_academic_source_excerpts(
  p_source_revision_id uuid
)
returns table (
  chunk_index integer,
  source_location text,
  excerpt text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    document.chunk_index,
    document.source_location,
    left(document.chunk, 600)
  from public.kb_documents document
  join public.document_source_revisions revision
    on revision.id = document.source_revision_id
  join public.document_sources source
    on source.id = revision.source_id
  where revision.id = p_source_revision_id
    and revision.extraction_status = 'ready'
    and source.source_scope = 'user_academic'
    and source.owner_user_id = (select auth.uid())
    and public.has_global_capability('manage_global_academic_knowledge')
  order by document.chunk_index
  limit 12;
$$;

create or replace function public.update_global_academic_candidate(
  p_interpretation_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
returns public.global_academic_interpretations
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.global_academic_interpretations;
  source_row public.document_sources;
  authors_value text[];
  limitations_value text[];
  identity_value text;
  year_value integer;
begin
  if not public.has_global_capability('manage_global_academic_knowledge') then
    raise exception 'Not authorized';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null
     or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid candidate request';
  end if;

  select * into item
  from public.global_academic_interpretations
  where id = p_interpretation_id
  for update;
  if not found or item.publication_status <> 'awaiting_review' then
    raise exception 'Only awaiting review candidates can be edited';
  end if;

  select source.* into source_row
  from public.document_sources source
  join public.document_source_revisions revision on revision.source_id = source.id
  where revision.id = item.source_revision_id
  for share;
  if not found or source_row.source_scope <> 'user_academic'
     or source_row.owner_user_id <> (select auth.uid()) then
    raise exception 'Private academic source is outside curator scope';
  end if;

  select coalesce(array_agg(value), '{}'::text[]) into authors_value
  from jsonb_array_elements_text(coalesce(p_payload->'authors', '[]'::jsonb));
  select coalesce(array_agg(value), '{}'::text[]) into limitations_value
  from jsonb_array_elements_text(coalesce(p_payload->'limitations', '[]'::jsonb));
  year_value := nullif(p_payload->>'publicationYear', '')::integer;
  identity_value := public.canonical_academic_public_identity(
    p_payload->>'doi', authors_value, year_value,
    p_payload->>'title', p_payload->>'publicationVenue'
  );

  update public.global_academic_interpretations set
    public_identity_id = identity_value,
    claim = nullif(btrim(p_payload->>'claim'), ''),
    practical_application = nullif(btrim(p_payload->>'practicalApplication'), ''),
    limitations = limitations_value,
    citation_label = nullif(btrim(p_payload->>'citationLabel'), ''),
    authors = authors_value,
    publication_year = year_value,
    title = nullif(btrim(p_payload->>'title'), ''),
    publication_venue = nullif(btrim(p_payload->>'publicationVenue'), ''),
    doi = nullif(btrim(p_payload->>'doi'), ''),
    official_url = nullif(btrim(p_payload->>'officialUrl'), ''),
    material_type = coalesce(nullif(p_payload->>'materialType', ''), 'unknown'),
    evidence_level = coalesce(nullif(p_payload->>'evidenceLevel', ''), 'unknown_support'),
    license_code = nullif(btrim(p_payload->>'licenseCode'), ''),
    classification_confidence = coalesce((p_payload->>'classificationConfidence')::numeric, 0),
    administrative_excerpt = left(nullif(btrim(p_payload->>'administrativeExcerpt'), ''), 600),
    updated_at = now()
  where id = item.id
  returning * into item;

  insert into public.global_academic_audit_log (
    interpretation_id, actor_user_id, action, previous_status,
    resulting_status, idempotency_key, details
  ) values (
    item.id, (select auth.uid()), 'update_candidate', 'awaiting_review',
    'awaiting_review', p_idempotency_key, '{}'::jsonb
  ) on conflict (actor_user_id, action, idempotency_key) do nothing;
  return item;
end;
$$;

create or replace function public.reject_global_academic_candidate(
  p_interpretation_id uuid,
  p_reason text,
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
  if nullif(btrim(p_idempotency_key), '') is null
     or nullif(btrim(p_reason), '') is null then
    raise exception 'Reason and idempotency key are required';
  end if;

  select * into item
  from public.global_academic_interpretations
  where id = p_interpretation_id
  for update;
  if not found then raise exception 'Interpretation not found'; end if;
  if item.publication_status = 'rejected' then return item; end if;
  if item.publication_status <> 'awaiting_review' then
    raise exception 'Only awaiting review candidates can be rejected';
  end if;

  update public.global_academic_interpretations
  set publication_status = 'rejected', updated_at = now()
  where id = item.id
  returning * into item;

  insert into public.global_academic_audit_log (
    interpretation_id, actor_user_id, action, previous_status,
    resulting_status, idempotency_key, details
  ) values (
    item.id, (select auth.uid()), 'reject', 'awaiting_review', 'rejected',
    p_idempotency_key, jsonb_build_object('reason', left(btrim(p_reason), 500))
  ) on conflict (actor_user_id, action, idempotency_key) do nothing;
  return item;
end;
$$;

revoke all on function public.list_global_academic_source_interpretations(uuid) from public, anon;
revoke all on function public.list_global_academic_source_excerpts(uuid) from public, anon;
revoke all on function public.update_global_academic_candidate(uuid, jsonb, text) from public, anon;
revoke all on function public.reject_global_academic_candidate(uuid, text, text) from public, anon;
grant execute on function public.list_global_academic_source_interpretations(uuid) to authenticated;
grant execute on function public.list_global_academic_source_excerpts(uuid) to authenticated;
grant execute on function public.update_global_academic_candidate(uuid, jsonb, text) to authenticated;
grant execute on function public.reject_global_academic_candidate(uuid, text, text) to authenticated;
