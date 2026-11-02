-- Prepared locally; no remote application is implied. Additive, no historical backfill.
-- Outcome describes the rally ending, separately from observed technical contacts.
create or replace function public.scouting_normalize_rally_outcome(p_outcome jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare kind text; team text; reason text; keys integer;
begin
 if p_outcome is null or p_outcome='null'::jsonb then return null; end if;
 if jsonb_typeof(p_outcome)<>'object' then raise exception 'Invalid scouting outcome'; end if;
 kind:=p_outcome->>'kind'; team:=p_outcome->>'team';
 select count(*) into keys from jsonb_object_keys(p_outcome);
 if coalesce(team,'') not in ('us','them') then raise exception 'Invalid scouting outcome team'; end if;
 if kind='falta' then
   reason:=p_outcome->>'reason';
   if keys<>3 or not (p_outcome ?& array['kind','team','reason']) or
     coalesce(reason,'') not in ('rede','dois_toques','linha_saque','invasao','quatro_toques','rodizio','outra') then
     raise exception 'Invalid scouting fault'; end if;
   return jsonb_build_object('kind',kind,'team',team,'reason',reason);
 elsif kind='ace' then
   if keys<>2 or not (p_outcome ?& array['kind','team']) then raise exception 'Invalid scouting ace'; end if;
   return jsonb_build_object('kind',kind,'team',team);
 end if;
 raise exception 'Invalid scouting outcome kind';
end; $$;
revoke all on function public.scouting_normalize_rally_outcome(jsonb) from public,anon,authenticated;

alter table public.scouting_rallies add column if not exists outcome jsonb;
alter table public.scouting_rallies add constraint scouting_rallies_outcome_shape check (
 outcome is null or (jsonb_typeof(outcome)='object' and outcome=public.scouting_normalize_rally_outcome(outcome))
);
comment on column public.scouting_rallies.outcome is 'Optional explicit ending. Historical null means unclassified; never infer a reception error.';


create or replace function public.scouting_result_v2(p_fundamental text,p_key text)
returns jsonb language sql immutable set search_path = '' as $$
 select jsonb_build_object('label',v.label,'level',v.level) from (values
 ('saque','erro','Erro',0),('saque','entrou','Entrou',1),('saque','dificultou','Dificultou',2),('saque','ace','Ace',3),
 ('recepcao','erro','Erro',0),('recepcao','c_baixo','Limitada',1),('recepcao','b_medio','Boa',2),('recepcao','a_alto','Completa',3),
 ('levantamento','erro','Erro',0),('levantamento','manteve','Manteve',1),('levantamento','organizou','Organizou',2),('levantamento','decisivo','Preciso',3),
 ('ataque','freeball_devolvida','Freeball devolvida',1),('ataque','bloqueio_continua','Bloqueado, continuou',2),
 ('ataque','erro','Erro',0),('ataque','bloqueio_ponto','Bloq. ponto',0),('ataque','continuidade','Em jogo',2),('ataque','ponto','Ponto',3),
 ('bloqueio','erro','Erro',0),('bloqueio','tocou','Tocou',1),('bloqueio','amorteceu','Amorteceu',2),('bloqueio','ponto','Ponto',3),
 ('defesa','nao_defendeu','NÃ£o defendeu',0),('defesa','manteve_viva','Manteve viva',1),('defesa','defesa_boa','Defesa boa',2),('defesa','contra_ataque','Contra-ataque',3),
 ('cobertura','falhou','Falhou',0),('cobertura','presente','Presente',1),('cobertura','recuperou','Recuperou',2),('cobertura','virou_ponto','Virou ponto',3),
 ('transicao','quebrou','Quebrou',0),('transicao','lenta','Lenta',1),('transicao','organizada','Organizada',2),('transicao','efetiva','Efetiva',3),
 ('comunicacao','falhou','Falhou',0),('comunicacao','tardia','Tardia',1),('comunicacao','clara','Clara',2),('comunicacao','lideranca','LideranÃ§a',3)
 ) v(fundamental,key,label,level) where v.fundamental=p_fundamental and v.key=p_key;
$$;

revoke all on function public.scouting_result_v2(text,text) from public,anon,authenticated;

create or replace function public.get_scouting_detail(p_session_id text,p_organization_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
 if not public.scouting_can_access(p_session_id,p_organization_id) then raise exception 'Scouting access denied' using errcode='42501'; end if;
 return jsonb_build_object(
   'captureVersion',3,
   'session',(select to_jsonb(s) from public.scouting_sessions s where s.id=p_session_id),
   'actions',coalesce((select jsonb_agg(to_jsonb(a) order by a.createdat desc,a.id) from public.scouting_actions a where a.session_id=p_session_id),'[]'),
   'rallies',coalesce((select jsonb_agg(to_jsonb(r) order by r.set_number,r.number) from public.scouting_rallies r where r.session_id=p_session_id and r.voided_at is null),'[]')
 );
end; $$;

revoke all on function public.get_scouting_detail(text,uuid) from public,anon;
grant execute on function public.get_scouting_detail(text,uuid) to authenticated;

create or replace function public.scouting_sync_legacy(p_session public.scouting_sessions)
returns void language plpgsql set search_path = '' as $$
declare c record;
begin
 if exists(select 1 from public.scouting_logs where id='legacy_'||p_session.id and (organization_id<>p_session.organization_id or classid<>p_session.classid)) then
   raise exception 'Scouting legacy scope conflict'; end if;
 select
 count(*) filter(where fundamental='saque' and result_level=0) s0,
 count(*) filter(where fundamental='saque' and result_level in (1,2)) s1,
 count(*) filter(where fundamental='saque' and result_level=3) s2,
 count(*) filter(where fundamental='recepcao' and result_level=0) r0,
 count(*) filter(where fundamental='recepcao' and result_level in (1,2)) r1,
 count(*) filter(where fundamental='recepcao' and result_level=3) r2,
 count(*) filter(where fundamental='levantamento' and result_level=0) l0,
 count(*) filter(where fundamental='levantamento' and result_level in (1,2)) l1,
 count(*) filter(where fundamental='levantamento' and result_level=3) l2,
 count(*) filter(where fundamental='ataque' and result_level=0) a0,
 count(*) filter(where fundamental='ataque' and result_level in (1,2)) a1,
 count(*) filter(where fundamental='ataque' and result_level=3) a2
 into c from public.scouting_actions where session_id=p_session.id and not (fundamental='ataque' and result_key='freeball_devolvida');
 insert into public.scouting_logs(id,client_id,organization_id,classid,unit,date,mode,
 serve_0,serve_1,serve_2,receive_0,receive_1,receive_2,set_0,set_1,set_2,attack_send_0,attack_send_1,attack_send_2,createdat,updatedat)
 values('legacy_'||p_session.id,'legacy_'||p_session.id,p_session.organization_id,p_session.classid,'',p_session.date,
 case when p_session.type='treino' then 'treino' else 'jogo' end,c.s0,c.s1,c.s2,c.r0,c.r1,c.r2,c.l0,c.l1,c.l2,c.a0,c.a1,c.a2,p_session.createdat,clock_timestamp())
 on conflict(id) do update set serve_0=excluded.serve_0,serve_1=excluded.serve_1,serve_2=excluded.serve_2,
 receive_0=excluded.receive_0,receive_1=excluded.receive_1,receive_2=excluded.receive_2,set_0=excluded.set_0,set_1=excluded.set_1,set_2=excluded.set_2,
 attack_send_0=excluded.attack_send_0,attack_send_1=excluded.attack_send_1,attack_send_2=excluded.attack_send_2,updatedat=excluded.updatedat;
end; $$;

revoke all on function public.scouting_sync_legacy(public.scouting_sessions) from public,anon,authenticated;

create or replace function public.apply_scouting_command(
 p_session_id text,p_organization_id uuid,p_expected_revision integer,p_request_id text,p_command text,p_payload jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.scouting_sessions; r public.scouting_rallies; receipt public.scouting_mutations;
 state jsonb; contacts jsonb; rally_outcome jsonb; c jsonb; result jsonb; outcome text; winner text; intent jsonb;
 i integer:=0; point_number integer; rotation integer; v_set_number integer; us integer; them integer;
 action_id text; rally_event_id text; t timestamptz:=clock_timestamp();
begin
 if not public.scouting_can_access(p_session_id,p_organization_id) then raise exception 'Scouting access denied' using errcode='42501'; end if;
 if p_request_id is null or length(p_request_id) not between 8 and 100 or p_request_id !~ '^[a-zA-Z0-9_-]+$' then raise exception 'Invalid scouting request'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>250000 then raise exception 'Invalid scouting payload'; end if;
 select * into s from public.scouting_sessions where id=p_session_id and organization_id=p_organization_id for update;
 intent:=jsonb_build_object('command',p_command,'payload',p_payload);
 select * into receipt from public.scouting_mutations where session_id=s.id and request_id=p_request_id;
 if found then
   if receipt.intent_hash<>encode(sha256(convert_to(intent::text,'UTF8')),'hex') or receipt.created_by is distinct from auth.uid() then raise exception 'Scouting request reused with different content'; end if;
   return public.get_scouting_detail(s.id,s.organization_id);
 end if;
 if p_expected_revision is null or s.revision<>p_expected_revision then raise exception 'Scouting revision conflict' using errcode='40001'; end if;
 if s.status='concluido' then raise exception 'Scouting session completed'; end if;
 state:=s.match_state;
 if p_command='start_set' then
   if s.type='treino' or coalesce(jsonb_array_length(state->'recoveredDraft'),0)>0 or coalesce(state->'recoveredOutcome','null'::jsonb)<>'null'::jsonb then raise exception 'Scouting set unavailable'; end if;
   v_set_number:=(p_payload->>'setNumber')::integer; rotation:=(p_payload->>'rotation')::integer;
   us:=(p_payload->>'scoreUs')::integer; them:=(p_payload->>'scoreThem')::integer;
   if v_set_number is null or v_set_number not between 1 and 99 or (state is not null and v_set_number<>(state->>'setNumber')::integer+1)
     or us is null or them is null or us not between 0 and 999 or them not between 0 and 999
     or coalesce(p_payload->>'serve','') not in ('us','them') or (rotation is not null and rotation not between 1 and 6) then raise exception 'Invalid scouting set'; end if;
   state:=jsonb_build_object('setNumber',v_set_number,'scoreUs',us,'scoreThem',them,'serve',p_payload->>'serve','rotation',rotation,'recoveredDraft','[]'::jsonb,'recoveredOutcome',null);
 elsif p_command in ('point','action') then
   contacts:=public.scouting_normalize_contacts(p_payload->'contacts',s.organization_id,s.classid);
   if p_command='action' then
     if s.type<>'treino' or jsonb_array_length(contacts)<>1 then raise exception 'Scouting action requires training'; end if;
   else
     winner:=p_payload->>'winner';
     if state is null or winner is null or winner not in ('us','them') then raise exception 'Scouting set not configured'; end if;
     -- An absent field preserves a reopened ending for older clients. JSON null explicitly clears it.
     rally_outcome:=public.scouting_normalize_rally_outcome(case when p_payload ? 'outcome' then p_payload->'outcome' else state->'recoveredOutcome' end);
     if rally_outcome is not null then
       if (rally_outcome->>'kind'='falta' and winner=rally_outcome->>'team') or
          (rally_outcome->>'kind'='ace' and winner<>rally_outcome->>'team') then
         raise exception 'Scouting outcome contradicts point'; end if;
       if rally_outcome->>'kind'='ace' and rally_outcome->>'team' is distinct from state->>'serve' then
         raise exception 'Scouting ace contradicts serve'; end if;
       if rally_outcome->>'kind'='ace' and (jsonb_array_length(contacts)>1 or
          (jsonb_array_length(contacts)=1 and not (
            (rally_outcome->>'team'='them' and contacts->0->>'fundamental'='recepcao' and contacts->0->>'resultKey'='erro') or
            (rally_outcome->>'team'='us' and contacts->0->>'fundamental'='saque' and contacts->0->>'resultKey'='ace')
          ))) then raise exception 'Scouting ace contradicts contacts'; end if;
       if rally_outcome->>'kind'='falta' and rally_outcome->>'reason'='linha_saque' and
          rally_outcome->>'team' is distinct from state->>'serve' then
         raise exception 'Scouting service fault contradicts serve'; end if;
     end if;
     for c in select value from jsonb_array_elements(contacts) loop
       outcome:=public.scouting_contact_outcome(c); i:=i+1;
       if outcome is not null and (outcome<>winner or i<>jsonb_array_length(contacts)) then raise exception 'Scouting contact contradicts point'; end if;
     end loop;
     v_set_number:=(state->>'setNumber')::integer;
     select coalesce(max(number),0)+1 into point_number from public.scouting_rallies where session_id=s.id and scouting_rallies.set_number=v_set_number and voided_at is null;
     us:=(state->>'scoreUs')::integer+case when winner='us' then 1 else 0 end;
     them:=(state->>'scoreThem')::integer+case when winner='them' then 1 else 0 end;
     rotation:=(state->>'rotation')::integer;
     rally_event_id:='sr_'||p_request_id;
     insert into public.scouting_rallies(id,session_id,organization_id,classid,set_number,number,won,serve,rotation,score_us,score_them,contacts,outcome,createdat,created_by)
     values(rally_event_id,s.id,s.organization_id,s.classid,v_set_number,point_number,winner='us',state->>'serve',rotation,us,them,contacts,rally_outcome,t,auth.uid());
     if winner='us' and state->>'serve'='them' and rotation is not null then rotation:=(rotation+4)%6+1; end if;
     state:=state||jsonb_build_object('scoreUs',us,'scoreThem',them,'serve',winner,'rotation',rotation,'recoveredDraft','[]'::jsonb,'recoveredOutcome',null);
   end if;
   i:=0;
   for c in select value from jsonb_array_elements(contacts) loop
     result:=public.scouting_result_v2(c->>'fundamental',c->>'resultKey'); action_id:='sa_'||p_request_id||'_'||i;
     insert into public.scouting_actions(id,session_id,organization_id,classid,student_id,athlete_name,fundamental,phase,result_key,result_label,result_level,createdat,rally_event_id,contact_index,capture_zone,rubric_version)
     values(action_id,s.id,s.organization_id,s.classid,c->>'studentId',c->>'athleteName',c->>'fundamental',c->>'phase',c->>'resultKey',result->>'label',(result->>'level')::integer,t+i*interval '1 microsecond',rally_event_id,case when rally_event_id is not null then i else null end,(c->>'zone')::integer,case when c->>'fundamental'='ataque' and c->>'resultKey' in ('freeball_devolvida','bloqueio_continua') then 3 else 2 end);
     i:=i+1;
   end loop;
 elsif p_command='reopen_point' then
   if state is null or coalesce(jsonb_array_length(state->'recoveredDraft'),0)>0 or coalesce(state->'recoveredOutcome','null'::jsonb)<>'null'::jsonb then raise exception 'Resolve scouting draft first'; end if;
   select * into r from public.scouting_rallies where session_id=s.id and voided_at is null order by scouting_rallies.set_number desc,number desc limit 1;
   if not found or r.id is distinct from p_payload->>'rallyId' or r.set_number<>(state->>'setNumber')::integer then raise exception 'Scouting point is not the latest in this set'; end if;
   delete from public.scouting_actions where scouting_actions.rally_event_id=r.id;
   update public.scouting_rallies set voided_at=t,voided_by=auth.uid() where id=r.id;
   state:=state||jsonb_build_object('scoreUs',r.score_us-case when r.won then 1 else 0 end,'scoreThem',r.score_them-case when r.won then 0 else 1 end,
     'serve',r.serve,'rotation',r.rotation,'recoveredDraft',r.contacts,'recoveredOutcome',r.outcome);
 elsif p_command='undo_action' then
   if s.type<>'treino' then raise exception 'Reopen the scouting point instead'; end if;
   select id into action_id from public.scouting_actions where session_id=s.id and scouting_actions.rally_event_id is null order by createdat desc,id desc limit 1;
   if not found or action_id is distinct from p_payload->>'actionId' then raise exception 'Scouting action is not the latest'; end if;
   delete from public.scouting_actions where id=action_id;
 elsif p_command='discard_draft' then
   if state is null then raise exception 'Scouting set not configured'; end if;
   state:=state||jsonb_build_object('recoveredDraft','[]'::jsonb,'recoveredOutcome',null);
 elsif p_command='complete' then
   if coalesce(jsonb_array_length(state->'recoveredDraft'),0)>0 or coalesce(state->'recoveredOutcome','null'::jsonb)<>'null'::jsonb then raise exception 'Resolve scouting draft first'; end if;
   s.status:='concluido'; s.completed_at:=t;
 else raise exception 'Unknown scouting command';
 end if;
 update public.scouting_sessions set match_state=state,revision=revision+1,updatedat=t,status=s.status,completed_at=s.completed_at where id=s.id returning * into s;
 perform public.scouting_sync_legacy(s);
 insert into public.scouting_mutations(session_id,request_id,intent_hash,created_by) values(s.id,p_request_id,encode(sha256(convert_to(intent::text,'UTF8')),'hex'),auth.uid());
 return public.get_scouting_detail(s.id,s.organization_id);
end; $$;

revoke all on function public.apply_scouting_command(text,uuid,integer,text,text,jsonb) from public,anon;
grant execute on function public.apply_scouting_command(text,uuid,integer,text,text,jsonb) to authenticated;
