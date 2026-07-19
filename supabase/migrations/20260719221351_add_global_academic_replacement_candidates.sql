-- Allow a curator to prepare a corrected version without mutating an
-- immutable published, withdrawn or blocked interpretation.
--
-- The source revision row is locked so concurrent requests for the same
-- document serialize before choosing the next publication version.
create or replace function public.create_global_academic_candidate(
  p_source_revision_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
returns public.global_academic_interpretations
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid;
  source_row public.document_sources;
  revision_row public.document_source_revisions;
  item public.global_academic_interpretations;
  authors_value text[];
  limitations_value text[];
  identity_value text;
  year_value integer;
  next_publication_version integer;
begin
  actor_user_id := (select auth.uid());
  if actor_user_id is null
     or not public.has_global_capability('manage_global_academic_knowledge') then
    raise exception 'Not authorized';
  end if;
  if nullif(btrim(p_idempotency_key), '') is null
     or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid candidate request';
  end if;

  -- A repeated request returns the interpretation recorded by the first
  -- successful transaction instead of creating another publication version.
  select interpretation.* into item
  from public.global_academic_audit_log audit
  join public.global_academic_interpretations interpretation
    on interpretation.id = audit.interpretation_id
  where audit.actor_user_id = actor_user_id
    and audit.action = 'save_candidate'
    and audit.idempotency_key = p_idempotency_key
  limit 1;
  if found then
    return item;
  end if;

  select * into revision_row
  from public.document_source_revisions
  where id = p_source_revision_id
  for update;
  if not found or revision_row.extraction_status <> 'ready' then
    raise exception 'Only ready revisions can be curated';
  end if;

  select * into source_row
  from public.document_sources
  where id = revision_row.source_id
  for share;
  if not found or source_row.source_scope <> 'user_academic'
     or source_row.owner_user_id <> actor_user_id then
    raise exception 'Private academic source is outside curator scope';
  end if;

  select coalesce(array_agg(value), '{}'::text[]) into authors_value
  from jsonb_array_elements_text(coalesce(p_payload->'authors', '[]'::jsonb));
  select coalesce(array_agg(value), '{}'::text[]) into limitations_value
  from jsonb_array_elements_text(coalesce(p_payload->'limitations', '[]'::jsonb));
  year_value := nullif(p_payload->>'publicationYear', '')::integer;
  identity_value := public.canonical_academic_public_identity(
    p_payload->>'doi',
    authors_value,
    year_value,
    p_payload->>'title',
    p_payload->>'publicationVenue'
  );

  select interpretation.* into item
  from public.global_academic_interpretations interpretation
  where interpretation.source_revision_id = revision_row.id
    and interpretation.public_identity_id = identity_value
  order by interpretation.publication_version desc, interpretation.created_at desc
  limit 1
  for update;

  if found and item.publication_status = 'awaiting_review' then
    update public.global_academic_interpretations set
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
      evidence_level = coalesce(
        nullif(p_payload->>'evidenceLevel', ''),
        'unknown_support'
      ),
      license_code = nullif(btrim(p_payload->>'licenseCode'), ''),
      classification_confidence = coalesce(
        (p_payload->>'classificationConfidence')::numeric,
        0
      ),
      administrative_excerpt = left(
        nullif(btrim(p_payload->>'administrativeExcerpt'), ''),
        600
      ),
      updated_at = now()
    where id = item.id
    returning * into item;
  else
    next_publication_version := coalesce(item.publication_version, 0) + 1;
    insert into public.global_academic_interpretations (
      public_identity_id,
      claim,
      practical_application,
      limitations,
      citation_label,
      authors,
      publication_year,
      title,
      publication_venue,
      doi,
      official_url,
      material_type,
      evidence_level,
      license_code,
      classification_confidence,
      source_document_id,
      source_revision_id,
      source_content_hash,
      administrative_excerpt,
      publication_version,
      created_by
    ) values (
      identity_value,
      nullif(btrim(p_payload->>'claim'), ''),
      nullif(btrim(p_payload->>'practicalApplication'), ''),
      limitations_value,
      nullif(btrim(p_payload->>'citationLabel'), ''),
      authors_value,
      year_value,
      nullif(btrim(p_payload->>'title'), ''),
      nullif(btrim(p_payload->>'publicationVenue'), ''),
      nullif(btrim(p_payload->>'doi'), ''),
      nullif(btrim(p_payload->>'officialUrl'), ''),
      coalesce(nullif(p_payload->>'materialType', ''), 'unknown'),
      coalesce(nullif(p_payload->>'evidenceLevel', ''), 'unknown_support'),
      nullif(btrim(p_payload->>'licenseCode'), ''),
      coalesce((p_payload->>'classificationConfidence')::numeric, 0),
      source_row.id,
      revision_row.id,
      revision_row.content_hash,
      left(nullif(btrim(p_payload->>'administrativeExcerpt'), ''), 600),
      next_publication_version,
      actor_user_id
    )
    returning * into item;
  end if;

  insert into public.global_academic_audit_log (
    interpretation_id,
    actor_user_id,
    action,
    resulting_status,
    idempotency_key,
    details
  ) values (
    item.id,
    actor_user_id,
    'save_candidate',
    'awaiting_review',
    p_idempotency_key,
    jsonb_build_object(
      'publicationVersion',
      item.publication_version,
      'sourceRevisionId',
      revision_row.id
    )
  );

  return item;
end;
$$;

revoke all on function public.create_global_academic_candidate(uuid, jsonb, text)
  from public, anon;
grant execute on function public.create_global_academic_candidate(uuid, jsonb, text)
  to authenticated;
