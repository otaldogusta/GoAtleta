-- Additive: historical actions retain their keys, levels and absence of a rally.
alter table public.scouting_sessions
  add column if not exists format text check (format in ('2x2','3x3','4x4','6x6','outro')),
  add column if not exists revision integer not null default 0 check (revision >= 0),
  add column if not exists match_state jsonb;

create table public.scouting_rallies (
  id text primary key,
  session_id text not null references public.scouting_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  classid text not null,
  set_number integer not null check (set_number between 1 and 99),
  number integer not null check (number > 0),
  won boolean not null,
  serve text not null check (serve in ('us','them')),
  rotation integer check (rotation between 1 and 6),
  score_us integer not null check (score_us >= 0),
  score_them integer not null check (score_them >= 0),
  contacts jsonb not null check (jsonb_typeof(contacts) = 'array'),
  createdat timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null
);
create unique index scouting_rallies_active_number on public.scouting_rallies(session_id,set_number,number) where voided_at is null;
create index scouting_rallies_scope on public.scouting_rallies(organization_id,classid,session_id);
alter table public.scouting_actions
  add column if not exists rally_event_id text references public.scouting_rallies(id) on delete cascade,
  add column if not exists contact_index integer check (contact_index >= 0),
  add column if not exists capture_zone integer check (capture_zone between 1 and 6),
  add column if not exists rubric_version integer;
create unique index scouting_actions_rally_order on public.scouting_actions(rally_event_id,contact_index) where rally_event_id is not null;

-- Receipts prevent replay after a timeout, including after a point is reopened.
create table public.scouting_mutations (
  session_id text not null references public.scouting_sessions(id) on delete cascade,
  request_id text not null,
  intent_hash text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (session_id,request_id)
);

create or replace function public.scouting_can_access(p_session text, p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
   select 1 from public.scouting_sessions s join public.classes c on c.id=s.classid and c.organization_id=s.organization_id
   where s.id=p_session and s.organization_id=p_org
     and (public.is_org_admin(s.organization_id) or public.is_class_staff(s.classid))
 );
$$;
revoke all on function public.scouting_can_access(text,uuid) from public,anon;
grant execute on function public.scouting_can_access(text,uuid) to authenticated;

alter table public.scouting_rallies enable row level security;
alter table public.scouting_mutations enable row level security;
create policy scouting_rallies_read on public.scouting_rallies for select to authenticated
 using (public.scouting_can_access(session_id,organization_id));
-- Receipts are private to the RPC; no direct client writes to either new table.
revoke all on public.scouting_rallies,public.scouting_mutations from public,anon,authenticated;
grant select on public.scouting_rallies to authenticated;

create or replace function public.scouting_result_v2(p_fundamental text,p_key text)
returns jsonb language sql immutable set search_path = '' as $$
 select jsonb_build_object('label',v.label,'level',v.level) from (values
 ('saque','erro','Erro',0),('saque','entrou','Entrou',1),('saque','dificultou','Dificultou',2),('saque','ace','Ace',3),
 ('recepcao','erro','Erro',0),('recepcao','c_baixo','Limitada',1),('recepcao','b_medio','Boa',2),('recepcao','a_alto','Completa',3),
 ('levantamento','erro','Erro',0),('levantamento','manteve','Manteve',1),('levantamento','organizou','Organizou',2),('levantamento','decisivo','Preciso',3),
 ('ataque','erro','Erro',0),('ataque','bloqueio_ponto','Bloq. ponto',0),('ataque','continuidade','Em jogo',2),('ataque','ponto','Ponto',3),
 ('bloqueio','erro','Erro',0),('bloqueio','tocou','Tocou',1),('bloqueio','amorteceu','Amorteceu',2),('bloqueio','ponto','Ponto',3),
 ('defesa','nao_defendeu','Não defendeu',0),('defesa','manteve_viva','Manteve viva',1),('defesa','defesa_boa','Defesa boa',2),('defesa','contra_ataque','Contra-ataque',3),
 ('cobertura','falhou','Falhou',0),('cobertura','presente','Presente',1),('cobertura','recuperou','Recuperou',2),('cobertura','virou_ponto','Virou ponto',3),
 ('transicao','quebrou','Quebrou',0),('transicao','lenta','Lenta',1),('transicao','organizada','Organizada',2),('transicao','efetiva','Efetiva',3),
 ('comunicacao','falhou','Falhou',0),('comunicacao','tardia','Tardia',1),('comunicacao','clara','Clara',2),('comunicacao','lideranca','Liderança',3)
 ) v(fundamental,key,label,level) where v.fundamental=p_fundamental and v.key=p_key;
