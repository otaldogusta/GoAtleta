begin;
do $$
declare
 actor uuid; org uuid; class_id text; sid text; relation uuid; plan uuid;
 sport text; expected text[]; before_modalities text[];
begin
 select id into actor from auth.users order by id limit 1;
 select id, organization_id into class_id, org from public.classes where deleted_at is null limit 1;
 if actor is null or class_id is null then raise exception 'Fixture prerequisites missing'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 before_modalities := private.my_plan_modalities();
 foreach sport in array array['voleibol','futebol'] loop
   sid := 'modality-test-' || gen_random_uuid()::text;
   insert into public.students(id,name,classid,age,phone,createdat,organization_id,student_user_id)
   values(sid,'Modality test',class_id,20,'',now()::text,org,actor);
   insert into public.student_relationships(organization_id,student_id,relationship_kind)
   values(org,sid,'payer') returning id into relation;
   insert into public.tuition_plans(organization_id,name,amount_cents,billing_day,modality)
   values(org,'Modality test',100,10,sport) returning id into plan;
   insert into public.tuition_agreements(organization_id,student_id,plan_id,payer_relationship_id,amount_cents,billing_day,starts_on)
   values(org,sid,plan,relation,100,10,current_date);
 end loop;
 select array_agg(distinct x order by x) into expected from unnest(before_modalities || array['voleibol','futebol']) x;
 if private.my_plan_modalities() is distinct from expected then raise exception 'Multiple active plans failed'; end if;
 -- The final fixture is futebol. Only its agreement changes; no real records touched.
 update public.tuition_agreements set status='paused' where student_id=sid;
 select array_agg(distinct x order by x) into expected from unnest(before_modalities || array['voleibol']) x;
 if private.my_plan_modalities() is distinct from expected then raise exception 'Paused plan included'; end if;
 update public.tuition_agreements set status='active',starts_on=current_date+1 where student_id=sid;
 if private.my_plan_modalities() is distinct from expected then raise exception 'Future plan included'; end if;
 update public.tuition_agreements set starts_on=current_date-2,ends_on=current_date-1 where student_id=sid;
 if private.my_plan_modalities() is distinct from expected then raise exception 'Expired plan included'; end if;
 update public.tuition_agreements set starts_on=current_date,ends_on=null where student_id=sid;
 update public.students set student_user_id=null where id=sid;
 if private.my_plan_modalities() is distinct from expected then raise exception 'Unlinked athlete included'; end if;
end $$;
rollback;
