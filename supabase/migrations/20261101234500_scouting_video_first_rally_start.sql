-- Allow a reviewed first rally to start after preparation footage.
-- Additive validation change only: no backfill, table, RPC authorization,
-- revision, mutation receipt or sharing changes. Existing start=0 stays valid.
-- Contacts and ball positions before the first rally remain in the video document.
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
      or n is null or n<0 or n<=previous or n>=duration
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
