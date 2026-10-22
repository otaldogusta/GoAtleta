-- JUR-01: extend the existing deletion job to copies linked by student ID.
-- No backfill or job execution: completed requests require a separate reviewed
-- remediation. Institutional sessions, scores and numeric statistics are kept.
-- This does not erase video media, free-text mentions, local drafts or backups.
create or replace function public.prepare_lgpd_student_anonymization(p_request_id uuid, p_processing_token uuid)
returns table (photo_object_path text)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_request public.data_subject_requests%rowtype;
  v_student public.students%rowtype;
  v_changed_sessions text[];
  v_document record;
begin
  select * into v_request from public.data_subject_requests r
  where r.id = p_request_id and r.processing_token = p_processing_token
    and r.status = 'processing' and r.request_type = 'deletion'
    and r.processing_started_at > now() - interval '10 minutes'
  for update;
  if not found then raise exception 'STALE_PROCESSING_LEASE' using errcode = '55000'; end if;
  if v_request.student_id is null then raise exception 'MISSING_STUDENT_ID' using errcode = '22023'; end if;
  select * into v_student from public.students s where s.id = v_request.student_id for update;
  if not found then raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0002'; end if;

  -- Retain a previous worker's checkpoint, including requests anonymized before
  -- this migration whose Storage cleanup still needs a retry.
  if v_request.anonymized_at is null then
    v_request.cleanup_photo_path := case when v_student.organization_id is not null
      then v_student.organization_id::text || '/' || v_student.id || '/avatar' else null end;
  end if;

  -- Commands serialize on their session. Take those locks before inspecting its
  -- copies so an already-running command cannot commit an old name afterwards.
  perform 1 from public.scouting_sessions s
  where s.organization_id = v_student.organization_id order by s.id for update;

  select coalesce(array_agg(s.id order by s.id), '{}'::text[]) into v_changed_sessions
  from public.scouting_sessions s where s.organization_id = v_student.organization_id and (
    exists (select 1 from public.scouting_actions a where a.session_id = s.id
      and a.organization_id = s.organization_id and a.student_id = v_student.id
      and a.athlete_name is distinct from 'Aluno anonimizado')
    or exists (select 1 from public.scouting_rallies r,
      lateral jsonb_array_elements(r.contacts) c where r.session_id = s.id
      and r.organization_id = s.organization_id and c->>'studentId' = v_student.id
      and c->>'athleteName' is distinct from 'Aluno anonimizado')
    or exists (select 1 from jsonb_array_elements(case
      when jsonb_typeof(s.match_state->'recoveredDraft') = 'array'
        then s.match_state->'recoveredDraft' else '[]'::jsonb end) c
      where c->>'studentId' = v_student.id
        and c->>'athleteName' is distinct from 'Aluno anonimizado')
  );

  -- These steps intentionally also run after an older anonymized_at checkpoint.
  -- Repeating them is harmless and does not overwrite the persisted photo path.
  update public.students set name = 'Aluno anonimizado', phone = '', age = 0,
    login_email = null, student_user_id = null, photo_url = null, birthdate = null,
    cpf_input = '', cpf_masked = null, cpf_hmac = null, cpf_encrypted = null,
    cpf_encryption_version = null, rg = null, rg_normalized = null,
    ra = null, ra_start_year = null, external_id = null, college_course = null,
    address = null, gender_identity = null,
    guardian_name = null, guardian_phone = null, guardian_relation = null,
    guardian_cpf_hmac = null, health_issue = false, health_issue_notes = null,
    medication_use = false, medication_notes = null, health_observations = null
  where public.students.id = v_student.id;

  -- Intakes contain identifiable clinical facts, not aggregate sports stats.
  -- Delete the linked personal intake instead of inventing negative health
  -- answers. Never match orphan intakes or another person by name/email.
  delete from public.athlete_intakes i where i.student_id = v_student.id
    and i.organization_id = v_student.organization_id;

  update public.scouting_actions a set athlete_name = 'Aluno anonimizado'
  where a.student_id = v_student.id and a.organization_id = v_student.organization_id
    and a.athlete_name is distinct from 'Aluno anonimizado';
  update public.scouting_rallies r set contacts = (
    select coalesce(jsonb_agg(case when c->>'studentId' = v_student.id
      then c || jsonb_build_object('athleteName', 'Aluno anonimizado') else c end order by ordinal), '[]'::jsonb)
    from jsonb_array_elements(r.contacts) with ordinality entries(c, ordinal)
  ) where r.organization_id = v_student.organization_id
    and exists (select 1 from jsonb_array_elements(r.contacts) c
      where c->>'studentId' = v_student.id and c->>'athleteName' is distinct from 'Aluno anonimizado');
  update public.scouting_sessions s set
    match_state = case when jsonb_typeof(s.match_state->'recoveredDraft') = 'array' then
      jsonb_set(s.match_state, '{recoveredDraft}', (
        select coalesce(jsonb_agg(case when c->>'studentId' = v_student.id
          then c || jsonb_build_object('athleteName', 'Aluno anonimizado') else c end order by ordinal), '[]'::jsonb)
        from jsonb_array_elements(s.match_state->'recoveredDraft') with ordinality entries(c, ordinal)
      )) else s.match_state end,
    revision = s.revision + 1, updatedat = now()
  where s.organization_id = v_student.organization_id and s.id = any(v_changed_sessions);

  -- The editable video document has an exact studentId, unlike its published
  -- projection. Change only those linked contacts, preserving media/analysis.
  -- Session locks above use the same serialization as the document save RPC.
  for v_document in select d.organization_id, d.session_id, d.fingerprint
    from public.scouting_video_documents d
    where d.organization_id = v_student.organization_id and exists (
      select 1 from jsonb_array_elements(d.document->'contacts') c
      where c->>'studentId' = v_student.id
    ) for update
  loop
    update public.scouting_video_documents d set document = jsonb_set(d.document, '{contacts}', (
      select coalesce(jsonb_agg(case when c->>'studentId' = v_student.id then
        c || jsonb_build_object('athlete', 'Aluno anonimizado', 'studentId', null) else c end order by ordinal), '[]'::jsonb)
      from jsonb_array_elements(d.document->'contacts') with ordinality entries(c, ordinal)
    )), revision = d.revision + 1, mutation_id = 'lgpd_' || gen_random_uuid()::text,
      updated_at = now(), updated_by = null
    where d.organization_id = v_document.organization_id and d.session_id = v_document.session_id
      and d.fingerprint = v_document.fingerprint;
    -- Save checks receipts before expectedRevision. Discard receipts only for
    -- changed documents so replay of the old payload reaches the revision
    -- conflict instead of returning the old identifying contacts to a client.
    delete from public.scouting_video_document_mutations m
    where m.organization_id = v_document.organization_id and m.session_id = v_document.session_id
      and m.fingerprint = v_document.fingerprint;
  end loop;

  update public.student_relationships r set status = 'revoked', revoked_at = now(),
    revocation_reason = 'student_anonymized'
  where r.student_id = v_student.id and r.organization_id = v_student.organization_id
    and r.status = 'active';
  update public.student_relationship_invites i set revoked_at = now(), revocation_reason = 'student_anonymized'
  where i.student_id = v_student.id and i.organization_id = v_student.organization_id
    and i.used_at is null and i.revoked_at is null;
  update public.student_invites i set revoked = true, revoked_at = now()
  where i.student_id = v_student.id and i.organization_id = v_student.organization_id and not i.revoked;
  delete from public.consents c where c.student_id = v_student.id;
  update public.data_subject_requests r set anonymized_at = coalesce(r.anonymized_at, now()),
    cleanup_photo_path = v_request.cleanup_photo_path where r.id = p_request_id;
  return query select v_request.cleanup_photo_path;
