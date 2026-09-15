-- Transactional smoke: existing accounts are impersonated only inside rollback.
begin;
do $$
declare u uuid; other_user uuid; affected integer;
begin
 select id into u from auth.users order by id limit 1;
 select id into other_user from auth.users where id <> u order by id limit 1;
 if u is null or other_user is null then raise exception 'Two accounts required for RLS test'; end if;
 perform set_config('request.jwt.claim.sub', u::text, true);
 execute 'set local role authenticated';
 perform public.save_my_athlete_modalities(array['voleibol','futebol','voleibol']);
 if (public.get_my_athlete_modalities()->'personal') <> '["futebol", "voleibol"]'::jsonb then raise exception 'Roundtrip/dedup failed'; end if;
 begin
   insert into public.athlete_modality_preferences(user_id,modalities) values(other_user,array['fitness']) on conflict(user_id) do update set modalities=excluded.modalities;
   raise exception 'Foreign write allowed';
 exception when insufficient_privilege then null; end;
 update public.athlete_modality_preferences set modalities = '{}' where user_id = other_user;
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Foreign update allowed'; end if;
 if exists(select 1 from public.athlete_modality_preferences where user_id <> u) then raise exception 'Foreign read allowed'; end if;
 begin
   perform public.save_my_athlete_modalities(array['not-a-sport']);
   raise exception 'Invalid sport allowed';
 exception when check_violation then null; end;
 begin
   perform public.set_tuition_plan_modality(gen_random_uuid(),gen_random_uuid(),'futebol');
   raise exception 'Foreign plan allowed';
 exception when raise_exception then
   if sqlerrm <> 'NOT_AUTHORIZED' then raise; end if;
 end;
 execute 'reset role';
end $$;
set local role anon;
do $$ begin
 begin
  perform public.get_my_athlete_modalities();
  raise exception 'Anonymous read allowed';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
