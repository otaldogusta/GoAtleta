-- Discovery is independent of publishing to families with a current relationship.
alter table public.family_plan_offers
  add column discoverable boolean not null default false,
  add constraint family_plan_offers_discoverable_requires_publication check (not discoverable or published);

-- Keep the submitted terms as part of the access request's history.
create table private.family_enrollment_selections (
  request_id uuid primary key references public.organization_access_requests(id) on delete cascade,
  student_name text not null,
  offer_id uuid not null,
  kind text not null check (kind in ('enrollment', 'monthly')),
  name text not null,
  amount_cents bigint not null check (amount_cents > 0),
  billing_day integer check (billing_day between 1 and 28),
  check ((kind = 'monthly') = (billing_day is not null))
);
alter table private.family_enrollment_selections enable row level security;
revoke all on private.family_enrollment_selections from public, anon, authenticated;

create table private.family_enrollment_attempts (
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  request_id uuid not null references private.family_enrollment_selections(request_id) on delete cascade,
  request_kind text not null check (request_kind in ('athlete', 'guardian')),
  student_name text not null,
  relationship_label text,
  primary key (requester_user_id, idempotency_key)
);
create index family_enrollment_attempts_request_idx on private.family_enrollment_attempts (request_id);
alter table private.family_enrollment_attempts enable row level security;
revoke all on private.family_enrollment_attempts from public, anon, authenticated;

create function private.list_discoverable_family_plan_offers_v1(p_org_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from auth.users actor
    where actor.id = (select auth.uid()) and not coalesce(actor.is_anonymous, false)
      and actor.deleted_at is null
  ) then
    raise exception 'FAMILY_PLAN_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'offer_id', catalog.id, 'kind', catalog.kind, 'name', catalog.name,
      'description', catalog.description, 'amount_cents', catalog.amount_cents,
      'billing_day', catalog.billing_day, 'status', 'available'
    ) order by catalog.kind, catalog.name, catalog.id)
    from private.family_plan_catalog catalog
    join public.family_plan_offers offer
      on offer.id = catalog.id and offer.organization_id = catalog.organization_id
    where catalog.organization_id = p_org_id and catalog.available and offer.discoverable
  ), '[]'::jsonb);
end;
$$;

create function private.set_organization_family_plan_discoverable_v1(
  p_org_id uuid, p_offer_id uuid, p_discoverable boolean
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not coalesce(public.has_org_member_permission(p_org_id, 'financial'), false) then
    raise exception 'FAMILY_PLAN_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  update public.family_plan_offers offer set discoverable = p_discoverable
  where offer.id = p_offer_id and offer.organization_id = p_org_id
    and p_discoverable is not null and (not p_discoverable or offer.published);
  if not found then
    raise exception 'FAMILY_PLAN_UNAVAILABLE';
  end if;
end;
$$;

create or replace function private.unpublish_organization_family_plan_v1(p_org_id uuid, p_offer_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not coalesce(public.has_org_member_permission(p_org_id, 'financial'), false) then
    raise exception 'FAMILY_PLAN_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  update public.family_plan_offers offer set published = false, discoverable = false
  where offer.id = p_offer_id and offer.organization_id = p_org_id;
  if not found then
    raise exception 'FAMILY_PLAN_UNAVAILABLE';
  end if;
end;
$$;

create or replace function private.list_organization_family_plans_v1(p_org_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not coalesce(public.has_org_member_permission(p_org_id, 'financial'), false) then
    raise exception 'FAMILY_PLAN_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'offers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'offer_id', catalog.id, 'kind', catalog.kind, 'name', catalog.name,
        'tuition_plan_id', catalog.tuition_plan_id, 'published', catalog.published,
        'discoverable', offer.discoverable, 'amount_cents', catalog.amount_cents
      ) order by catalog.name, catalog.id)
      from private.family_plan_catalog catalog
      join public.family_plan_offers offer
        on offer.id = catalog.id and offer.organization_id = catalog.organization_id
      where catalog.organization_id = p_org_id
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'request_id', request.id, 'kind', offer.kind,
        'student_name', student.name, 'offer_name', request.offer_name,
        'amount_cents', request.amount_cents, 'billing_day', request.billing_day, 'status', request.status
      ) order by (request.status = 'pending') desc, request.created_at desc, request.id)
      from public.family_plan_requests request
      join public.family_plan_offers offer on offer.id = request.offer_id
        and offer.organization_id = request.organization_id
      join public.students student on student.id = request.student_id and student.organization_id = request.organization_id
      where request.organization_id = p_org_id
    ), '[]'::jsonb),
    'enrollments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'request_id', request.id, 'student_name', selection.student_name,
        'offer_id', selection.offer_id, 'kind', selection.kind, 'name', selection.name,
        'amount_cents', selection.amount_cents, 'billing_day', selection.billing_day, 'access_status', request.status
      ) order by (request.status = 'pending') desc, request.requested_at desc, request.id)
      from private.family_enrollment_selections selection
      join public.organization_access_requests request on request.id = selection.request_id
      where request.organization_id = p_org_id
    ), '[]'::jsonb)
  );
