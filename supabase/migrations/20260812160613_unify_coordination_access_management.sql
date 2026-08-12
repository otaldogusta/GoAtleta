-- Consolidate organization access review in the coordination workspace.
-- Requests are persisted independently from notifications so the decision is
-- auditable and does not depend on an inbox item still being available.

create table if not exists public.organization_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_email text not null,
  requester_name text,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_role_level int,
  review_idempotency_key uuid,
  resolution_note text,
  constraint organization_access_requests_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint organization_access_requests_role_check
    check (review_role_level is null or review_role_level in (5, 10, 50)),
  constraint organization_access_requests_resolution_check
    check (
      (status = 'pending' and reviewed_at is null and reviewed_by is null)
      or
      (status <> 'pending' and reviewed_at is not null and reviewed_by is not null)
    )
);

create unique index if not exists organization_access_requests_one_pending_idx
  on public.organization_access_requests (organization_id, requester_user_id)
  where status = 'pending';

create index if not exists organization_access_requests_admin_queue_idx
  on public.organization_access_requests (organization_id, status, requested_at desc);

alter table public.organization_access_requests enable row level security;
revoke all on table public.organization_access_requests from anon, authenticated;
grant all on table public.organization_access_requests to service_role;

create or replace function public.admin_list_org_access_requests(p_org_id uuid)
returns table (
  id uuid,
  organization_id uuid,
  requester_user_id uuid,
  requester_email text,
  requester_name text,
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_role_level int
)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    request.id,
    request.organization_id,
    request.requester_user_id,
    request.requester_email,
    request.requester_name,
    request.status,
    request.requested_at,
    request.reviewed_at,
    request.reviewed_by,
    request.review_role_level
  from public.organization_access_requests request
  where request.organization_id = p_org_id
    and request.status = 'pending'
  order by request.requested_at asc, request.id asc;
end;
$$;

create or replace function public.admin_review_org_access_request(
  p_request_id uuid,
  p_decision text,
  p_role_level int,
  p_idempotency_key uuid
)
returns table (
  request_id uuid,
  status text,
  changed boolean,
  member_user_id uuid,
  role_level int,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_request public.organization_access_requests%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_reviewed_at timestamptz := now();
  v_notification_id uuid;
begin
  if v_decision not in ('approved', 'rejected') then
    raise exception 'INVALID_DECISION';
  end if;
  if p_idempotency_key is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if v_decision = 'approved' and p_role_level not in (5, 10, 50) then
    raise exception 'INVALID_ROLE_LEVEL';
  end if;

  select *
    into v_request
  from public.organization_access_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if not public.is_org_admin(v_request.organization_id) then
    raise exception 'Not authorized';
  end if;

  if v_request.status <> 'pending' then
    if v_request.review_idempotency_key = p_idempotency_key then
      return query select
        v_request.id,
        v_request.status,
        false,
        v_request.requester_user_id,
        v_request.review_role_level,
        v_request.reviewed_at;
      return;
    end if;
    raise exception 'REQUEST_ALREADY_REVIEWED';
  end if;

  if v_decision = 'approved' then
    insert into public.trainers (user_id)
    values (v_request.requester_user_id)
    on conflict (user_id) do nothing;

    insert into public.organization_members (organization_id, user_id, role_level)
    values (v_request.organization_id, v_request.requester_user_id, p_role_level)
    on conflict (organization_id, user_id)
    do update set role_level = greatest(
      public.organization_members.role_level,
      excluded.role_level
    );
  end if;

  update public.organization_access_requests
  set
    status = v_decision,
    reviewed_at = v_reviewed_at,
    reviewed_by = auth.uid(),
    review_role_level = case when v_decision = 'approved' then p_role_level else null end,
    review_idempotency_key = p_idempotency_key
  where id = v_request.id;

  insert into public.notifications (
    organization_id,
    recipient_user_id,
    inbox_scope,
    actor_user_id,
    type,
    title,
    body,
    action_url,
    source_type,
    source_id,
    metadata
  )
  values (
    v_request.organization_id,
    v_request.requester_user_id,
    'all',
    auth.uid(),
    'generic',
    case when v_decision = 'approved' then 'Acesso aprovado' else 'Solicitação de acesso recusada' end,
    case
      when v_decision = 'approved' then 'Seu acesso à organização foi liberado.'
      else 'A coordenação revisou sua solicitação. Fale com a organização para mais detalhes.'
    end,
    case when v_decision = 'approved' then '/pending' else '/welcome' end,
    'access_request_review',
    v_request.id::text,
    jsonb_build_object('decision', v_decision, 'roleLevel', p_role_level)
  )
  returning id into v_notification_id;

  return query select
    v_request.id,
    v_decision,
    true,
    v_request.requester_user_id,
    case when v_decision = 'approved' then p_role_level else null end,
    v_reviewed_at;
end;
$$;

revoke all on function public.admin_list_org_access_requests(uuid)
  from public, anon;
revoke all on function public.admin_review_org_access_request(uuid, text, int, uuid)
  from public, anon;
grant execute on function public.admin_list_org_access_requests(uuid)
  to authenticated;
grant execute on function public.admin_review_org_access_request(uuid, text, int, uuid)
  to authenticated;

-- Keep technical claim failures visible to the coordinator without exposing
-- implementation details to the invited person.
alter table public.trainer_invites
  add column if not exists claim_failed_at timestamptz,
  add column if not exists claim_error_code text;

-- The application no longer exposes the old manual release-by-email flow.
-- Keep the RPC temporarily for compatibility with clients that may still have
-- the previous bundle open; it can be removed in a later migration after the
-- new coordination workspace is deployed everywhere.