end;
$$;
revoke all on function public.prepare_lgpd_student_anonymization(uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_lgpd_student_anonymization(uuid, uuid) to service_role;

-- Describe the completed structured-data work without claiming erasure of all
-- media, external copies or backups. Guards, retry semantics and grants stay the
-- same; this function replacement does not rewrite already-completed requests.
create or replace function public.finish_lgpd_deletion_request(
  p_request_id uuid, p_processing_token uuid, p_error_code text default null
)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare v_changed integer;
begin
  if p_error_code is not null and p_error_code not in
    ('ANONYMIZATION_FAILED', 'PHOTO_CLEANUP_FAILED', 'MISSING_STUDENT_ID', 'STUDENT_NOT_FOUND') then
    raise exception 'INVALID_PROCESSING_ERROR' using errcode = '22023';
  end if;
  update public.data_subject_requests r set
    status = case when p_error_code is null then 'completed' else 'failed' end,
    processed_at = case when p_error_code is null then now() else null end,
    processing_error_code = p_error_code,
    next_attempt_at = case when p_error_code is not null then now() + interval '5 minutes' else null end,
    processing_token = null,
    cleanup_photo_path = case when p_error_code is null then null else r.cleanup_photo_path end,
    reason = case when p_error_code is null then 'Saneamento dos dados estruturados concluído e consentimentos removidos'
      else 'Processamento incompleto; nova tentativa controlada' end
  where r.id = p_request_id and r.processing_token = p_processing_token
    and r.status = 'processing' and r.request_type = 'deletion'
    and (p_error_code is not null or r.anonymized_at is not null);
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end;
$$;
revoke all on function public.finish_lgpd_deletion_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.finish_lgpd_deletion_request(uuid, uuid, text) to service_role;
