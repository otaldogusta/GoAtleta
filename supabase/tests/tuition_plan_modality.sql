begin;
do $$
declare actor uuid; org uuid; plan uuid; replay uuid; key text := gen_random_uuid()::text;
begin
 select user_id,organization_id into actor,org from public.organization_members order by role_level desc limit 1;
 if actor is null then raise exception 'Financial member fixture missing'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 plan := public.create_tuition_plan_v2(org,'Modality smoke',100,10,key,null,'voleibol');
 replay := public.create_tuition_plan_v2(org,'Modality smoke',100,10,key,null,'voleibol');
 if replay <> plan then raise exception 'Replay duplicated plan'; end if;
 if not exists(select 1 from public.tuition_plans where id=plan and modality='voleibol') then raise exception 'Create modality failed'; end if;
 begin
  perform public.create_tuition_plan_v2(org,'Modality smoke',100,10,key,null,'futebol');
  raise exception 'Conflicting replay accepted';
 exception when raise_exception then if sqlerrm <> 'IDEMPOTENCY_KEY_REUSED' then raise; end if; end;
 perform public.set_tuition_plan_modality(org,plan,'futebol');
 if not exists(select 1 from public.tuition_plans where id=plan and modality='futebol') then raise exception 'Edit failed'; end if;
 perform public.set_tuition_plan_modality(org,plan,null);
 if not exists(select 1 from public.tuition_plans where id=plan and modality is null) then raise exception 'Clear failed'; end if;
 execute 'reset role';
 if not exists(select 1 from public.tuition_plans where id=plan and amount_cents=100 and billing_day=10) then raise exception 'Edit changed financial data'; end if;
end $$;
rollback;
