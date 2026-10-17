-- Staff-only editor documents. Media bytes, object URLs and undo history stay local.
-- Additive: existing local drafts and read-only share projections are not changed.
create table public.scouting_video_documents (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id text not null references public.scouting_sessions(id) on delete cascade,
  fingerprint text not null check (length(fingerprint) between 1 and 256),
  document jsonb not null check (jsonb_typeof(document) = 'object' and octet_length(document::text) <= 15000000),
  revision integer not null check (revision > 0),
  mutation_id text not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, session_id, fingerprint)
);
create index scouting_video_documents_latest on public.scouting_video_documents(organization_id,session_id,updated_at desc);
create table public.scouting_video_document_mutations (
  organization_id uuid not null,
  session_id text not null,
  fingerprint text not null,
  mutation_id text not null check (length(mutation_id) between 1 and 128),
  intent_hash text not null,
  response jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id,session_id,fingerprint,mutation_id),
  foreign key (organization_id,session_id,fingerprint) references public.scouting_video_documents(organization_id,session_id,fingerprint) on delete cascade
);
alter table public.scouting_video_documents enable row level security;
alter table public.scouting_video_document_mutations enable row level security;
-- No table access, including for share viewers. Every access uses scoped RPCs.
revoke all on public.scouting_video_documents,public.scouting_video_document_mutations from public,anon,authenticated;

