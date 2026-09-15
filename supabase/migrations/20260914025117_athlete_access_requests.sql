-- Athlete requests are consent to link a registration, never staff membership.
alter table public.organization_access_requests
  add column request_kind text not null default 'staff'
    check (request_kind in ('staff', 'athlete')),
  add column reviewed_student_id text references public.students(id);

-- Old clients/legacy staff RPCs must not approve an athlete as a trainer.
create function public.guard_athlete_access_review()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.request_kind = 'athlete' and new.status = 'approved' then
    if new.review_role_level is not null or new.reviewed_student_id is null then
      raise exception 'ATHLETE_REQUIRES_STUDENT_LINK';
    end if;
    if not exists (select 1 from public.students s
      where s.id = new.reviewed_student_id and s.organization_id = new.organization_id
        and s.student_user_id = new.requester_user_id and s.deleted_at is null) then
      raise exception 'INVALID_STUDENT_LINK';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_athlete_access_review before update on public.organization_access_requests
  for each row execute function public.guard_athlete_access_review();
revoke all on function public.guard_athlete_access_review() from public, anon, authenticated;

create function public.request_athlete_access(p_org_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_email text; v_name text; v_id uuid;
begin
  select lower(trim(email)), coalesce(nullif(trim(raw_user_meta_data->>'full_name'), ''), email)
    into v_email, v_name from auth.users
    where id = v_user and not coalesce(is_anonymous, false)
      and (nullif(trim(raw_app_meta_data->>'email_verified_hybrid_at'),'') is not null
        or raw_app_meta_data->>'provider' in ('google','apple','facebook')
        or coalesce(raw_app_meta_data->'providers','[]'::jsonb) ?| array['google','apple','facebook']);
  if v_email is null then raise exception 'Confirme seu e-mail antes de solicitar o vínculo.'; end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'Instituição não encontrada.';
  end if;
  -- An explicit athlete submission also corrects a still-pending legacy request.
  insert into public.organization_access_requests
    (organization_id, requester_user_id, requester_email, requester_name, request_kind)
  values (p_org_id, v_user, v_email, v_name, 'athlete')
  on conflict (organization_id, requester_user_id) where status = 'pending'
  do update set request_kind = 'athlete'
  returning id into v_id;
  insert into public.notifications
    (organization_id, recipient_user_id, inbox_scope, actor_user_id, type, title, body,
     action_url, source_type, source_id)
  select p_org_id, m.user_id, 'coord', v_user, 'generic', 'Solicitação de vínculo de atleta',
    v_name || ' aguarda vínculo ao cadastro de atleta.',
    '/coord/management?accessRequestId=' || v_id::text, 'access_request', v_id::text
  from public.organization_members m where m.organization_id = p_org_id and m.role_level >= 50
    and not exists (select 1 from public.notifications n where n.organization_id = p_org_id
      and n.recipient_user_id = m.user_id and n.inbox_scope = 'coord'
      and n.source_type = 'access_request' and n.source_id = v_id::text)
  on conflict do nothing;
  return v_id;
end;
$$;

-- One versioned read contract for each audience, with no cross-org fallback.
create function public.list_access_requests_v2(p_scope text, p_org_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if p_scope is null or p_scope not in ('self','coord','platform') then raise exception 'INVALID_SCOPE'; end if;
  if p_scope = 'coord' and not coalesce(public.is_org_admin(p_org_id), false) then raise exception 'Not authorized'; end if;
  if p_scope = 'platform' and not coalesce(public.is_platform_admin(), false) then raise exception 'Not authorized'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('organization_name', o.name) order by r.requested_at desc)
    from public.organization_access_requests r join public.organizations o on o.id = r.organization_id
    where (p_scope = 'self' and r.requester_user_id = auth.uid())
       or (p_scope = 'coord' and r.organization_id = p_org_id and r.status = 'pending')
       or p_scope = 'platform'), '[]'::jsonb);
end;
$$;

create function public.list_athlete_request_candidates(p_request_id uuid)
returns table(id text, name text, class_name text)
language plpgsql stable security definer set search_path = '' as $$
declare v_request public.organization_access_requests%rowtype;
begin
  select * into v_request from public.organization_access_requests where organization_access_requests.id = p_request_id;
  if auth.uid() is null or not coalesce(public.is_org_admin(v_request.organization_id), false) then raise exception 'Not authorized'; end if;
  if v_request.request_kind <> 'athlete' or v_request.status <> 'pending' then raise exception 'INVALID_REQUEST'; end if;
  return query select s.id, s.name, coalesce(c.name, 'Sem turma')
    from public.students s left join public.classes c on c.id = s.classid and c.organization_id = s.organization_id
    where s.organization_id = v_request.organization_id and s.deleted_at is null
      and s.membership_status = 'active' and s.student_access_revoked_at is null
      and (s.student_user_id is null or s.student_user_id = v_request.requester_user_id)
    order by s.name, s.id;
end;
$$;

create function public.review_athlete_access_request(p_request_id uuid, p_decision text, p_student_id text, p_idempotency_key uuid)
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
      or v_student.deleted_at is not null or v_student.membership_status <> 'active'
      or v_student.student_access_revoked_at is not null then raise exception 'Selecione um cadastro ativo desta instituição.'; end if;
    if v_student.student_user_id is not null and v_student.student_user_id <> v_request.requester_user_id then
      raise exception 'Este atleta já está vinculado a outra conta.';
    end if;
    if exists (select 1 from public.students where student_user_id = v_request.requester_user_id
      and organization_id = v_request.organization_id and id <> p_student_id and deleted_at is null) then
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
revoke all on function public.request_athlete_access(uuid), public.list_access_requests_v2(text,uuid),
  public.list_athlete_request_candidates(uuid), public.review_athlete_access_request(uuid,text,text,uuid) from public, anon;
grant execute on function public.request_athlete_access(uuid), public.list_access_requests_v2(text,uuid),
  public.list_athlete_request_candidates(uuid), public.review_athlete_access_request(uuid,text,text,uuid) to authenticated;
