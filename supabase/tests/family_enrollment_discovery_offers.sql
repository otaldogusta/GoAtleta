-- Exercise discovery, access review, and snapshot isolation with fictitious fixtures.
begin;
do $$
declare
  coordinator uuid := gen_random_uuid();
  foreign_coordinator uuid := gen_random_uuid();
  guardian uuid := gen_random_uuid();
  athlete uuid := gen_random_uuid();
  anonymous_actor uuid := gen_random_uuid();
  org uuid := gen_random_uuid();
  other_org uuid := gen_random_uuid();
  plan_id uuid := gen_random_uuid();
  monthly_offer uuid;
  internal_offer uuid;
  foreign_offer uuid;
  request_id uuid;
  key uuid := gen_random_uuid();
  legacy_id uuid;
  foreign_request_id uuid;
  selection jsonb;
begin
  insert into auth.users (id, email, is_anonymous, raw_app_meta_data)
  select user_id, user_id::text || '@example.invalid', user_id = anonymous_actor,
    jsonb_build_object('email_verified_hybrid_at', now())
  from unnest(array[coordinator, foreign_coordinator, guardian, athlete, anonymous_actor]) as fixture(user_id);
  insert into public.organizations (id, name, created_by) values
    (org, 'Instituição da inscrição QA', coordinator), (other_org, 'Outra instituição QA', foreign_coordinator);
  insert into public.organization_members (organization_id, user_id, role_level) values
    (org, coordinator, 50), (other_org, foreign_coordinator, 50) on conflict do nothing;
  insert into public.tuition_plans (id, organization_id, name, amount_cents, billing_day)
  values (plan_id, org, 'Mensalidade QA', 15000, 10);

  assert not has_function_privilege('anon', 'public.list_discoverable_family_plan_offers_v1(uuid)', 'execute');
  assert not has_function_privilege('anon', 'public.request_family_enrollment_v1(uuid,text,text,text,uuid,bigint,integer,uuid)', 'execute');
  assert not has_table_privilege('authenticated', 'private.family_enrollment_selections', 'select');
  assert not has_table_privilege('authenticated', 'private.family_enrollment_selections', 'insert');
  assert not has_table_privilege('authenticated', 'private.family_enrollment_attempts', 'select');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', foreign_coordinator::text, true);
  foreign_offer := public.publish_organization_family_plan_v1(other_org, null, 'Matrícula externa QA', 8000);
  perform public.set_organization_family_plan_discoverable_v1(other_org, foreign_offer, true);

  perform set_config('request.jwt.claim.sub', coordinator::text, true);
  monthly_offer := public.publish_organization_family_plan_v1(org, plan_id, null, null);
  internal_offer := public.publish_organization_family_plan_v1(org, null, 'Matrícula interna QA', 7500);
  assert public.list_discoverable_family_plan_offers_v1(org) = '[]'::jsonb, 'Publishing must not enable discovery';
  perform public.set_organization_family_plan_discoverable_v1(org, monthly_offer, true);
  assert public.list_organization_family_plans_v1(org)->'offers' @> jsonb_build_array(
    jsonb_build_object('offer_id', monthly_offer, 'discoverable', true),
    jsonb_build_object('offer_id', internal_offer, 'discoverable', false)
  ), 'The coordinator sees both discovery flags';

  perform set_config('request.jwt.claim.sub', anonymous_actor::text, true);
  begin
    perform public.list_discoverable_family_plan_offers_v1(org);
    raise exception 'Anonymous session discovered offers';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', guardian::text, true);
  assert public.list_discoverable_family_plan_offers_v1(org) = jsonb_build_array(jsonb_build_object(
    'offer_id', monthly_offer, 'kind', 'monthly', 'name', 'Mensalidade QA', 'description', null,
    'amount_cents', 15000, 'billing_day', 10, 'status', 'available'
  )), 'Discovery exposes only the selected institution and its opted-in offer';
  begin
    perform public.set_organization_family_plan_discoverable_v1(org, internal_offer, true);
    raise exception 'Guardian could change discovery settings';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.request_family_enrollment_v1(org, 'guardian', 'Atleta QA', 'Mãe', internal_offer, 7500, null, gen_random_uuid());
    raise exception 'Internal offer could be requested through discovery';
  exception when raise_exception then
    if sqlerrm <> 'FAMILY_PLAN_UNAVAILABLE' then raise; end if;
  end;
  begin
    perform public.request_family_enrollment_v1(org, 'guardian', 'Atleta QA', 'Mãe', foreign_offer, 8000, null, gen_random_uuid());
    raise exception 'Foreign offer could be requested for another institution';
  exception when raise_exception then
    if sqlerrm <> 'FAMILY_PLAN_UNAVAILABLE' then raise; end if;
  end;
  begin
    perform public.request_family_enrollment_v1(org, 'guardian', 'Atleta QA', 'Mãe', monthly_offer, 14999, 10, gen_random_uuid());
    raise exception 'Stale price accepted';
  exception when raise_exception then
    if sqlerrm <> 'FAMILY_PLAN_TERMS_CHANGED' then raise; end if;
  end;
  begin
    perform public.request_family_enrollment_v1(org, 'guardian', 'Atleta QA', 'Mãe', monthly_offer, 15000, 9, gen_random_uuid());
    raise exception 'Stale billing day accepted';
  exception when raise_exception then
    if sqlerrm <> 'FAMILY_PLAN_TERMS_CHANGED' then raise; end if;
  end;
  assert public.list_access_requests_v2('self', null) = '[]'::jsonb, 'Failed offers must not leave requests';

  request_id := public.request_family_enrollment_v1(org, 'guardian', 'Atleta QA', 'Mãe', monthly_offer, 15000, 10, key);
  assert request_id = public.request_family_enrollment_v1(org, 'guardian', 'Atleta QA', 'Mãe', monthly_offer, 15000, 10, key);
  assert request_id = public.request_family_access(org, 'guardian', 'Atleta QA', 'Mãe'), 'Legacy retry preserves selection';
  assert jsonb_array_length(public.list_access_requests_v2('self', null)) = 1;
  assert not (public.list_access_requests_v2('self', null)->0 ? 'enrollment_plan');
  begin
    perform public.request_family_enrollment_v1(org, 'guardian', 'Atleta QA', 'Pai', monthly_offer, 15000, 10, key);
    raise exception 'Idempotency key could be reused for a different intent';
  exception when raise_exception then
    if sqlerrm <> 'FAMILY_ENROLLMENT_IDEMPOTENCY_MISMATCH' then raise; end if;
  end;
  begin
    perform public.request_family_enrollment_v1(org, 'guardian', 'Atleta QA', 'Mãe', internal_offer, 7500, null, gen_random_uuid());
    raise exception 'Second selection replaced the original pending request';
  exception when raise_exception then
    if sqlerrm <> 'FAMILY_ENROLLMENT_ALREADY_REQUESTED' then raise; end if;
  end;
  begin
    perform public.list_access_requests_v2('coord', org);
    raise exception 'Family account had access to the coordination projection';
  exception when raise_exception then
    if sqlerrm <> 'Not authorized' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', athlete::text, true);
  legacy_id := public.request_family_access(org, 'athlete', 'Outro atleta QA');
  foreign_request_id := public.request_family_enrollment_v1(
    other_org, 'athlete', 'Outro atleta QA', null, foreign_offer, 8000, null, key
  );
  assert foreign_request_id <> request_id, 'Two accounts can use the same client idempotency key';
  perform set_config('request.jwt.claim.sub', foreign_coordinator::text, true);
  assert public.list_access_requests_v2('coord', other_org) @> jsonb_build_array(
    jsonb_build_object('id', foreign_request_id, 'enrollment_plan', jsonb_build_object(
      'offer_id', foreign_offer, 'kind', 'enrollment', 'amount_cents', 8000, 'billing_day', null
    ))
  ), 'The athlete path supports one-time enrollment';
  begin
    perform public.list_access_requests_v2('coord', org);
    raise exception 'Foreign coordinator could read the selection';
  exception when raise_exception then
    if sqlerrm <> 'Not authorized' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', coordinator::text, true);
  assert public.list_access_requests_v2('coord', org) @> jsonb_build_array(jsonb_build_object('id', legacy_id));
  assert not exists (
    select 1 from jsonb_array_elements(public.list_access_requests_v2('coord', org)) entry
    where entry->>'id' = legacy_id::text and entry ? 'enrollment_plan'
  ), 'The legacy access request has no enrollment terms';
  assert public.list_access_requests_v2('coord', org) @> jsonb_build_array(
    jsonb_build_object('id', request_id, 'enrollment_plan', jsonb_build_object('offer_id', monthly_offer, 'amount_cents', 15000))
  ), 'Access review receives the terms snapshot';
  assert public.list_organization_family_plans_v1(org)->'requests' = '[]'::jsonb, 'Enrollment does not create a financial request';
  perform public.unpublish_organization_family_plan_v1(org, monthly_offer);
  assert public.list_discoverable_family_plan_offers_v1(org) = '[]'::jsonb;
  assert public.list_organization_family_plans_v1(org)->'offers' @> jsonb_build_array(
    jsonb_build_object('offer_id', monthly_offer, 'published', false, 'discoverable', false)
  );
  assert monthly_offer = public.publish_organization_family_plan_v1(org, plan_id, null, null);
  assert public.list_discoverable_family_plan_offers_v1(org) = '[]'::jsonb, 'Republishing renews consent for discovery separately';

  perform set_config('role', 'postgres', true);
  update public.tuition_plans set name = 'Mensalidade revisada QA', amount_cents = 17000, billing_day = 12
  where id = plan_id;
  assert not exists (select 1 from public.students where organization_id = org);
  assert not exists (select 1 from public.tuition_agreements where organization_id = org);
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', coordinator::text, true);
  select entry->'enrollment_plan' into selection
  from jsonb_array_elements(public.list_access_requests_v2('coord', org)) entry
  where entry->>'id' = request_id::text;
  assert selection = jsonb_build_object(
    'offer_id', monthly_offer, 'kind', 'monthly', 'name', 'Mensalidade QA',
    'amount_cents', 15000, 'billing_day', 10
  ), 'Selection retains submitted terms after catalog changes';
  assert public.review_family_access_request(request_id, 'rejected', null, gen_random_uuid());
  assert public.list_organization_family_plans_v1(org)->'enrollments' @> jsonb_build_array(
    selection || jsonb_build_object('request_id', request_id, 'student_name', 'Atleta QA', 'access_status', 'rejected')
  ), 'The snapshot remains visible in finance after review';
  perform set_config('request.jwt.claim.sub', guardian::text, true);
  assert request_id = public.request_family_enrollment_v1(org, 'guardian', 'Atleta QA', 'Mãe', monthly_offer, 15000, 10, key),
    'A retry after catalog changes and review returns the already-registered selection';
  assert jsonb_array_length(public.list_access_requests_v2('self', null)) = 1,
    'A retry after a review must not create another request';
  perform set_config('role', 'postgres', true);
end;
$$;
rollback;
