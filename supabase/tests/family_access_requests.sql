-- Full-schema regression. Fictitious fixtures; always roll back.
begin;
do $$
declare
  parent uuid := gen_random_uuid(); athlete uuid := gen_random_uuid(); coordinator uuid := gen_random_uuid(); outsider uuid := gen_random_uuid();
  org uuid := gen_random_uuid(); other_org uuid := gen_random_uuid(); request_id uuid; review_key uuid := gen_random_uuid();
  student text := gen_random_uuid()::text; other_student text := gen_random_uuid()::text;
  class_id text := gen_random_uuid()::text; other_class text := gen_random_uuid()::text;
  blocked boolean; receipt jsonb; token text := encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
begin
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
    (parent,'family-parent@example.invalid',now(),jsonb_build_object('email_verified_hybrid_at',now())),
    (athlete,'family-athlete@example.invalid',now(),jsonb_build_object('email_verified_hybrid_at',now())),
    (coordinator,'family-coord@example.invalid',now(),jsonb_build_object('email_verified_hybrid_at',now())),
    (outsider,'family-outsider@example.invalid',now(),jsonb_build_object('email_verified_hybrid_at',now()));
  insert into public.organizations(id,name,created_by) values(org,'Family QA',coordinator),(other_org,'Other QA',outsider);
  insert into public.organization_members(organization_id,user_id,role_level) values(org,coordinator,50) on conflict do nothing;
  insert into public.classes(id,name,ageband,daysperweek,goal,equipment,level,organization_id)
    values(class_id,'QA','test',1,'','',1,org),(other_class,'Other QA','test',1,'','',1,other_org);
  insert into public.students(id,name,classid,age,phone,createdat,organization_id)
    values(student,'Fictitious athlete',class_id,18,'',now(),org),(other_student,'Other athlete',other_class,18,'',now(),other_org);
  perform set_config('request.jwt.claim.sub',parent::text,true);
  perform set_config('role','authenticated',true);
  request_id := public.request_family_access(org,'guardian','Fictitious athlete','Pai');
  assert request_id = public.request_family_access(org,'guardian','Fictitious athlete','Pai'), 'request deduplication';
  assert not exists(select 1 from public.students where id=other_student), 'RLS hides unrelated athlete';
  blocked := false;
  begin perform public.list_family_request_candidates(request_id); exception when others then blocked := true; end;
  assert blocked, 'no public candidate lookup';
  perform set_config('request.jwt.claim.sub',coordinator::text,true);
  blocked := false;
  begin perform public.review_family_access_request(request_id,'approved',other_student,review_key); exception when others then blocked := true; end;
  assert blocked, 'cross organization review denied';
  assert public.review_family_access_request(request_id,'approved',student,review_key), 'guardian approved';
  assert not public.review_family_access_request(request_id,'approved',student,review_key), 'review replay';
  perform set_config('request.jwt.claim.sub',parent::text,true);
  assert (select count(*) from public.get_my_family_overview_v1() where student_id=student)=1, 'guardian sees approved child';
  assert not exists(select 1 from public.get_my_family_overview_v1() where student_id=other_student), 'family overview isolated';
  perform public.create_guardian_athlete_invite(org,student,token,'family-athlete@example.invalid');
  blocked := false;
  begin perform public.create_guardian_athlete_invite(other_org,other_student,repeat('b',64),'family-athlete@example.invalid'); exception when others then blocked := true; end;
  assert blocked, 'guardian cannot invite other athlete';
  perform set_config('role','postgres',true);
  assert not exists(select 1 from public.organization_members where user_id in(parent,athlete)), 'no staff grants';
  assert exists(select 1 from public.student_relationships where user_id=parent and student_id=student and not can_view_health and not can_view_financial and not can_pay), 'basic permissions only';
  perform set_config('role','service_role',true);
  receipt := public.claim_student_relationship_invite_v1(token,athlete,'family-athlete@example.invalid');
  assert receipt->>'status' = 'claimed', 'athlete claims existing registration';
  receipt := public.claim_student_relationship_invite_v1(token,athlete,'family-athlete@example.invalid');
  assert receipt->>'status' = 'already_claimed', 'claim replay';
  perform set_config('role','postgres',true);
  assert (select student_user_id from public.students where id=student)=athlete, 'legacy compatibility';
  assert (select count(*) from public.students where organization_id=org)=1, 'no duplicate registration';
  perform set_config('request.jwt.claim.sub',athlete::text,true);
  perform set_config('role','authenticated',true);
  assert exists(select 1 from public.students where id=student), 'athlete sees own registration';
  assert not exists(select 1 from public.students where id=other_student), 'athlete RLS isolation';
  assert not has_function_privilege('authenticated','public.claim_student_relationship_invite_core(text,uuid,text)','execute'), 'core protected';
  perform set_config('role','postgres',true);
end $$;
rollback;
