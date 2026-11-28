-- Published offers are opt-in. Monthly offers reference the canonical tuition
-- plan, while enrollment offers have a one-time price and no billing schedule.
create table public.family_plan_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('enrollment', 'monthly')),
  tuition_plan_id uuid,
  enrollment_name text,
  enrollment_amount_cents bigint,
  published boolean not null default true,
  unique (id, organization_id),
  unique (organization_id, tuition_plan_id),
  foreign key (tuition_plan_id, organization_id) references public.tuition_plans (id, organization_id) on delete restrict,
  check (
    (kind = 'monthly' and tuition_plan_id is not null and enrollment_name is null and enrollment_amount_cents is null)
    or (kind = 'enrollment' and tuition_plan_id is null and enrollment_name is not null
        and char_length(enrollment_name) between 2 and 120 and enrollment_amount_cents is not null
        and enrollment_amount_cents between 1 and 99999999999)
  )
);

create unique index family_enrollment_offer_terms_idx
  on public.family_plan_offers (organization_id, (lower(enrollment_name)), enrollment_amount_cents)
  where kind = 'enrollment';

create table public.family_plan_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id text not null,
  relationship_id uuid not null,
  offer_id uuid not null,
  offer_name text not null,
  amount_cents bigint not null check (amount_cents > 0),
  billing_day integer check (billing_day between 1 and 28),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  agreement_id uuid,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  foreign key (student_id, organization_id) references public.students (id, organization_id) on delete cascade,
  foreign key (relationship_id, organization_id) references public.student_relationships (id, organization_id) on delete cascade,
  foreign key (offer_id, organization_id) references public.family_plan_offers (id, organization_id),
  foreign key (agreement_id, organization_id) references public.tuition_agreements (id, organization_id) on delete restrict,
  unique (organization_id, student_id, offer_id),
  check ((status = 'pending') = (reviewed_at is null)),
  check ((agreement_id is not null) = (status = 'accepted' and billing_day is not null))
);

create index family_plan_requests_review_idx
  on public.family_plan_requests (organization_id, status, created_at desc);
create index family_plan_requests_relationship_idx
  on public.family_plan_requests (relationship_id, organization_id);
create index family_plan_requests_offer_idx
  on public.family_plan_requests (offer_id, organization_id);

alter table public.family_plan_offers enable row level security;
alter table public.family_plan_requests enable row level security;
revoke all on public.family_plan_offers, public.family_plan_requests from public, anon, authenticated;

create view private.family_plan_catalog as
select offer.id, offer.organization_id, offer.kind, offer.tuition_plan_id,
  coalesce(plan.name, offer.enrollment_name) as name,
  plan.description,
  coalesce(plan.amount_cents, offer.enrollment_amount_cents) as amount_cents,
  plan.billing_day,
  offer.published and (offer.kind = 'enrollment' or plan.status = 'active') as available,
  offer.published
from public.family_plan_offers offer
left join public.tuition_plans plan on plan.id = offer.tuition_plan_id
  and plan.organization_id = offer.organization_id;
revoke all on private.family_plan_catalog from public, anon, authenticated;

create function private.require_family_plan_guardian_v1(p_relationship_id uuid, p_lock boolean)
returns public.student_relationships
language plpgsql security definer set search_path = ''
as $$
declare
  v_relationship public.student_relationships;
begin
  if not exists (select 1 from auth.users actor where actor.id = (select auth.uid()) and not coalesce(actor.is_anonymous, false)) then
    raise exception 'FAMILY_PLAN_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select relationship.* into v_relationship
  from public.student_relationships relationship
  join public.students student on student.id = relationship.student_id
    and student.organization_id = relationship.organization_id
  where relationship.id = p_relationship_id
    and relationship.user_id = (select auth.uid())
    and relationship.status = 'active'
    and relationship.relationship_kind = 'guardian'
    and relationship.can_view_financial
    and relationship.can_pay
    and student.membership_status = 'active';

  if found and p_lock then
    -- Follow the canonical agreement lock order before locking this relationship.
    perform 1 from public.students student
      where student.id = v_relationship.student_id
        and student.organization_id = v_relationship.organization_id
        and student.membership_status = 'active'
      for update;
    if not found then
      raise exception 'FAMILY_PLAN_NOT_AUTHORIZED' using errcode = '42501';
    end if;
    select relationship.* into v_relationship
    from public.student_relationships relationship
    where relationship.id = p_relationship_id
      and relationship.user_id = (select auth.uid())
      and relationship.status = 'active'
      and relationship.relationship_kind = 'guardian'
      and relationship.can_view_financial
      and relationship.can_pay
    for share;
  end if;

  if v_relationship.id is null then
    raise exception 'FAMILY_PLAN_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  return v_relationship;