$$;
revoke all on function public.scouting_result_v2(text,text) from public,anon,authenticated;

create or replace function public.scouting_contact_outcome(p_contact jsonb)
returns text language sql immutable set search_path = '' as $$
 select case
 when (p_contact->>'fundamental'='saque' and p_contact->>'resultKey'='ace')
   or (p_contact->>'fundamental' in ('ataque','bloqueio') and p_contact->>'resultKey'='ponto') then 'us'
 when (p_contact->>'fundamental' in ('saque','recepcao','levantamento','ataque','bloqueio') and p_contact->>'resultKey'='erro')
   or (p_contact->>'fundamental'='ataque' and p_contact->>'resultKey'='bloqueio_ponto')
   or (p_contact->>'fundamental'='defesa' and p_contact->>'resultKey'='nao_defendeu') then 'them'
 else null end;
$$;
revoke all on function public.scouting_contact_outcome(jsonb) from public,anon,authenticated;

create or replace function public.scouting_normalize_contacts(p_contacts jsonb,p_org uuid,p_class text)
returns jsonb language plpgsql set search_path = '' as $$
declare c jsonb; result jsonb; output jsonb:='[]'; student_name text; student_id text; z integer;
begin
 if p_contacts is null or jsonb_typeof(p_contacts)<>'array' or jsonb_array_length(p_contacts)>100 then
   raise exception 'Invalid scouting contacts'; end if;
 for c in select value from jsonb_array_elements(p_contacts) loop
   if jsonb_typeof(c)<>'object' then raise exception 'Invalid scouting contact'; end if;
   result:=public.scouting_result_v2(c->>'fundamental',c->>'resultKey');
   if result is null or coalesce(c->>'phase','') not in ('saque','side_out','transicao','pressao','freeball') then
     raise exception 'Invalid scouting result'; end if;
   z:=(c->>'zone')::integer;
   if z is not null and z not between 1 and 6 then raise exception 'Invalid scouting zone'; end if;
   student_id:=nullif(btrim(c->>'studentId'),''); student_name:=nullif(btrim(c->>'athleteName'),'');
   if student_id is not null then
     select st.name into student_name from public.students st
     where st.id=student_id and st.organization_id=p_org and (
       exists(select 1 from public.student_class_enrollments e where e.student_id=st.id and e.organization_id=p_org and e.class_id=p_class and e.status='active')
       or (st.classid=p_class and not exists(select 1 from public.student_class_enrollments e where e.student_id=st.id and e.organization_id=p_org and e.status='active'))
     );
     if not found then raise exception 'Scouting athlete outside class'; end if;
   end if;
   if length(coalesce(student_name,''))>160 then raise exception 'Invalid scouting athlete name'; end if;
   output:=output||jsonb_build_array(jsonb_build_object('studentId',student_id,'athleteName',student_name,
     'fundamental',c->>'fundamental','phase',c->>'phase','resultKey',c->>'resultKey','zone',z));
 end loop;
 return output;
end; $$;
revoke all on function public.scouting_normalize_contacts(jsonb,uuid,text) from public,anon,authenticated;

