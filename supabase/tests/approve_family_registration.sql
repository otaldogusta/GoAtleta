-- Fictitious registrations only; rollback includes all created data.
begin;
-- Match the deployed schema: required profile fields have no defaults.
alter table public.students alter column age drop default;
alter table public.students alter column phone drop default;
alter table public.students alter column createdat drop default;
do $$
declare
  coordinator uuid := gen_random_uuid(); requester uuid; org uuid := gen_random_uuid();
  request_id uuid; review_key uuid; sid text; kind text; blocked boolean;
begin
  insert into auth.users(id,email,email_confirmed_at) values(coordinator,'admission-admin@example.invalid',now());
  insert into public.organizations(id,name,created_by) values(org,'Admission QA',coordinator);
  insert into public.organization_members(organization_id,user_id,role_level) values(org,coordinator,50) on conflict do nothing;
  foreach kind in array array['athlete','guardian'] loop
    requester := gen_random_uuid(); review_key := gen_random_uuid();
    insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data)
      values(requester,requester::text || '@example.invalid',now(),jsonb_build_object('email_verified_hybrid_at',now()));
    perform set_config('request.jwt.claim.sub',requester::text,true);
    perform set_config('role','authenticated',true);
    request_id := public.request_family_access(org,kind,'New ' || kind,case when kind='guardian' then 'Pai' else null end);
    blocked := false;
    begin perform public.approve_family_registration(request_id,review_key); exception when others then blocked := true; end;
    assert blocked, 'requester cannot self approve';
    perform set_config('request.jwt.claim.sub',coordinator::text,true);
    assert public.approve_family_registration(request_id,review_key), 'direct admission';
    assert not public.approve_family_registration(request_id,review_key), 'same-key replay';
    blocked := false;
    begin perform public.approve_family_registration(request_id,gen_random_uuid()); exception when others then blocked := true; end;
    assert blocked, 'different-key replay denied';
    perform set_config('role','postgres',true);
    select reviewed_student_id into sid from public.organization_access_requests where id=request_id;
    assert exists(select 1 from public.students where id=sid and organization_id=org and classid is null), 'no forced class';
    assert exists(select 1 from public.student_relationships where student_id=sid and user_id=requester and status='active' and can_view_financial and can_pay), 'own financial access';
    assert not exists(select 1 from public.organization_members where user_id=requester), 'no staff grant';
    perform set_config('request.jwt.claim.sub',requester::text,true);
    perform set_config('role','authenticated',true);
    assert exists(select 1 from public.get_my_family_overview_v1() where student_id=sid), 'unassigned registration visible';
    perform set_config('role','postgres',true);
  end loop;
  assert (select count(*) from public.students where organization_id=org)=2, 'no duplicates on retry';
  requester := gen_random_uuid();
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data)
    values(requester,requester::text || '@example.invalid',now(),jsonb_build_object('email_verified_hybrid_at',now()));
  perform set_config('request.jwt.claim.sub',requester::text,true);
  perform set_config('role','authenticated',true);
  request_id := public.request_family_access(org,'guardian','New athlete','Mãe');
  perform set_config('request.jwt.claim.sub',coordinator::text,true);
  blocked := false;
  begin perform public.approve_family_registration(request_id,gen_random_uuid());
  exception when others then
    assert sqlerrm like 'Já existe um cadastro possível%', 'duplicate has actionable message';
    blocked := true;
  end;
  assert blocked, 'name match never grants access automatically';
  perform set_config('role','postgres',true);
  assert not exists(select 1 from public.student_relationships where user_id=requester), 'no leaked family access';
  assert (select count(*) from public.students where organization_id=org)=2, 'duplicate rolls back';
end $$;
rollback;
