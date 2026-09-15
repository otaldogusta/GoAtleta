-- Repair legacy request functions against the actual students lifecycle schema.
create or replace function public.guard_athlete_access_review()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.request_kind = 'athlete' and new.status = 'approved' then
    if new.review_role_level is not null or new.reviewed_student_id is null then
      raise exception 'ATHLETE_REQUIRES_STUDENT_LINK';
    end if;
    if not exists (select 1 from public.students s
      where s.id = new.reviewed_student_id and s.organization_id = new.organization_id
        and s.student_user_id = new.requester_user_id) then
      raise exception 'INVALID_STUDENT_LINK';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.list_athlete_request_candidates(p_request_id uuid)
returns table(id text, name text, class_name text)
language plpgsql stable security definer set search_path = '' as $$
declare v_request public.organization_access_requests%rowtype;
begin
  select * into v_request from public.organization_access_requests where organization_access_requests.id = p_request_id;
  if auth.uid() is null or not coalesce(public.is_org_admin(v_request.organization_id), false) then raise exception 'Not authorized'; end if;
  if v_request.request_kind <> 'athlete' or v_request.status <> 'pending' then raise exception 'INVALID_REQUEST'; end if;
  return query select s.id, s.name, coalesce(c.name, 'Sem turma')
    from public.students s left join public.classes c on c.id = s.classid and c.organization_id = s.organization_id
    where s.organization_id = v_request.organization_id
      and s.membership_status = 'active' and s.student_access_revoked_at is null
      and (s.student_user_id is null or s.student_user_id = v_request.requester_user_id)
    order by s.name, s.id;
end;
$$;