end;
$$;

create function private.request_family_enrollment_v1(
  p_org_id uuid, p_kind text, p_student_name text, p_relationship_label text,
  p_offer_id uuid, p_expected_amount_cents bigint, p_expected_billing_day integer, p_idempotency_key uuid
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_attempt record;
  v_student_name text := trim(p_student_name);
  v_relationship_label text := case when p_kind = 'guardian' then trim(p_relationship_label) end;
  v_request_id uuid;
  v_selection private.family_enrollment_selections;
  v_plan_id uuid;
  v_offer private.family_plan_catalog;
begin
  -- The same lock used by access review keeps replay safe even after a decision.
  perform 1 from auth.users actor where actor.id = v_actor
    and not coalesce(actor.is_anonymous, false) and actor.deleted_at is null
  for update;
  if not found then
    raise exception 'FAMILY_PLAN_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'FAMILY_ENROLLMENT_INVALID_KEY';
  end if;
  select attempt.request_id, request.organization_id, attempt.request_kind,
    attempt.student_name, attempt.relationship_label, selection.offer_id, selection.amount_cents, selection.billing_day
  into v_attempt
  from private.family_enrollment_attempts attempt
  join private.family_enrollment_selections selection on selection.request_id = attempt.request_id
  join public.organization_access_requests request on request.id = attempt.request_id
  where attempt.requester_user_id = v_actor and attempt.idempotency_key = p_idempotency_key;
  if found then
    if v_attempt.organization_id is distinct from p_org_id or v_attempt.request_kind is distinct from p_kind
      or v_attempt.student_name is distinct from v_student_name
      or v_attempt.relationship_label is distinct from v_relationship_label
      or v_attempt.offer_id is distinct from p_offer_id
      or v_attempt.amount_cents is distinct from p_expected_amount_cents
      or v_attempt.billing_day is distinct from p_expected_billing_day then
      raise exception 'FAMILY_ENROLLMENT_IDEMPOTENCY_MISMATCH';
    end if;
    return v_attempt.request_id;
  end if;

  -- Use the canonical account, validation and pending-request lock. A rejected
  -- offer rolls back this request and its notifications in the same transaction.
  v_request_id := public.request_family_access(p_org_id, p_kind, v_student_name, v_relationship_label);

  select selection.* into v_selection from private.family_enrollment_selections selection
  where selection.request_id = v_request_id;
  if found then
    if v_selection.offer_id is distinct from p_offer_id
      or v_selection.amount_cents is distinct from p_expected_amount_cents
      or v_selection.billing_day is distinct from p_expected_billing_day then
      raise exception 'FAMILY_ENROLLMENT_ALREADY_REQUESTED';
    end if;
  else
    -- Follow the publication lock order: the underlying monthly plan first.
    select offer.tuition_plan_id into v_plan_id from public.family_plan_offers offer
    where offer.id = p_offer_id and offer.organization_id = p_org_id
      and offer.published and offer.discoverable;
    if not found then
      raise exception 'FAMILY_PLAN_UNAVAILABLE';
    end if;
    if v_plan_id is not null then
      perform 1 from public.tuition_plans plan
      where plan.id = v_plan_id and plan.organization_id = p_org_id and plan.status = 'active'
      for share;
      if not found then
        raise exception 'FAMILY_PLAN_UNAVAILABLE';
      end if;
    end if;
    perform 1 from public.family_plan_offers offer
    where offer.id = p_offer_id and offer.organization_id = p_org_id
      and offer.tuition_plan_id is not distinct from v_plan_id
      and offer.published and offer.discoverable
    for share;
    if not found then
      raise exception 'FAMILY_PLAN_UNAVAILABLE';
    end if;

    select catalog.* into v_offer from private.family_plan_catalog catalog
    where catalog.id = p_offer_id and catalog.organization_id = p_org_id and catalog.available;
    if not found then
      raise exception 'FAMILY_PLAN_UNAVAILABLE';
    end if;
    if v_offer.amount_cents is distinct from p_expected_amount_cents
      or v_offer.billing_day is distinct from p_expected_billing_day then
      raise exception 'FAMILY_PLAN_TERMS_CHANGED';
    end if;

    insert into private.family_enrollment_selections (request_id, student_name, offer_id, kind, name, amount_cents, billing_day)
    values (v_request_id, v_student_name, v_offer.id, v_offer.kind, v_offer.name, v_offer.amount_cents, v_offer.billing_day);
  end if;

  insert into private.family_enrollment_attempts
    (requester_user_id, idempotency_key, request_id, request_kind, student_name, relationship_label)
  values (v_actor, p_idempotency_key, v_request_id, p_kind, v_student_name, v_relationship_label);
  return v_request_id;
end;
$$;

create or replace function public.list_access_requests_v2(p_scope text, p_org_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Not authorized'; end if;
  if p_scope is null or p_scope not in ('self', 'coord', 'platform') then raise exception 'INVALID_SCOPE'; end if;
  if p_scope = 'coord' and not coalesce(public.is_org_admin(p_org_id), false) then raise exception 'Not authorized'; end if;
  if p_scope = 'platform' and not coalesce(public.is_platform_admin(), false) then raise exception 'Not authorized'; end if;
  return coalesce((
    select jsonb_agg(
      to_jsonb(request) || jsonb_build_object('organization_name', org.name)
      || case when selection.request_id is not null then jsonb_build_object('enrollment_plan', jsonb_build_object(
        'offer_id', selection.offer_id, 'kind', selection.kind, 'name', selection.name,
        'amount_cents', selection.amount_cents, 'billing_day', selection.billing_day
      )) else '{}'::jsonb end
      order by request.requested_at desc
    )
    from public.organization_access_requests request
    join public.organizations org on org.id = request.organization_id
    left join private.family_enrollment_selections selection
      on p_scope = 'coord' and request.request_kind in ('athlete', 'guardian') and selection.request_id = request.id
    where (p_scope = 'self' and request.requester_user_id = auth.uid())
       or (p_scope = 'coord' and request.organization_id = p_org_id and request.status = 'pending')
       or p_scope = 'platform'
  ), '[]'::jsonb);
end;
$$;

create function public.list_discoverable_family_plan_offers_v1(p_org_id uuid) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select private.list_discoverable_family_plan_offers_v1(p_org_id); $$;

create function public.set_organization_family_plan_discoverable_v1(
  p_org_id uuid, p_offer_id uuid, p_discoverable boolean
) returns void
language sql security invoker set search_path = ''
as $$ select private.set_organization_family_plan_discoverable_v1(p_org_id, p_offer_id, p_discoverable); $$;

create function public.request_family_enrollment_v1(
  p_org_id uuid, p_kind text, p_student_name text, p_relationship_label text,
  p_offer_id uuid, p_expected_amount_cents bigint, p_expected_billing_day integer, p_idempotency_key uuid
) returns uuid
language sql security invoker set search_path = ''
as $$
  select private.request_family_enrollment_v1(
    p_org_id, p_kind, p_student_name, p_relationship_label,
    p_offer_id, p_expected_amount_cents, p_expected_billing_day, p_idempotency_key
  );
$$;

do $$
declare
  v_schema text;
  v_signature text;
begin
  foreach v_schema in array array['private', 'public'] loop
    foreach v_signature in array array[
      'list_discoverable_family_plan_offers_v1(uuid)',
      'set_organization_family_plan_discoverable_v1(uuid,uuid,boolean)',
      'request_family_enrollment_v1(uuid,text,text,text,uuid,bigint,integer,uuid)'
    ] loop
      execute format('revoke all on function %I.%s from public, anon', v_schema, v_signature);
      execute format('grant execute on function %I.%s to authenticated', v_schema, v_signature);
    end loop;
  end loop;
end;
$$;