end;
$$;
revoke all on function private.require_family_plan_guardian_v1(uuid, boolean) from public, anon, authenticated;

create function private.list_my_family_plan_offers_v1(p_relationship_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_relationship public.student_relationships;
begin
  v_relationship := private.require_family_plan_guardian_v1(p_relationship_id, false);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'offer_id', offer.id,
      'kind', offer.kind,
      'name', coalesce(request.offer_name, offer.name),
      'description', case when request.id is null then offer.description end,
      'amount_cents', coalesce(request.amount_cents, offer.amount_cents),
      'billing_day', coalesce(request.billing_day, offer.billing_day),
      'status', coalesce(request.status, 'available')
    ) order by offer.kind, offer.name, offer.id)
    from private.family_plan_catalog offer
    left join public.family_plan_requests request on request.organization_id = offer.organization_id
      and request.student_id = v_relationship.student_id and request.offer_id = offer.id
    where offer.organization_id = v_relationship.organization_id
      and (request.id is not null or (offer.available and (
        offer.kind = 'enrollment' or not exists (
          select 1 from public.tuition_agreements agreement
          where agreement.organization_id = v_relationship.organization_id
            and agreement.student_id = v_relationship.student_id and agreement.status = 'active'
        )
      )))
  ), '[]'::jsonb);
end;
$$;

create function private.request_my_family_plan_v1(
  p_relationship_id uuid, p_offer_id uuid, p_expected_amount_cents bigint, p_expected_billing_day integer
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_relationship public.student_relationships;
  v_offer private.family_plan_catalog;
  v_plan_id uuid;
  v_request_id uuid;
begin
  v_relationship := private.require_family_plan_guardian_v1(p_relationship_id, true);
  select request.id into v_request_id
  from public.family_plan_requests request
  where request.organization_id = v_relationship.organization_id
    and request.student_id = v_relationship.student_id
    and request.offer_id = p_offer_id;
  if found then
    return v_request_id;
  end if;

  -- Monthly publication also locks the underlying plan before the offer row.
  select offer.tuition_plan_id into v_plan_id from public.family_plan_offers offer
  where offer.id = p_offer_id and offer.organization_id = v_relationship.organization_id;
  if v_plan_id is not null then
    if exists (
      select 1 from public.tuition_agreements agreement
      where agreement.organization_id = v_relationship.organization_id
        and agreement.student_id = v_relationship.student_id and agreement.status = 'active'
    ) then
      raise exception 'FAMILY_PLAN_ACTIVE_AGREEMENT_EXISTS';
    end if;
    perform 1 from public.tuition_plans plan
    where plan.id = v_plan_id and plan.organization_id = v_relationship.organization_id
      and plan.status = 'active'
    for share;
    if not found then
      raise exception 'FAMILY_PLAN_UNAVAILABLE';
    end if;
  end if;

  perform 1 from public.family_plan_offers offer
  where offer.id = p_offer_id and offer.organization_id = v_relationship.organization_id
    and offer.published
  for share;
  if not found then
    raise exception 'FAMILY_PLAN_UNAVAILABLE';
  end if;

  select catalog.* into v_offer from private.family_plan_catalog catalog
  where catalog.id = p_offer_id and catalog.organization_id = v_relationship.organization_id and catalog.available;
  if not found then
    raise exception 'FAMILY_PLAN_UNAVAILABLE';
  end if;
  if v_offer.amount_cents is distinct from p_expected_amount_cents
    or v_offer.billing_day is distinct from p_expected_billing_day then
    raise exception 'FAMILY_PLAN_TERMS_CHANGED';
  end if;

  insert into public.family_plan_requests (
    organization_id, student_id, relationship_id, offer_id, offer_name, amount_cents, billing_day
  ) values (
    v_relationship.organization_id, v_relationship.student_id, v_relationship.id, v_offer.id,
    v_offer.name, v_offer.amount_cents, v_offer.billing_day
  )
  on conflict (organization_id, student_id, offer_id) do nothing
  returning id into v_request_id;

  if v_request_id is null then
    select request.id into v_request_id from public.family_plan_requests request
    where request.organization_id = v_relationship.organization_id
      and request.student_id = v_relationship.student_id and request.offer_id = v_offer.id;
  end if;
  return v_request_id;
end;
$$;

create function private.list_organization_family_plans_v1(p_org_id uuid)
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
        'offer_id', offer.id, 'kind', offer.kind, 'name', offer.name,
        'tuition_plan_id', offer.tuition_plan_id, 'published', offer.published,
        'amount_cents', offer.amount_cents
      ) order by offer.name, offer.id)
      from private.family_plan_catalog offer where offer.organization_id = p_org_id
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
    ), '[]'::jsonb)
  );