create or replace function public.get_scouting_detail(p_session_id text,p_organization_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
 if not public.scouting_can_access(p_session_id,p_organization_id) then raise exception 'Scouting access denied' using errcode='42501'; end if;
 return jsonb_build_object(
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
 into c from public.scouting_actions where session_id=p_session.id;
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
 state jsonb; contacts jsonb; c jsonb; result jsonb; outcome text; winner text; intent jsonb;
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
   if s.type='treino' or coalesce(jsonb_array_length(state->'recoveredDraft'),0)>0 then raise exception 'Scouting set unavailable'; end if;
   v_set_number:=(p_payload->>'setNumber')::integer; rotation:=(p_payload->>'rotation')::integer;
   us:=(p_payload->>'scoreUs')::integer; them:=(p_payload->>'scoreThem')::integer;
   if v_set_number is null or v_set_number not between 1 and 99 or (state is not null and v_set_number<>(state->>'setNumber')::integer+1)
     or us is null or them is null or us not between 0 and 999 or them not between 0 and 999
     or coalesce(p_payload->>'serve','') not in ('us','them') or (rotation is not null and rotation not between 1 and 6) then raise exception 'Invalid scouting set'; end if;
   state:=jsonb_build_object('setNumber',v_set_number,'scoreUs',us,'scoreThem',them,'serve',p_payload->>'serve','rotation',rotation,'recoveredDraft','[]'::jsonb);
 elsif p_command in ('point','action') then
   contacts:=public.scouting_normalize_contacts(p_payload->'contacts',s.organization_id,s.classid);
   if p_command='action' then
     if s.type<>'treino' or jsonb_array_length(contacts)<>1 then raise exception 'Scouting action requires training'; end if;
   else
     winner:=p_payload->>'winner';
     if state is null or winner is null or winner not in ('us','them') then raise exception 'Scouting set not configured'; end if;
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
     insert into public.scouting_rallies(id,session_id,organization_id,classid,set_number,number,won,serve,rotation,score_us,score_them,contacts,createdat,created_by)
     values(rally_event_id,s.id,s.organization_id,s.classid,v_set_number,point_number,winner='us',state->>'serve',rotation,us,them,contacts,t,auth.uid());
     if winner='us' and state->>'serve'='them' and rotation is not null then rotation:=(rotation+4)%6+1; end if;
     state:=state||jsonb_build_object('scoreUs',us,'scoreThem',them,'serve',winner,'rotation',rotation,'recoveredDraft','[]'::jsonb);
   end if;
   i:=0;
   for c in select value from jsonb_array_elements(contacts) loop
     result:=public.scouting_result_v2(c->>'fundamental',c->>'resultKey'); action_id:='sa_'||p_request_id||'_'||i;
     insert into public.scouting_actions(id,session_id,organization_id,classid,student_id,athlete_name,fundamental,phase,result_key,result_label,result_level,createdat,rally_event_id,contact_index,capture_zone,rubric_version)
     values(action_id,s.id,s.organization_id,s.classid,c->>'studentId',c->>'athleteName',c->>'fundamental',c->>'phase',c->>'resultKey',result->>'label',(result->>'level')::integer,t+i*interval '1 microsecond',rally_event_id,case when rally_event_id is not null then i else null end,(c->>'zone')::integer,2);
     i:=i+1;
   end loop;
 elsif p_command='reopen_point' then
   if state is null or coalesce(jsonb_array_length(state->'recoveredDraft'),0)>0 then raise exception 'Resolve scouting draft first'; end if;
   select * into r from public.scouting_rallies where session_id=s.id and voided_at is null order by scouting_rallies.set_number desc,number desc limit 1;
   if not found or r.id is distinct from p_payload->>'rallyId' or r.set_number<>(state->>'setNumber')::integer then raise exception 'Scouting point is not the latest in this set'; end if;
   delete from public.scouting_actions where scouting_actions.rally_event_id=r.id;
   update public.scouting_rallies set voided_at=t,voided_by=auth.uid() where id=r.id;
   state:=state||jsonb_build_object('scoreUs',r.score_us-case when r.won then 1 else 0 end,'scoreThem',r.score_them-case when r.won then 0 else 1 end,
     'serve',r.serve,'rotation',r.rotation,'recoveredDraft',r.contacts);
 elsif p_command='undo_action' then
   if s.type<>'treino' then raise exception 'Reopen the scouting point instead'; end if;
   select id into action_id from public.scouting_actions where session_id=s.id and scouting_actions.rally_event_id is null order by createdat desc,id desc limit 1;
   if not found or action_id is distinct from p_payload->>'actionId' then raise exception 'Scouting action is not the latest'; end if;
   delete from public.scouting_actions where id=action_id;
 elsif p_command='discard_draft' then
   if state is null then raise exception 'Scouting set not configured'; end if;
   state:=state||jsonb_build_object('recoveredDraft','[]'::jsonb);
 elsif p_command='complete' then
   if coalesce(jsonb_array_length(state->'recoveredDraft'),0)>0 then raise exception 'Resolve scouting draft first'; end if;
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

-- Preserve legacy standalone clients, but prevent direct edits to linked points,
-- completed sessions, protected state or mismatched organization/class records.
create or replace function public.guard_scouting_write()
returns trigger language plpgsql set search_path = '' as $$
declare s public.scouting_sessions;
begin
 if tg_table_name='scouting_sessions' then
   if tg_op='UPDATE' and (new.id<>old.id or new.organization_id<>old.organization_id or new.classid<>old.classid) then raise exception 'Scouting scope is immutable'; end if;
   if tg_op='UPDATE' and (new.type<>old.type or new.format is distinct from old.format) and
     (old.match_state is not null or exists(select 1 from public.scouting_actions where session_id=old.id)) then raise exception 'Scouting context is immutable after capture'; end if;
   if not exists(select 1 from public.classes where id=new.classid and organization_id=new.organization_id) then raise exception 'Scouting class scope mismatch'; end if;
   if current_user in ('authenticated','anon') then
     if tg_op='INSERT' and (new.match_state is not null or new.revision<>0) then raise exception 'Use scouting command'; end if;
     if tg_op='UPDATE' and (old.status='concluido' or new.match_state is distinct from old.match_state or new.revision<>old.revision
       or (old.match_state is not null and new.status<>old.status)) then raise exception 'Use scouting command'; end if;
   end if;
   if tg_op='UPDATE' and current_user in ('authenticated','anon') then new.revision:=old.revision+1; end if;
   return new;
 end if;
 select * into s from public.scouting_sessions where id=case when tg_op='DELETE' then old.session_id else new.session_id end for update;
 -- Parent deletion has already passed its own RLS; allow FK cascade cleanup.
 if not found and tg_op='DELETE' then return old; end if;
 if not found or s.status='concluido' then raise exception 'Scouting session completed or unavailable'; end if;
 if tg_op<>'DELETE' then
   if new.organization_id<>s.organization_id or new.classid<>s.classid then raise exception 'Scouting action scope mismatch'; end if;
   if tg_op='UPDATE' and (new.session_id<>old.session_id or new.id<>old.id) then raise exception 'Scouting action scope immutable'; end if;
 end if;
 if current_user in ('authenticated','anon') and (s.match_state is not null or
   (tg_op<>'INSERT' and old.rally_event_id is not null) or (tg_op<>'DELETE' and new.rally_event_id is not null)) then raise exception 'Use scouting command'; end if;
 if current_user in ('authenticated','anon') then
   update public.scouting_sessions set updatedat=clock_timestamp() where id=s.id;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.guard_scouting_write() from public,anon,authenticated;
create trigger scouting_zz_session_integrity before insert or update on public.scouting_sessions for each row execute function public.guard_scouting_write();
create trigger scouting_zz_action_integrity before insert or update or delete on public.scouting_actions for each row execute function public.guard_scouting_write();

-- Bounded history with aggregated counts; never download every contact to draw
-- an overview. Filters in the UI explicitly describe the loaded sample.
create or replace function public.get_scouting_overview(p_organization_id uuid,p_class_id text,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare output jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.classes c where c.id=p_class_id and c.organization_id=p_organization_id
   and (public.is_org_admin(c.organization_id) or public.is_class_staff(c.id))) then
   raise exception 'Scouting access denied' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 then raise exception 'Invalid scouting offset'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('session',to_jsonb(s),
   'counts',(select coalesce(jsonb_agg(to_jsonb(g)),'[]') from
     (select fundamental,result_key,result_level,count(*) as count from public.scouting_actions
       where session_id=s.id group by fundamental,result_key,result_level) g),
   'rallyStats',(select jsonb_build_object('total',count(*),'receiving',count(*) filter(where serve='them'),
      'receivingWon',count(*) filter(where serve='them' and won),'serving',count(*) filter(where serve='us'),
      'servingWon',count(*) filter(where serve='us' and won)) from public.scouting_rallies where session_id=s.id and voided_at is null)
 ) order by s.date desc,s.createdat desc,s.id),'[]') into output
 from (select * from public.scouting_sessions where organization_id=p_organization_id and classid=p_class_id
   order by date desc,createdat desc,id limit 50 offset p_offset) s;
 return output;
end; $$;
revoke all on function public.get_scouting_overview(uuid,text,integer) from public,anon;
grant execute on function public.get_scouting_overview(uuid,text,integer) to authenticated;
