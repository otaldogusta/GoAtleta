-- Self-service organization discovery plus platform-wide access governance.
-- Platform authorization is stored server-side; app_metadata is accepted only
-- as a bootstrap path because users cannot edit it themselves.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.platform_admins enable row level security;
revoke all on table public.platform_admins from public, anon, authenticated;
grant all on table public.platform_admins to service_role;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.platform_admins admin
      where admin.user_id = auth.uid()
    )
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'platform_admin')::boolean, false)
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

alter table public.organization_access_requests
  add column if not exists requested_product text not null default 'goatleta',
  add column if not exists payment_status text not null default 'not_started';

alter table public.organization_access_requests
  drop constraint if exists organization_access_requests_product_check,
  add constraint organization_access_requests_product_check
    check (requested_product in ('goatleta', 'goatleta_pro')),
  drop constraint if exists organization_access_requests_payment_status_check,
  add constraint organization_access_requests_payment_status_check
    check (payment_status in ('not_started', 'pending', 'paid', 'overdue'));

create or replace function public.search_access_request_organizations(p_query text default '')
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select organization.id, organization.name
  from public.organizations organization
  where auth.uid() is not null
    and (
      nullif(trim(coalesce(p_query, '')), '') is null
      or organization.name ilike '%' || trim(p_query) || '%'
    )
  order by organization.name asc
  limit 20;
$$;

create or replace function public.list_my_organization_access_requests()
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  status text,
  requested_product text,
  payment_status text,
  requested_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select request.id, request.organization_id, organization.name,
    request.status, request.requested_product, request.payment_status,
    request.requested_at, request.reviewed_at
  from public.organization_access_requests request
  join public.organizations organization on organization.id = request.organization_id
  where request.requester_user_id = auth.uid()
  order by request.requested_at desc;
$$;

create or replace function public.platform_list_access_requests()
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  requester_user_id uuid,
  requester_email text,
  requester_name text,
  status text,
  requested_product text,
  payment_status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_role_level int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  return query
  select request.id, request.organization_id, organization.name,
    request.requester_user_id, request.requester_email, request.requester_name,
    request.status, request.requested_product, request.payment_status,
    request.requested_at, request.reviewed_at, request.reviewed_by,
    request.review_role_level
  from public.organization_access_requests request
  join public.organizations organization on organization.id = request.organization_id
  order by
    case request.status when 'pending' then 0 else 1 end,
    request.requested_at desc;
end;
$$;

revoke all on function public.search_access_request_organizations(text) from public, anon;
revoke all on function public.list_my_organization_access_requests() from public, anon;
revoke all on function public.platform_list_access_requests() from public, anon;
grant execute on function public.search_access_request_organizations(text) to authenticated;
grant execute on function public.list_my_organization_access_requests() to authenticated;
grant execute on function public.platform_list_access_requests() to authenticated;

create or replace function public.platform_review_access_request(
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
begin
  if not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if v_decision not in ('approved', 'rejected') then raise exception 'INVALID_DECISION'; end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if v_decision = 'approved' and p_role_level not in (5, 10, 50) then
    raise exception 'INVALID_ROLE_LEVEL';
  end if;

  select * into v_request
  from public.organization_access_requests
  where id = p_request_id
  for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;

  if v_request.status <> 'pending' then
    if v_request.review_idempotency_key = p_idempotency_key then
      return query select v_request.id, v_request.status, false,
        v_request.requester_user_id, v_request.review_role_level, v_request.reviewed_at;
      return;
    end if;
    raise exception 'REQUEST_ALREADY_REVIEWED';
  end if;

  if v_decision = 'approved' then
    insert into public.trainers (user_id) values (v_request.requester_user_id)
    on conflict (user_id) do nothing;
    insert into public.organization_members (organization_id, user_id, role_level)
    values (v_request.organization_id, v_request.requester_user_id, p_role_level)
    on conflict (organization_id, user_id) do update
      set role_level = greatest(public.organization_members.role_level, excluded.role_level);
  end if;

  update public.organization_access_requests
  set status = v_decision,
      reviewed_at = v_reviewed_at,
      reviewed_by = auth.uid(),
      review_role_level = case when v_decision = 'approved' then p_role_level else null end,
      review_idempotency_key = p_idempotency_key
  where id = v_request.id;

  insert into public.notifications (
    organization_id, recipient_user_id, inbox_scope, actor_user_id, type,
    title, body, action_url, source_type, source_id, metadata
  ) values (
    v_request.organization_id, v_request.requester_user_id, 'all', auth.uid(), 'generic',
    case when v_decision = 'approved' then 'Acesso aprovado' else 'Solicitação recusada' end,
    case when v_decision = 'approved' then 'Seu acesso à organização foi liberado.' else 'Sua solicitação foi revisada.' end,
    case when v_decision = 'approved' then '/pending' else '/pending' end,
    'access_request_review', v_request.id::text,
    jsonb_build_object('decision', v_decision, 'roleLevel', p_role_level)
  );

  return query select v_request.id, v_decision, true,
    v_request.requester_user_id,
    case when v_decision = 'approved' then p_role_level else null end,
    v_reviewed_at;
end;
$$;

revoke all on function public.platform_review_access_request(uuid, text, int, uuid)
  from public, anon;
grant execute on function public.platform_review_access_request(uuid, text, int, uuid)
  to authenticated;

comment on table public.platform_admins is
  'Trusted GoAtleta platform operators. Populate only through a service-role administrative process.';