create or replace function public.scouting_video_document_number(p_value jsonb)
returns numeric language plpgsql immutable set search_path = '' as $$
declare parsed double precision;
begin
  if jsonb_typeof(p_value) is distinct from 'number' then return null; end if;
  -- Validate the number the JavaScript client can actually receive. JSONB numeric
  -- precision must not admit overflow, underflow or distinct times that become equal.
  begin
    parsed:=(p_value#>>'{}')::double precision;
  exception when numeric_value_out_of_range then return null;
  end;
  if not (parsed>'-Infinity'::double precision and parsed<'Infinity'::double precision) then return null; end if;
  return parsed::text::numeric;
end;
$$;
revoke all on function public.scouting_video_document_number(jsonb) from public,anon,authenticated;

create or replace function public.scouting_video_document_pick(p_object jsonb,p_keys text[])
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(p_object) where key=any(p_keys);
$$;
revoke all on function public.scouting_video_document_pick(jsonb,text[]) from public,anon,authenticated;

create or replace function public.scouting_video_normalize_document(p_document jsonb,p_fingerprint text)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare d jsonb:=p_document; m jsonb; a jsonb; r jsonb; c jsonb; p jsonb; source jsonb;
  duration numeric; n numeric; previous numeric; end_time numeric; rally_index integer:=0; result jsonb;
begin
  if d is null or jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>15000000
    or d->>'version' is distinct from '1' or jsonb_typeof(d->'media') is distinct from 'object'
    or jsonb_typeof(d->'rallies') is distinct from 'array' or jsonb_typeof(d->'contacts') is distinct from 'array'
    or jsonb_typeof(d->'corrections') is distinct from 'array' then
    raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023';
  end if;
  m:=d->'media'; duration:=public.scouting_video_document_number(m->'duration');
  if m->>'fingerprint' is distinct from p_fingerprint or jsonb_typeof(m->'fingerprint') is distinct from 'string'
    or jsonb_typeof(m->'name') is distinct from 'string' or length(m->>'name')>300
    or duration is null or duration<=0 or duration>86400
    or coalesce(public.scouting_video_document_number(m->'width'),0)<=0
    or coalesce(public.scouting_video_document_number(m->'height'),0)<=0
    or (m ? 'youtubeId' and (jsonb_typeof(m->'youtubeId') is distinct from 'string' or (m->>'youtubeId') !~ '^[A-Za-z0-9_-]{11}$'))
    or jsonb_array_length(d->'rallies') not between 1 and 2000
    or jsonb_array_length(d->'contacts')>20000 or jsonb_array_length(d->'corrections')>20000 then
    raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023';
  end if;
  if exists(select 1 from (select value->>'id' id from jsonb_array_elements(d->'rallies')
    union all select value->>'id' from jsonb_array_elements(d->'contacts')) entries group by id having count(*)>1) then
    raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023';
  end if;
  previous:=-1;
  for r in select value from jsonb_array_elements(d->'rallies') loop
    n:=public.scouting_video_document_number(r->'start');
    if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r->'id') is distinct from 'string'
      or length(r->>'id') not between 1 and 120
      or n is null or (previous=-1 and n<>0) or n<=previous or n>=duration
      or (r->'winner' is distinct from 'null'::jsonb and coalesce(r->>'winner','') not in ('us','them'))
      or jsonb_typeof(r->'reviewed') is distinct from 'boolean'
      or (r ? 'winnerContactId' and (jsonb_typeof(r->'winnerContactId') is distinct from 'string' or length(r->>'winnerContactId') not between 1 and 120)) then
      raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023';
    end if;
    end_time:=coalesce(public.scouting_video_document_number((d->'rallies')->(rally_index+1)->'start'),duration);
    if r ? 'pointTime' and (public.scouting_video_document_number(r->'pointTime') is null
      or public.scouting_video_document_number(r->'pointTime')<n or public.scouting_video_document_number(r->'pointTime')>=end_time) then
      raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023';
    end if;
    previous:=n; rally_index:=rally_index+1;
  end loop;
  for c in select value from jsonb_array_elements(d->'contacts') loop
    n:=public.scouting_video_document_number(c->'time');
    if jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(c->'id') is distinct from 'string'
      or length(c->>'id') not between 1 and 120
      or n is null or n<0 or n>=duration or coalesce(c->>'team','') not in ('us','them')
      or jsonb_typeof(c->'athlete') is distinct from 'string' or length(c->>'athlete')>80
      or (c->'studentId' is distinct from 'null'::jsonb and jsonb_typeof(c->'studentId') is distinct from 'string')
      or jsonb_typeof(c->'outcome') is distinct from 'string'
      or not exists (select 1 from (values
        ('Saque',array['','Em jogo','Ace','Erro']),('Recepção',array['','Controlada','Limitou o ataque','Bola devolvida direto','Erro']),
        ('Levantamento',array['','Atacável','Fora de condição','Bola enviada ao adversário','Erro']),('Ataque',array['','Em jogo','Ponto de ataque','Bloqueado','Erro']),
        ('Bloqueio',array['','Bola segue em jogo','Ponto de bloqueio','Erro']),('Defesa',array['','Controlada','Bola segue em jogo','Erro']),
        ('Bola de graça',array['','Em jogo','Ponto direto','Erro']),('Cobertura de ataque',array['','Controlada','Bola segue em jogo','Erro'])
      ) as outcomes(skill,values) where skill=c->>'skill' and (c->>'outcome')=any(values)) then
      raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023';
    end if;
  end loop;
  for p in select value from jsonb_array_elements(d->'corrections') loop
    if jsonb_typeof(p) is distinct from 'object' or public.scouting_video_document_number(p->'time') is null
      or public.scouting_video_document_number(p->'time')<0 or public.scouting_video_document_number(p->'time')>=duration
      or public.scouting_video_document_number(p->'x') is null or public.scouting_video_document_number(p->'x') not between 0 and 1
      or public.scouting_video_document_number(p->'y') is null or public.scouting_video_document_number(p->'y') not between 0 and 1 then
      raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023';
    end if;
  end loop;
  result:=jsonb_build_object('version',1,'media',public.scouting_video_document_pick(m,array['fingerprint','name','duration','width','height','youtubeId']),
    'rallies',(select jsonb_agg(public.scouting_video_document_pick(value,array['id','start','winner','winnerContactId','reviewed','pointTime'])) from jsonb_array_elements(d->'rallies')),
    'contacts',coalesce((select jsonb_agg(public.scouting_video_document_pick(value,array['id','time','skill','team','athlete','studentId','outcome'])) from jsonb_array_elements(d->'contacts')),'[]'::jsonb),
    'corrections',coalesce((select jsonb_agg(public.scouting_video_document_pick(value,array['time','x','y'])) from jsonb_array_elements(d->'corrections')),'[]'::jsonb));
  if d ? 'analysis' then
    a:=d->'analysis';
    if jsonb_typeof(a) is distinct from 'object' or coalesce(a->>'model','') not in ('vballnet-v2b-browser-1','vballnet-v2b-local','vballnet-v4c-browser-1','roboflow-volleyball-v2-3')
      or a->>'sampledFps' is distinct from '30' or jsonb_typeof(a->'positions') is distinct from 'array' or jsonb_typeof(a->'cuts') is distinct from 'array' then
      raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023';
    end if;
    if jsonb_array_length(a->'positions')>54000 or jsonb_array_length(a->'cuts')>2000 then raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023'; end if;
    previous:=-1;
    for p in select value from jsonb_array_elements(a->'positions') loop
      n:=public.scouting_video_document_number(p->'time');
      if jsonb_typeof(p) is distinct from 'object' or n is null or n<0 or n>=duration or n<=previous
        or public.scouting_video_document_number(p->'x') is null or public.scouting_video_document_number(p->'x') not between 0 and 1
        or public.scouting_video_document_number(p->'y') is null or public.scouting_video_document_number(p->'y') not between 0 and 1 then
        raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023';
      end if; previous:=n;
    end loop;
    previous:=0;
    for p in select value from jsonb_array_elements(a->'cuts') loop
      n:=public.scouting_video_document_number(p);
      if n is null or n<=previous or n>=duration then raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023'; end if; previous:=n;
    end loop;
    a:=jsonb_build_object('model',a->'model','sampledFps',30,'positions',coalesce((select jsonb_agg(public.scouting_video_document_pick(value,array['time','x','y'])) from jsonb_array_elements(a->'positions')),'[]'::jsonb),'cuts',a->'cuts');
    if d#>'{analysis,source}' is not null then
      source:=d#>'{analysis,source}';
      if not (m ? 'youtubeId') or m->>'fingerprint' is distinct from 'youtube:'||(m->>'youtubeId')
        or jsonb_typeof(source) is distinct from 'object' or jsonb_typeof(source->'fingerprint') is distinct from 'string'
        or coalesce(source->>'fingerprint','') !~ '^[A-Za-z0-9_-]{1,128}$'
        or jsonb_typeof(source->'name') is distinct from 'string' or length(btrim(source->>'name')) not between 1 and 300
        or (source->>'name') ~ '[\\/:[:cntrl:]]'
        or coalesce(public.scouting_video_document_number(source->'duration'),0) not between 0.000001 and 86400
        or coalesce(public.scouting_video_document_number(source->'width'),0) not between 1 and 16384
        or coalesce(public.scouting_video_document_number(source->'height'),0) not between 1 and 16384
        or public.scouting_video_document_number(source->'width')<>trunc(public.scouting_video_document_number(source->'width'))
        or public.scouting_video_document_number(source->'height')<>trunc(public.scouting_video_document_number(source->'height'))
        or public.scouting_video_document_number(source->'offsetSeconds') is null or abs(public.scouting_video_document_number(source->'offsetSeconds'))>1800 then
        raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023';
      end if;
      if exists(select 1 from (select value->'time' as t from jsonb_array_elements(a->'positions') union all select value from jsonb_array_elements(a->'cuts')) times
        where public.scouting_video_document_number(t)-public.scouting_video_document_number(source->'offsetSeconds')< -0.000001
          or public.scouting_video_document_number(t)-public.scouting_video_document_number(source->'offsetSeconds')>=public.scouting_video_document_number(source->'duration')) then
        raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023';
      end if;
      a:=a||jsonb_build_object('source',public.scouting_video_document_pick(source,array['fingerprint','name','duration','width','height','offsetSeconds']));
    end if;
    result:=result||jsonb_build_object('analysis',a);
  end if;
  return result;