end;
$$;

create function private.publish_organization_family_plan_v1(
  p_org_id uuid, p_tuition_plan_id uuid, p_enrollment_name text, p_enrollment_amount_cents bigint
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_offer_id uuid;
begin
  if auth.uid() is null or not coalesce(public.has_org_member_permission(p_org_id, 'financial'), false) then
    raise exception 'FAMILY_PLAN_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_tuition_plan_id is not null then
    perform 1 from public.tuition_plans plan
    where plan.id = p_tuition_plan_id and plan.organization_id = p_org_id and plan.status = 'active'
    for share;
    if not found then
      raise exception 'FAMILY_PLAN_UNAVAILABLE';
    end if;
    insert into public.family_plan_offers (organization_id, kind, tuition_plan_id)
    values (p_org_id, 'monthly', p_tuition_plan_id)
    on conflict (organization_id, tuition_plan_id) do update set published = true
    returning id into v_offer_id;
  else
    insert into public.family_plan_offers (organization_id, kind, enrollment_name, enrollment_amount_cents)
    values (p_org_id, 'enrollment', trim(p_enrollment_name), p_enrollment_amount_cents)
    on conflict (organization_id, (lower(enrollment_name)), enrollment_amount_cents)
      where kind = 'enrollment' do update set published = true
    returning id into v_offer_id;
  end if;
  return v_offer_id;
end;
$$;

create function private.unpublish_organization_family_plan_v1(p_org_id uuid, p_offer_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not coalesce(public.has_org_member_permission(p_org_id, 'financial'), false) then
    raise exception 'FAMILY_PLAN_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  update public.family_plan_offers offer set published = false
  where offer.id = p_offer_id and offer.organization_id = p_org_id;
  if not found then
    raise exception 'FAMILY_PLAN_UNAVAILABLE';
  end if;
end;
$$;

create function private.review_organization_family_plan_v1(p_org_id uuid, p_request_id uuid, p_accept boolean)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.family_plan_requests;
  v_offer private.family_plan_catalog;
  v_status text;
  v_agreement_id uuid;
  v_starts_on date;
begin
  if auth.uid() is null or not coalesce(public.has_org_member_permission(p_org_id, 'financial'), false) then
    raise exception 'FAMILY_PLAN_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_accept is null then
    raise exception 'FAMILY_PLAN_DECISION_REQUIRED';
  end if;

  -- Serialize with the same student lock used by canonical agreement creation.
  perform 1 from public.family_plan_requests request
  join public.students student on student.id = request.student_id and student.organization_id = request.organization_id
  where request.id = p_request_id and request.organization_id = p_org_id
  for update of student;

  select request.* into v_request from public.family_plan_requests request
  where request.id = p_request_id and request.organization_id = p_org_id
  for update;
  if not found then
    raise exception 'FAMILY_PLAN_REQUEST_NOT_FOUND';
  end if;
  v_status := case when p_accept then 'accepted' else 'declined' end;
  if v_request.status = v_status then
    return v_status;
  end if;
  if v_request.status <> 'pending' then
    raise exception 'FAMILY_PLAN_ALREADY_REVIEWED';
  end if;

  if p_accept then
    if not exists (
      select 1 from public.students student where student.id = v_request.student_id
        and student.organization_id = p_org_id and student.membership_status = 'active'
    ) then
      raise exception 'FAMILY_PLAN_PAYER_INELIGIBLE';
    end if;
    select offer.* into v_offer from private.family_plan_catalog offer
    where offer.id = v_request.offer_id and offer.organization_id = p_org_id;
    if not found then
      raise exception 'FAMILY_PLAN_UNAVAILABLE';
    end if;
    if v_offer.kind = 'monthly' then
      perform 1 from public.tuition_plans plan
      where plan.id = v_offer.tuition_plan_id and plan.organization_id = p_org_id
        and plan.status = 'active'
      for update;
      if not found then
        raise exception 'FAMILY_PLAN_UNAVAILABLE';
      end if;
    end if;
    perform 1 from public.student_relationships relationship
    where relationship.id = v_request.relationship_id and relationship.organization_id = p_org_id
      and relationship.student_id = v_request.student_id and relationship.status = 'active'
      and relationship.relationship_kind = 'guardian' and relationship.user_id is not null
      and relationship.can_view_financial and relationship.can_pay
    for update;
    if not found then
      raise exception 'FAMILY_PLAN_PAYER_INELIGIBLE';
    end if;
    if v_offer.kind = 'monthly' then
      if exists (
        select 1 from public.tuition_agreements agreement
        where agreement.organization_id = p_org_id and agreement.student_id = v_request.student_id
          and agreement.status = 'active'
      ) then
        raise exception 'FAMILY_PLAN_ACTIVE_AGREEMENT_EXISTS';
      end if;
      select (now() at time zone organization.timezone)::date into v_starts_on
      from public.organizations organization where organization.id = p_org_id;
      v_agreement_id := public.create_tuition_agreement_v1(
        p_org_id, v_request.student_id, v_offer.tuition_plan_id, v_request.relationship_id,
        v_starts_on, 'family-plan-request:' || v_request.id, null, v_request.amount_cents, v_request.billing_day
      );
    end if;
  end if;

  update public.family_plan_requests request
  set status = v_status, agreement_id = v_agreement_id, reviewed_at = now(), reviewed_by = auth.uid()
  where request.id = v_request.id and request.organization_id = p_org_id;
  return v_status;
end;
$$;

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'list_my_family_plan_offers_v1(uuid)',
    'request_my_family_plan_v1(uuid,uuid,bigint,integer)',
    'list_organization_family_plans_v1(uuid)',
    'publish_organization_family_plan_v1(uuid,uuid,text,bigint)',
    'unpublish_organization_family_plan_v1(uuid,uuid)',
    'review_organization_family_plan_v1(uuid,uuid,boolean)'
  ] loop
    execute 'revoke all on function private.' || v_signature || ' from public, anon';
    execute 'grant execute on function private.' || v_signature || ' to authenticated';
  end loop;
end;
$$;

create function public.list_my_family_plan_offers_v1(p_relationship_id uuid) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select private.list_my_family_plan_offers_v1(p_relationship_id); $$;

create function public.request_my_family_plan_v1(
  p_relationship_id uuid, p_offer_id uuid, p_expected_amount_cents bigint, p_expected_billing_day integer
) returns uuid
language sql security invoker set search_path = ''
as $$ select private.request_my_family_plan_v1(p_relationship_id, p_offer_id, p_expected_amount_cents, p_expected_billing_day); $$;

create function public.list_organization_family_plans_v1(p_org_id uuid) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select private.list_organization_family_plans_v1(p_org_id); $$;

create function public.publish_organization_family_plan_v1(
  p_org_id uuid, p_tuition_plan_id uuid, p_enrollment_name text, p_enrollment_amount_cents bigint
) returns uuid
language sql security invoker set search_path = ''
as $$ select private.publish_organization_family_plan_v1(p_org_id, p_tuition_plan_id, p_enrollment_name, p_enrollment_amount_cents); $$;

create function public.unpublish_organization_family_plan_v1(p_org_id uuid, p_offer_id uuid) returns void
language sql security invoker set search_path = ''
as $$ select private.unpublish_organization_family_plan_v1(p_org_id, p_offer_id); $$;

create function public.review_organization_family_plan_v1(p_org_id uuid, p_request_id uuid, p_accept boolean) returns text
language sql security invoker set search_path = ''
as $$ select private.review_organization_family_plan_v1(p_org_id, p_request_id, p_accept); $$;

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'list_my_family_plan_offers_v1(uuid)',
    'request_my_family_plan_v1(uuid,uuid,bigint,integer)',
    'list_organization_family_plans_v1(uuid)',
    'publish_organization_family_plan_v1(uuid,uuid,text,bigint)',
    'unpublish_organization_family_plan_v1(uuid,uuid)',
    'review_organization_family_plan_v1(uuid,uuid,boolean)'
  ] loop
    execute 'revoke all on function public.' || v_signature || ' from public, anon';
    execute 'grant execute on function public.' || v_signature || ' to authenticated';
  end loop;
end;
$$;
