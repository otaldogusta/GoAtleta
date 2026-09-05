-- Recoverable jobs. This migration does not process existing requests or students.
alter table public.data_subject_requests
  add column if not exists processing_token uuid,
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_attempts integer not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists processing_error_code text,
  add column if not exists anonymized_at timestamptz,
  add column if not exists cleanup_photo_path text;
alter table public.data_subject_requests drop constraint if exists data_subject_requests_status_check;
alter table public.data_subject_requests add constraint data_subject_requests_status_check
  check (status in ('pending', 'processing', 'completed', 'rejected', 'failed'));

-- RLS controls who may request deletion; worker checkpoints and storage targets
-- must additionally remain server-owned even when a caller can insert a request.
create or replace function private.guard_dsr_worker_state()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then return new; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' or new.processed_at is not null
      or new.processing_token is not null or new.processing_started_at is not null
      or new.processing_attempts <> 0 or new.next_attempt_at is not null
      or new.processing_error_code is not null or new.anonymized_at is not null
      or new.cleanup_photo_path is not null then
      raise exception 'SERVER_OWNED_PROCESSING_STATE' using errcode = '42501';
    end if;
  elsif row(new.id, new.user_id, new.student_id, new.request_type, new.processed_at,
      new.processing_token, new.processing_started_at, new.processing_attempts,
      new.next_attempt_at, new.processing_error_code, new.anonymized_at, new.cleanup_photo_path)
    is distinct from row(old.id, old.user_id, old.student_id, old.request_type, old.processed_at,
      old.processing_token, old.processing_started_at, old.processing_attempts,
      old.next_attempt_at, old.processing_error_code, old.anonymized_at, old.cleanup_photo_path)
    or (new.status is distinct from old.status
      and not (old.status = 'pending' and new.status = 'rejected')) then
    raise exception 'SERVER_OWNED_PROCESSING_STATE' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_dsr_worker_state() from public, anon, authenticated;
drop trigger if exists guard_dsr_worker_state on public.data_subject_requests;
create trigger guard_dsr_worker_state before insert or update on public.data_subject_requests
for each row execute function private.guard_dsr_worker_state();

create or replace function public.claim_lgpd_deletion_requests(p_limit integer default 10)
returns table (id uuid, processing_token uuid)
language plpgsql security invoker set search_path = ''
as $$
begin
  update public.data_subject_requests r set status = 'failed',
    processing_error_code = 'RETRY_LIMIT_REACHED', processing_token = null
  where r.status = 'processing' and r.request_type = 'deletion' and r.processing_attempts >= 5
    and coalesce(r.processing_started_at, r.updated_at, r.requested_at) < now() - interval '10 minutes';
  return query
  with candidates as (
    select r.id from public.data_subject_requests r
    where r.request_type = 'deletion' and r.processing_attempts < 5
      and ((r.status in ('pending', 'failed') and coalesce(r.next_attempt_at, now()) <= now())
        or (r.status = 'processing'
          and coalesce(r.processing_started_at, r.updated_at, r.requested_at) < now() - interval '10 minutes'))
    order by r.requested_at, r.id
    limit greatest(1, least(coalesce(p_limit, 10), 10))
    for update skip locked
  )
  update public.data_subject_requests r set status = 'processing',
    processing_token = gen_random_uuid(), processing_started_at = now(),
    processing_attempts = r.processing_attempts + 1, processing_error_code = null
  from candidates c where r.id = c.id
  returning r.id, r.processing_token;
end;
$$;

create or replace function public.prepare_lgpd_student_anonymization(p_request_id uuid, p_processing_token uuid)
returns table (photo_object_path text)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_request public.data_subject_requests%rowtype;
  v_student public.students%rowtype;
begin
  select * into v_request from public.data_subject_requests r
  where r.id = p_request_id and r.processing_token = p_processing_token
    and r.status = 'processing' and r.request_type = 'deletion'
    and r.processing_started_at > now() - interval '10 minutes'
  for update;
  if not found then raise exception 'STALE_PROCESSING_LEASE' using errcode = '55000'; end if;
  if v_request.student_id is null then raise exception 'MISSING_STUDENT_ID' using errcode = '22023'; end if;
  if v_request.anonymized_at is null then
    select * into v_student from public.students s where s.id = v_request.student_id for update;
    if not found then raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0002'; end if;
    -- The upload API owns one canonical object per student. Do not derive a
    -- service-role deletion target from an arbitrary client-provided URL.
    v_request.cleanup_photo_path := case when v_student.organization_id is not null
      then v_student.organization_id::text || '/' || v_student.id || '/avatar' else null end;
    update public.students set name = 'Aluno anonimizado', phone = '', age = 0,
      login_email = null, student_user_id = null, photo_url = null, birthdate = null,
      cpf_input = '', cpf_masked = null, cpf_hmac = null, cpf_encrypted = null,
      cpf_encryption_version = null, rg = null, rg_normalized = null,
      ra = null, ra_start_year = null, external_id = null,
      guardian_name = null, guardian_phone = null, guardian_relation = null,
      guardian_cpf_hmac = null, health_issue = false, health_issue_notes = null,
      medication_use = false, medication_notes = null, health_observations = null
    where public.students.id = v_request.student_id;
    update public.student_relationships r set status = 'revoked', revoked_at = now(),
      revocation_reason = 'student_anonymized'
    where r.student_id = v_request.student_id and r.organization_id = v_student.organization_id
      and r.status = 'active';
    update public.student_relationship_invites i set revoked_at = now(),
      revocation_reason = 'student_anonymized'
    where i.student_id = v_request.student_id and i.organization_id = v_student.organization_id
      and i.used_at is null and i.revoked_at is null;
    update public.student_invites i set revoked = true, revoked_at = now()
    where i.student_id = v_request.student_id and i.organization_id = v_student.organization_id
      and not i.revoked;
    -- student_scouting_logs holds numeric statistics and has no general_notes.
    delete from public.consents c where c.student_id = v_request.student_id;
    update public.data_subject_requests r set anonymized_at = now(),
      cleanup_photo_path = v_request.cleanup_photo_path where r.id = p_request_id;
  end if;
  return query select v_request.cleanup_photo_path;
end;
$$;

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
    reason = case when p_error_code is null then 'Cadastro anonimizado e consentimentos removidos'
      else 'Processamento incompleto; nova tentativa controlada' end
  where r.id = p_request_id and r.processing_token = p_processing_token
    and r.status = 'processing' and r.request_type = 'deletion'
    and (p_error_code is not null or r.anonymized_at is not null);
  get diagnostics v_changed = row_count;
  return v_changed = 1;
end;
$$;
revoke all on function public.claim_lgpd_deletion_requests(integer) from public, anon, authenticated;
revoke all on function public.prepare_lgpd_student_anonymization(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finish_lgpd_deletion_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_lgpd_deletion_requests(integer) to service_role;
grant execute on function public.prepare_lgpd_student_anonymization(uuid, uuid) to service_role;
grant execute on function public.finish_lgpd_deletion_request(uuid, uuid, text) to service_role;
