-- Fictitious offers, guardian relationships, and review decisions. Roll back.
begin;
do $$
declare
  coordinator uuid := gen_random_uuid();
  foreign_coordinator uuid := gen_random_uuid();
  guardian uuid := gen_random_uuid();
  other_guardian uuid := gen_random_uuid();
  payer uuid := gen_random_uuid();
  read_only_guardian uuid := gen_random_uuid();
  org uuid := gen_random_uuid();
  other_org uuid := gen_random_uuid();
  student text := gen_random_uuid()::text;
  other_student text := gen_random_uuid()::text;
  relationship uuid := gen_random_uuid();
  foreign_relationship uuid := gen_random_uuid();
  payer_relationship uuid := gen_random_uuid();
  read_only_relationship uuid := gen_random_uuid();
  monthly_plan uuid := gen_random_uuid();
  second_plan uuid := gen_random_uuid();
  another_plan uuid := gen_random_uuid();
  monthly_offer uuid;
  second_offer uuid;
  enrollment_offer uuid;
  another_offer uuid;
  monthly_request uuid;
  enrollment_request uuid;
  second_request uuid;
  data jsonb;
begin
  insert into auth.users (id, email, is_anonymous)
  select user_id, user_id::text || '@example.invalid', false
  from unnest(array[coordinator, foreign_coordinator, guardian, other_guardian, payer, read_only_guardian]) as fixture(user_id);
  insert into public.organizations (id, name, created_by) values
    (org, 'Instituição da família QA', coordinator), (other_org, 'Instituição externa QA', foreign_coordinator);
  insert into public.organization_members (organization_id, user_id, role_level) values
    (org, coordinator, 50), (other_org, foreign_coordinator, 50) on conflict do nothing;
  insert into public.students (id, name, age, phone, createdat, organization_id) values
    (student, 'Atleta QA', 13, '', now(), org), (other_student, 'Atleta externo QA', 13, '', now(), other_org);
  insert into public.student_relationships (id, organization_id, student_id, user_id, relationship_kind, can_view_financial, can_pay) values
    (relationship, org, student, guardian, 'guardian', true, true),
    (foreign_relationship, other_org, other_student, other_guardian, 'guardian', true, true),
    (read_only_relationship, org, student, read_only_guardian, 'guardian', true, false),
    (payer_relationship, org, student, payer, 'payer', true, true);
  insert into public.tuition_plans (id, organization_id, name, amount_cents, billing_day) values
    (monthly_plan, org, 'Plano mensal QA', 15000, 10),
    (second_plan, org, 'Segundo plano mensal QA', 16000, 5),
    (another_plan, other_org, 'Plano externo QA', 18000, 15);

  assert not has_function_privilege('anon', 'public.list_my_family_plan_offers_v1(uuid)', 'execute');
  assert not has_function_privilege('anon', 'public.request_my_family_plan_v1(uuid,uuid,bigint,integer)', 'execute');
  assert not has_table_privilege('authenticated', 'public.family_plan_requests', 'select');
  assert not has_table_privilege('authenticated', 'public.family_plan_requests', 'insert');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', guardian::text, true);
  assert public.list_my_family_plan_offers_v1(relationship) = '[]'::jsonb, 'Tuition plans require publication';
  begin
    perform public.list_my_family_plan_offers_v1(foreign_relationship);
    raise exception 'Foreign relationship was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.publish_organization_family_plan_v1(org, monthly_plan, null, null);
    raise exception 'Guardian published an institutional plan';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', foreign_coordinator::text, true);
  another_offer := public.publish_organization_family_plan_v1(other_org, another_plan, null, null);
  perform set_config('request.jwt.claim.sub', coordinator::text, true);
  monthly_offer := public.publish_organization_family_plan_v1(org, monthly_plan, null, null);
  second_offer := public.publish_organization_family_plan_v1(org, second_plan, null, null);
  enrollment_offer := public.publish_organization_family_plan_v1(org, null, 'Matrícula QA', 7500);
  assert enrollment_offer = public.publish_organization_family_plan_v1(org, null, '  matrícula qa  ', 7500), 'Publication retry is idempotent';
  begin
    perform public.publish_organization_family_plan_v1(org, another_plan, null, null);
    raise exception 'Cross-organization plan published';
  exception when raise_exception then
    if sqlerrm <> 'FAMILY_PLAN_UNAVAILABLE' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', guardian::text, true);
  data := public.list_my_family_plan_offers_v1(relationship);
  assert jsonb_array_length(data) = 3 and not (data::text like '%Plano externo QA%');
  begin
    perform public.request_my_family_plan_v1(relationship, another_offer, 18000, 15);
    raise exception 'Cross-organization request accepted';
  exception when raise_exception then
    if sqlerrm <> 'FAMILY_PLAN_UNAVAILABLE' then raise; end if;
  end;
  begin
    perform public.request_my_family_plan_v1(relationship, monthly_offer, 14900, 10);
    raise exception 'Changed terms accepted';
  exception when raise_exception then
    if sqlerrm <> 'FAMILY_PLAN_TERMS_CHANGED' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', read_only_guardian::text, true);
  begin
    perform public.request_my_family_plan_v1(read_only_relationship, monthly_offer, 15000, 10);
    raise exception 'Financial read grant allowed a request';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', payer::text, true);
  begin
    perform public.list_my_family_plan_offers_v1(payer_relationship);
    raise exception 'Payer without guardianship listed catalog';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', guardian::text, true);
  monthly_request := public.request_my_family_plan_v1(relationship, monthly_offer, 15000, 10);
  assert monthly_request = public.request_my_family_plan_v1(relationship, monthly_offer, 15000, 10), 'Request retry is idempotent';
  second_request := public.request_my_family_plan_v1(relationship, second_offer, 16000, 5);
  enrollment_request := public.request_my_family_plan_v1(relationship, enrollment_offer, 7500, null);
  begin
    perform public.review_organization_family_plan_v1(org, monthly_request, true);
    raise exception 'Guardian accepted own request';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', coordinator::text, true);
  assert jsonb_array_length(public.list_organization_family_plans_v1(org)->'requests') = 3;
  perform public.unpublish_organization_family_plan_v1(org, enrollment_offer);
  assert public.review_organization_family_plan_v1(org, enrollment_request, true) = 'accepted';
  assert public.review_organization_family_plan_v1(org, monthly_request, true) = 'accepted';
  assert public.review_organization_family_plan_v1(org, monthly_request, true) = 'accepted', 'Approval retry is idempotent';
  begin
    perform public.review_organization_family_plan_v1(org, second_request, true);
    raise exception 'Second active agreement created';
  exception when raise_exception then
    if sqlerrm <> 'FAMILY_PLAN_ACTIVE_AGREEMENT_EXISTS' then raise; end if;
  end;
  assert public.review_organization_family_plan_v1(org, second_request, false) = 'declined';
  perform set_config('request.jwt.claim.sub', guardian::text, true);
  data := public.list_my_family_plan_offers_v1(relationship);
  assert jsonb_array_length(data) = 3, 'Hidden enrollment offers retain recorded history';
  assert exists (select 1 from jsonb_array_elements(data) result where result ->> 'offer_id' = enrollment_offer::text
    and result ->> 'status' = 'accepted' and result -> 'billing_day' = 'null'::jsonb);
  assert not exists (select 1 from jsonb_array_elements(data) result where result ?| array['student_id', 'relationship_id', 'reviewed_by']);

  perform set_config('role', 'postgres', true);
  assert (select count(*) from public.tuition_agreements a where a.organization_id = org and a.student_id = student
    and a.amount_cents = 15000 and a.billing_day = 10 and a.status = 'active') = 1;
  assert not exists (select 1 from public.invoices i where i.organization_id = org);
  assert (select count(*) from public.family_plan_requests request where request.organization_id = org) = 3;
  update public.student_relationships set status = 'revoked', revoked_at = now() where id = relationship;

  perform set_config('role', 'authenticated', true);
  begin
    perform public.request_my_family_plan_v1(relationship, monthly_offer, 15000, 10);
    raise exception 'Revoked relationship could replay';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'postgres', true);
end;
$$;
rollback;