create or replace function public.review_athlete_access_request(p_request_id uuid, p_decision text, p_student_id text, p_idempotency_key uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_request public.organization_access_requests%rowtype; v_student public.students%rowtype;
begin
  select * into v_request from public.organization_access_requests where id = p_request_id for update;
  if auth.uid() is null or not coalesce(public.is_org_admin(v_request.organization_id), false) then raise exception 'Not authorized'; end if;
  if v_request.request_kind <> 'athlete' then raise exception 'INVALID_REQUEST'; end if;
  if p_decision is null or p_decision not in ('approved','rejected') or p_idempotency_key is null then raise exception 'INVALID_DECISION'; end if;
  if v_request.status <> 'pending' then
    if v_request.review_idempotency_key = p_idempotency_key then return false; end if;
    raise exception 'Solicitação já revisada.';
  end if;
  if p_decision = 'approved' then
    -- Serialize simultaneous links for this account without trusting client identity.
    perform 1 from auth.users where id = v_request.requester_user_id for update;
    select * into v_student from public.students where id = p_student_id for update;
    if not found or v_student.organization_id <> v_request.organization_id
      or v_student.membership_status <> 'active'
      or v_student.student_access_revoked_at is not null then raise exception 'Selecione um cadastro ativo desta instituição.'; end if;
    if v_student.student_user_id is not null and v_student.student_user_id <> v_request.requester_user_id then
      raise exception 'Este atleta já está vinculado a outra conta.';
    end if;
    if exists (select 1 from public.students where student_user_id = v_request.requester_user_id
      and organization_id = v_request.organization_id and id <> p_student_id) then
      raise exception 'Esta conta já possui outro cadastro nesta instituição.';
    end if;
    update public.students set student_user_id = v_request.requester_user_id,
      login_email = coalesce(login_email, v_request.requester_email) where id = p_student_id;
  end if;
  update public.organization_access_requests set status = p_decision, reviewed_at = now(), reviewed_by = auth.uid(),
    review_role_level = null, reviewed_student_id = case when p_decision = 'approved' then p_student_id end,
    review_idempotency_key = p_idempotency_key where id = p_request_id;
  insert into public.notifications
    (organization_id,recipient_user_id,inbox_scope,actor_user_id,type,title,body,action_url,source_type,source_id)
  values (v_request.organization_id,v_request.requester_user_id,'all',auth.uid(),'generic',
    case when p_decision = 'approved' then 'Vínculo de atleta aprovado' else 'Solicitação de vínculo recusada' end,
    case when p_decision = 'approved' then 'Seu cadastro foi vinculado à instituição.' else 'Fale com a coordenação para mais detalhes.' end,
    '/pending?returnTo=%2Fstudent%2Fprofile','access_request_review',p_request_id::text);
  return true;
end;
$$;

-- Local-only successor to athlete requests. No historical rows are reclassified.
alter table public.organization_access_requests
  drop constraint organization_access_requests_request_kind_check,
  add constraint organization_access_requests_request_kind_check check (request_kind in ('staff','athlete','guardian')),
  add column requested_student_name text check (char_length(requested_student_name) between 1 and 160),
  add column requested_relationship_label text check (char_length(requested_relationship_label) between 1 and 80),
  add column request_kind_corrected_at timestamptz,
  add column request_kind_corrected_by uuid references auth.users(id);

-- Explicit correction is audited and never grants access. The next review must select a student.
create function public.correct_family_request_kind(p_request_id uuid,p_kind text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.organization_access_requests%rowtype;
begin
  select * into r from public.organization_access_requests where id=p_request_id for update;
  if auth.uid() is null or not coalesce(public.is_org_admin(r.organization_id),false) then raise exception 'Not authorized'; end if;
  if r.status <> 'pending' or p_kind is null or p_kind not in ('athlete','guardian') then raise exception 'INVALID_REQUEST'; end if;
  if r.request_kind=p_kind then return false; end if;
  update public.organization_access_requests set request_kind=p_kind,review_role_level=null,reviewed_student_id=null,
    request_kind_corrected_at=now(),request_kind_corrected_by=auth.uid() where id=p_request_id;
  return true;
end;
$$;
revoke all on function public.correct_family_request_kind(uuid,text) from public,anon;
grant execute on function public.correct_family_request_kind(uuid,text) to authenticated;

create function public.request_family_access(p_org_id uuid, p_kind text, p_student_name text, p_relationship_label text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_existing public.organization_access_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_kind is null or p_kind not in ('athlete','guardian') then raise exception 'INVALID_REQUEST_KIND'; end if;
  if nullif(trim(p_student_name),'') is null or char_length(trim(p_student_name)) > 160 then raise exception 'Informe o nome do atleta.'; end if;
  if p_kind = 'guardian' and (nullif(trim(p_relationship_label),'') is null or char_length(trim(p_relationship_label)) > 80) then raise exception 'Informe o parentesco.'; end if;
  perform 1 from auth.users where id = auth.uid() for update;
  select * into v_existing from public.organization_access_requests
    where organization_id = p_org_id and requester_user_id = auth.uid() and status = 'pending' for update;
  if found and v_existing.request_kind <> 'staff' and
    (v_existing.request_kind <> p_kind or (v_existing.requested_student_name is not null and lower(v_existing.requested_student_name) <> lower(trim(p_student_name)))) then
    raise exception 'Já existe um pedido pendente nesta instituição. Aguarde a revisão antes de solicitar outro vínculo.';
  end if;
  -- Reuse verified-account validation and notification deduplication.
  v_id := public.request_athlete_access(p_org_id);
  update public.organization_access_requests set request_kind = p_kind,
    requested_student_name = trim(p_student_name),
    requested_relationship_label = case when p_kind = 'guardian' then trim(p_relationship_label) end,
    request_kind_corrected_at = case when v_existing.request_kind='staff' then now() else request_kind_corrected_at end,
    request_kind_corrected_by = case when v_existing.request_kind='staff' then auth.uid() else request_kind_corrected_by end
    where id = v_id;
  update public.notifications set title = 'Solicitação de vínculo', body = 'Uma solicitação de atleta ou responsável aguarda revisão.'
    where organization_id = p_org_id and source_type = 'access_request' and source_id = v_id::text;
  return v_id;
end;
$$;

create function public.list_family_request_candidates(p_request_id uuid)
returns table(id text, name text, class_name text, class_days integer[], class_start_time text)
language plpgsql stable security definer set search_path = '' as $$
declare r public.organization_access_requests%rowtype;
begin
  select * into r from public.organization_access_requests where organization_access_requests.id = p_request_id;
  if auth.uid() is null or not coalesce(public.is_org_admin(r.organization_id),false) then raise exception 'Not authorized'; end if;
  if r.status <> 'pending' or r.request_kind not in ('athlete','guardian') then raise exception 'INVALID_REQUEST'; end if;
  return query select s.id, s.name, coalesce(c.name,'Sem turma'),
    array(select d.value::integer from jsonb_array_elements_text(case when jsonb_typeof(c.days) = 'array' then c.days else '[]'::jsonb end) as d(value) where d.value ~ '^[0-6]$'),
    c.starttime::text from public.students s
    left join public.classes c on c.id = s.classid and c.organization_id = s.organization_id
    where s.organization_id = r.organization_id and s.membership_status = 'active'
    and s.student_access_revoked_at is null
    and (r.request_kind = 'guardian' or s.student_user_id is null or s.student_user_id = r.requester_user_id)
    order by s.name, s.id;
end;
$$;

create function public.guard_family_request_review()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.request_kind = 'guardian' and new.status = 'approved' then
    if new.review_role_level is not null or not exists (
      select 1 from public.student_relationships r where r.organization_id = new.organization_id
      and r.student_id = new.reviewed_student_id and r.user_id = new.requester_user_id
      and r.relationship_kind = 'guardian' and r.status = 'active'
    ) then raise exception 'GUARDIAN_REQUIRES_REVIEWED_RELATIONSHIP'; end if;
  end if;
  return new;
end;
$$;
create trigger guard_family_request_review before update on public.organization_access_requests
  for each row execute function public.guard_family_request_review();
revoke all on function public.guard_family_request_review() from public, anon, authenticated;

create function public.review_family_access_request(p_request_id uuid, p_decision text, p_student_id text, p_idempotency_key uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.organization_access_requests%rowtype; s public.students%rowtype; v_changed boolean;
begin
  -- Match request creation's account -> request lock order.
  select * into r from public.organization_access_requests where id = p_request_id;
  if auth.uid() is null or not coalesce(public.is_org_admin(r.organization_id),false) then raise exception 'Not authorized'; end if;
  perform 1 from auth.users where id = r.requester_user_id for update;
  select * into r from public.organization_access_requests where id = p_request_id for update;
  if auth.uid() is null or not coalesce(public.is_org_admin(r.organization_id),false) then raise exception 'Not authorized'; end if;
  if r.request_kind not in ('athlete','guardian') then raise exception 'INVALID_REQUEST'; end if;
  if p_decision is null or p_decision not in ('approved','rejected') or p_idempotency_key is null then raise exception 'INVALID_DECISION'; end if;
  if r.status <> 'pending' then
    if r.review_idempotency_key = p_idempotency_key and r.status = p_decision
      and (p_decision = 'rejected' or r.reviewed_student_id = p_student_id) then return false; end if;
    raise exception 'Solicitação já revisada.';
  end if;
  if p_decision = 'approved' then
    perform 1 from auth.users where id = r.requester_user_id for update;
    select * into s from public.students where id = p_student_id for update;
    if not found or s.organization_id <> r.organization_id
      or s.membership_status <> 'active' or s.student_access_revoked_at is not null then raise exception 'Selecione um cadastro ativo desta instituição.'; end if;
    if exists (select 1 from public.student_relationships x where x.organization_id = r.organization_id
      and x.student_id = p_student_id and x.user_id = r.requester_user_id
      and (x.status = 'revoked' or x.relationship_kind <> r.request_kind)) then
      raise exception 'Existe um vínculo diferente ou revogado. Revise-o na gestão de vínculos.';
    end if;
    if r.request_kind = 'athlete' and exists (select 1 from public.student_relationships x
      where x.organization_id = r.organization_id and x.student_id = p_student_id
      and x.relationship_kind = 'athlete' and x.status = 'active' and x.user_id is distinct from r.requester_user_id) then
      raise exception 'Este atleta já está vinculado a outra conta.';
    end if;
  end if;
  if r.request_kind = 'athlete' then
    v_changed := public.review_athlete_access_request(p_request_id,p_decision,p_student_id,p_idempotency_key);
  end if;
  if p_decision = 'approved' then
    insert into public.student_relationships (organization_id,student_id,user_id,contact_email,relationship_kind,
      relationship_label,created_by,can_view_profile,can_view_schedule,can_view_attendance,can_view_progress)
    values (r.organization_id,p_student_id,r.requester_user_id,r.requester_email,r.request_kind,
      r.requested_relationship_label,auth.uid(),true,true,true,true)
    on conflict (organization_id,student_id,user_id) where status = 'active' do nothing;
  end if;
  if r.request_kind = 'guardian' then
    update public.organization_access_requests set status=p_decision,reviewed_at=now(),reviewed_by=auth.uid(),
      review_role_level=null,reviewed_student_id=case when p_decision='approved' then p_student_id end,
      review_idempotency_key=p_idempotency_key where id=p_request_id;
    insert into public.notifications (organization_id,recipient_user_id,inbox_scope,actor_user_id,type,title,body,action_url,source_type,source_id)
      values (r.organization_id,r.requester_user_id,'all',auth.uid(),'generic',
        case when p_decision='approved' then 'Vínculo de responsável aprovado' else 'Solicitação recusada' end,
        'Confira o resultado da solicitação.','/pending','access_request_review',p_request_id::text);
  end if;
  return true;
end;
$$;
revoke all on function public.request_family_access(uuid,text,text,text), public.list_family_request_candidates(uuid),
  public.review_family_access_request(uuid,text,text,uuid) from public,anon;
grant execute on function public.request_family_access(uuid,text,text,text), public.list_family_request_candidates(uuid),
  public.review_family_access_request(uuid,text,text,uuid) to authenticated;

alter table public.student_relationship_invites add column guardian_issuer_relationship_id uuid
  references public.student_relationships(id);

create function public.create_guardian_athlete_invite(p_org_id uuid,p_student_id text,p_token_hash text,p_invited_email text)
returns table(invite_id uuid,expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare g public.student_relationships%rowtype; s public.students%rowtype; v_email text := lower(trim(p_invited_email));
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVITE_TOKEN_HASH_INVALID'; end if;
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVITE_EMAIL_REQUIRED'; end if;
  select * into s from public.students where id=p_student_id and organization_id=p_org_id for update;
  if not found or s.membership_status <> 'active' or s.student_access_revoked_at is not null then raise exception 'STUDENT_NOT_FOUND'; end if;
  select * into g from public.student_relationships where organization_id=p_org_id and student_id=p_student_id
    and user_id=auth.uid() and relationship_kind='guardian' and status='active' and created_by is not null for update;
  if not found then raise exception 'NOT_AUTHORIZED'; end if;
  if s.student_user_id is not null or exists(select 1 from public.student_relationships
    where organization_id=p_org_id and student_id=p_student_id and relationship_kind='athlete' and status='active') then raise exception 'ATHLETE_ALREADY_LINKED'; end if;
  if exists(select 1 from auth.users where id=auth.uid() and lower(email)=v_email) then raise exception 'INVITE_EMAIL_MISMATCH'; end if;
  update public.student_relationship_invites set revoked_at=now(),revoked_by=auth.uid(),revocation_reason='superseded'
    where organization_id=p_org_id and student_id=p_student_id and invited_email=v_email
    and relationship_kind='athlete' and used_at is null and revoked_at is null;
  return query insert into public.student_relationship_invites
    (organization_id,student_id,token_hash,invited_email,invited_via,relationship_kind,created_by,
      guardian_issuer_relationship_id,can_view_profile,can_view_schedule,can_view_attendance,can_view_progress)
    values(p_org_id,p_student_id,p_token_hash,v_email,'link','athlete',auth.uid(),g.id,true,true,true,true)
    returning student_relationship_invites.id,student_relationship_invites.expires_at;
end;
$$;
revoke all on function public.create_guardian_athlete_invite(uuid,text,text,text) from public,anon;
grant execute on function public.create_guardian_athlete_invite(uuid,text,text,text) to authenticated;

-- Claim remains service-only: identity is supplied by the verified Edge Function.
alter function public.claim_student_relationship_invite_v1(text,uuid,text) rename to claim_student_relationship_invite_core;
revoke all on function public.claim_student_relationship_invite_core(text,uuid,text) from public,anon,authenticated,service_role;
create function public.claim_student_relationship_invite_v1(p_token_hash text,p_user_id uuid,p_user_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare i public.student_relationship_invites%rowtype; s public.students%rowtype;
  existing public.student_relationships%rowtype; receipt jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(lower(p_token_hash),0));
  select * into i from public.student_relationship_invites where token_hash=lower(p_token_hash);
  if not found then raise exception 'INVITE_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(i.student_id,0));
  select * into s from public.students where id=i.student_id and organization_id=i.organization_id for update;
  if not found or s.membership_status <> 'active' or s.student_access_revoked_at is not null then raise exception 'STUDENT_NOT_FOUND'; end if;
  -- Match invitation creation's student -> invitation lock order.
  select * into i from public.student_relationship_invites where token_hash=lower(p_token_hash) for update;
  if not found or i.student_id <> s.id or i.organization_id <> s.organization_id then raise exception 'INVITE_INVALID'; end if;
  if p_user_id is null or nullif(trim(p_user_email),'') is null or i.invited_email <> lower(trim(p_user_email)) then raise exception 'INVITE_EMAIL_MISMATCH'; end if;
  if i.guardian_issuer_relationship_id is not null then
    perform 1 from public.student_relationships where id=i.guardian_issuer_relationship_id
      and organization_id=i.organization_id and student_id=i.student_id and user_id=i.created_by
      and relationship_kind='guardian' and status='active' for update;
    if not found then raise exception 'INVITE_REVOKED'; end if;
  end if;
  if i.used_at is null and i.revoked_at is null and i.expires_at > now() and i.relationship_kind='athlete'
    and (s.student_user_id is not null and s.student_user_id <> p_user_id or exists (
      select 1 from public.student_relationships where organization_id=i.organization_id and student_id=i.student_id
      and relationship_kind='athlete' and status='active' and user_id is distinct from p_user_id
    )) then
    -- Return a conflict receipt rather than raising: the notification must commit, but no access changes.
    insert into public.notifications(organization_id,recipient_user_id,inbox_scope,actor_user_id,type,title,body,action_url,source_type,source_id)
      select i.organization_id,m.user_id,'all',p_user_id,'generic','Conferir vínculo do atleta',
        'Um convite encontrou outro acesso vinculado ao cadastro. Revise na gestão familiar.',
        '/coord/family-access','family_invite_conflict',i.id::text
      from public.organization_members m where m.organization_id=i.organization_id and m.role_level>=50
      and not exists(select 1 from public.notifications n where n.organization_id=i.organization_id
        and n.recipient_user_id=m.user_id and n.source_type='family_invite_conflict' and n.source_id=i.id::text);
    return jsonb_build_object('status','conflict');
  end if;
  if exists(select 1 from public.student_relationships where organization_id=i.organization_id
    and student_id=i.student_id and user_id=p_user_id and (status='revoked' or relationship_kind<>i.relationship_kind)) then
    raise exception 'RELATIONSHIP_CONFLICT';
  end if;
  select * into existing from public.student_relationships where organization_id=i.organization_id
    and student_id=i.student_id and user_id=p_user_id and status='active' for update;
  receipt := public.claim_student_relationship_invite_core(p_token_hash,p_user_id,p_user_email);
  if existing.id is not null then
    update public.student_relationships set can_view_profile=existing.can_view_profile,
      can_view_schedule=existing.can_view_schedule,can_view_attendance=existing.can_view_attendance,
      can_view_progress=existing.can_view_progress,can_view_health=existing.can_view_health,
      can_sign_consents=existing.can_sign_consents,can_view_financial=existing.can_view_financial,
      can_pay=existing.can_pay,relationship_label=existing.relationship_label where id=existing.id;
  end if;
  return receipt;
end;
$$;
revoke all on function public.claim_student_relationship_invite_v1(text,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_student_relationship_invite_v1(text,uuid,text) to service_role;