end; $$;
revoke all on function public.scouting_video_normalize_document(jsonb,text) from public,anon,authenticated;

create or replace function public.get_scouting_video_document(p_org uuid,p_session text,p_fingerprint text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare d public.scouting_video_documents;
begin
  if not public.scouting_can_access(p_session,p_org) then raise exception 'VIDEO_DOCUMENT_ACCESS_DENIED' using errcode='42501'; end if;
  select * into d from public.scouting_video_documents where organization_id=p_org and session_id=p_session
    and (p_fingerprint is null or fingerprint=p_fingerprint) order by updated_at desc,fingerprint limit 1;
  if not found then return null; end if;
  return jsonb_build_object('organizationId',d.organization_id,'sessionId',d.session_id,'fingerprint',d.fingerprint,
    'revision',d.revision,'document',d.document,'updatedAt',d.updated_at,'mutationId',d.mutation_id);
end; $$;

create or replace function public.save_scouting_video_document(p_org uuid,p_session text,p_fingerprint text,p_document jsonb,p_expected_revision integer,p_mutation_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.scouting_sessions; d public.scouting_video_documents; receipt public.scouting_video_document_mutations;
  normalized jsonb; intent text; response jsonb; t timestamptz;
begin
  if not public.scouting_can_access(p_session,p_org) then raise exception 'VIDEO_DOCUMENT_ACCESS_DENIED' using errcode='42501'; end if;
  if p_fingerprint is null or length(p_fingerprint) not between 1 and 256 or p_expected_revision is null or p_expected_revision<0
    or p_mutation_id is null or length(p_mutation_id) not between 1 and 128 then raise exception 'VIDEO_DOCUMENT_INVALID' using errcode='22023'; end if;
  -- Serialize against completion/deletion and concurrent first saves, not just updates.
  select * into s from public.scouting_sessions where id=p_session and organization_id=p_org for update;
  if not found or not public.scouting_can_access(p_session,p_org) then raise exception 'VIDEO_DOCUMENT_ACCESS_DENIED' using errcode='42501'; end if;
  normalized:=public.scouting_video_normalize_document(p_document,p_fingerprint);
  intent:=encode(sha256(convert_to(jsonb_build_object('document',normalized,'expectedRevision',p_expected_revision)::text,'UTF8')),'hex');
  select * into receipt from public.scouting_video_document_mutations where organization_id=p_org and session_id=p_session
    and fingerprint=p_fingerprint and mutation_id=p_mutation_id;
  if found then
    if receipt.intent_hash<>intent or receipt.created_by is distinct from auth.uid() then raise exception 'VIDEO_DOCUMENT_MUTATION_REUSED' using errcode='22023'; end if;
    return receipt.response||jsonb_build_object('document',normalized);
  end if;
  if s.status is distinct from 'em_andamento' then raise exception 'VIDEO_DOCUMENT_SESSION_COMPLETED' using errcode='55000'; end if;
  -- Historic enrollment remains valid evidence when an athlete later changes class.
  if exists(select 1 from jsonb_array_elements(normalized->'contacts') c where c->>'studentId' is not null and not exists(
    select 1 from public.students st where st.id=c->>'studentId' and st.organization_id=p_org and (
      exists(select 1 from public.student_class_enrollments e where e.student_id=st.id and e.organization_id=p_org and e.class_id=s.classid)
      or (st.classid=s.classid and not exists(select 1 from public.student_class_enrollments e where e.student_id=st.id and e.organization_id=p_org))
    ))) then raise exception 'VIDEO_DOCUMENT_ATHLETE_OUTSIDE_CLASS' using errcode='22023'; end if;
  select * into d from public.scouting_video_documents where organization_id=p_org and session_id=p_session and fingerprint=p_fingerprint for update;
  if coalesce(d.revision,0)<>p_expected_revision then raise exception 'VIDEO_DOCUMENT_CONFLICT' using errcode='40001'; end if;
  t:=clock_timestamp();
  insert into public.scouting_video_documents(organization_id,session_id,fingerprint,document,revision,mutation_id,updated_by,updated_at)
    values(p_org,p_session,p_fingerprint,normalized,p_expected_revision+1,p_mutation_id,auth.uid(),t)
    on conflict(organization_id,session_id,fingerprint) do update set document=excluded.document,revision=excluded.revision,
      mutation_id=excluded.mutation_id,updated_by=excluded.updated_by,updated_at=excluded.updated_at returning * into d;
  response:=jsonb_build_object('organizationId',d.organization_id,'sessionId',d.session_id,'fingerprint',d.fingerprint,
    'revision',d.revision,'document',d.document,'updatedAt',d.updated_at,'mutationId',d.mutation_id);
  insert into public.scouting_video_document_mutations(organization_id,session_id,fingerprint,mutation_id,intent_hash,response,created_by)
    values(p_org,p_session,p_fingerprint,p_mutation_id,intent,response-'document',auth.uid());
  return response;
end; $$;
revoke all on function public.get_scouting_video_document(uuid,text,text),public.save_scouting_video_document(uuid,text,text,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.get_scouting_video_document(uuid,text,text),public.save_scouting_video_document(uuid,text,text,jsonb,integer,text) to authenticated;
