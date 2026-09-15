-- Run after the migration, always inside a rolled-back transaction.
begin;
do $$
declare
  athlete uuid := gen_random_uuid(); coordinator uuid := gen_random_uuid(); stranger uuid := gen_random_uuid();
  org uuid := gen_random_uuid(); other_org uuid := gen_random_uuid(); request_id uuid; request2 uuid;
  student text := gen_random_uuid()::text; other_student text := gen_random_uuid()::text;
  class_id text := gen_random_uuid()::text; other_class text := gen_random_uuid()::text;
  review_key uuid := gen_random_uuid(); blocked boolean; result jsonb;
begin
  insert into auth.users(id,email,email_confirmed_at) values
    (athlete,'athlete-test@example.invalid',now()),(coordinator,'coord-test@example.invalid',now()),(stranger,'stranger-test@example.invalid',now());
  update auth.users set raw_app_meta_data=jsonb_build_object('email_verified_hybrid_at',now()::text) where id in (athlete,coordinator,stranger);
  insert into public.organizations(id,name,created_by) values (org,'Test athlete org',coordinator),(other_org,'Other test org',stranger);
  insert into public.organization_members(organization_id,user_id,role_level) values (org,coordinator,50) on conflict do nothing;
  insert into public.classes(id,name,ageband,daysperweek,goal,equipment,level,organization_id)
    values(class_id,'Test class','test',1,'','',1,org),(other_class,'Other class','test',1,'','',1,other_org);
  insert into public.students(id,name,classid,age,phone,createdat,organization_id)
    values(student,'Test athlete',class_id,18,'',now()::text,org),(other_student,'Other athlete',other_class,18,'',now()::text,other_org);
  perform set_config('request.jwt.claim.sub',athlete::text,true);
  request_id := public.request_athlete_access(org);
  assert public.request_athlete_access(org) = request_id, 'deduplicate';
  assert (public.list_access_requests_v2('self')->0->>'request_kind') = 'athlete';
  blocked := false;
  begin perform public.list_access_requests_v2('coord',org); exception when others then blocked := true; end;
  assert blocked, 'athlete cannot read coordination';
  perform set_config('request.jwt.claim.sub',coordinator::text,true);
  assert (select count(*) from public.list_athlete_request_candidates(request_id)) = 1, 'candidate scope';
  blocked := false;
  begin perform public.review_athlete_access_request(request_id,'approved',other_student,review_key); exception when others then blocked := true; end;
  assert blocked, 'cross org blocked';
  blocked := false;
  begin perform public.admin_review_org_access_request(request_id,'approved',10,review_key); exception when others then blocked := true; end;
  assert blocked, 'legacy staff elevation blocked';
  assert not exists(select 1 from public.organization_members where user_id=athlete), 'no staff member on failed review';
  assert public.review_athlete_access_request(request_id,'approved',student,review_key), 'approve';
  assert not public.review_athlete_access_request(request_id,'approved',student,review_key), 'idempotent retry';
  assert (select student_user_id from public.students where id=student) = athlete, 'linked';
  assert not exists(select 1 from public.trainers where user_id=athlete), 'no trainer';
  assert not exists(select 1 from public.organization_members where user_id=athlete), 'no staff role';
  perform set_config('request.jwt.claim.sub',stranger::text,true);
  request2 := public.request_athlete_access(org);
  perform set_config('request.jwt.claim.sub',coordinator::text,true);
  blocked := false;
  begin perform public.review_athlete_access_request(request2,'approved',student,gen_random_uuid()); exception when others then blocked := true; end;
  assert blocked, 'cannot steal linked student';
  assert public.review_athlete_access_request(request2,'rejected',null,gen_random_uuid());
  assert (select student_user_id from public.students where id=student) = athlete, 'rejection preserves link';
  assert not has_function_privilege('anon','public.request_athlete_access(uuid)','execute');
end $$;
rollback;
