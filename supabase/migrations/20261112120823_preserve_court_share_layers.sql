create or replace function public.publish_court_share(p_org uuid,p_class text,p_key text,p_document jsonb,p_proof text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  s public.court_shares;
  d jsonb;
  e jsonb;
  layer_order jsonb;
begin
  if not public.court_share_can_manage(p_org,p_class) then raise exception 'access denied' using errcode='42501'; end if;
  if p_key is null or length(p_key) not between 1 and 160 or p_proof is null or p_proof !~ '^[a-f0-9]{64}$'
  or p_document is null or octet_length(p_document::text)>2000000
  or p_document->>'version' is distinct from '1' or p_document->>'sport' is distinct from 'volleyball_indoor'
  or p_document#>>'{editor,version}' is distinct from '1' or p_document#>>'{editor,coordinates}' is distinct from 'regulation'
  or jsonb_typeof(p_document->'actors') is distinct from 'array'
  or jsonb_typeof(p_document#>'{timeline,steps}') is distinct from 'array'
  then raise exception 'invalid court share'; end if;
  if jsonb_array_length(p_document->'actors')>100 or jsonb_array_length(p_document#>'{timeline,steps}') not between 1 and 200
  then raise exception 'invalid court share'; end if;

  e := p_document->'editor';
  -- Keep only ordered references to objects in each stage, including hidden layers.
  if jsonb_typeof(e->'layerOrder') = 'object' then
    select jsonb_object_agg(step->>'id', coalesce((
      select jsonb_agg(jsonb_build_object('kind',kind,'id',id) order by first_position)
      from (
        select ref->>'kind' as kind, ref->>'id' as id, min(position) as first_position
        from jsonb_array_elements(e->'layerOrder'->(step->>'id')) with ordinality as refs(ref,position)
        where position <= 300 and jsonb_typeof(ref->'id') = 'string'
          and length(ref->>'id') between 1 and 120
          and case ref->>'kind'
            when 'actor' then p_document->'actors' @> jsonb_build_array(jsonb_build_object('id',ref->'id'))
              and (jsonb_typeof(step->'visibleActorIds') is distinct from 'array'
                or step->'visibleActorIds' @> jsonb_build_array(ref->'id'))
            when 'drawing' then e->'drawings'->(step->>'id') @> jsonb_build_array(jsonb_build_object('id',ref->'id'))
            else false
          end
        group by ref->>'kind',ref->>'id'
      ) ordered_refs
    ), '[]'::jsonb)) into layer_order
    from jsonb_array_elements(p_document#>'{timeline,steps}') as steps(step)
    where jsonb_typeof(step->'id') = 'string' and length(step->>'id') between 1 and 120
      and jsonb_typeof(e->'layerOrder'->(step->>'id')) = 'array';
  end if;

  -- Whitelist the editor projection even when a caller bypasses the client serializer.
  e := jsonb_build_object('version',1,'coordinates','regulation','title',e->'title','folder','','tags','','favorite',false,
    'showActorNumbers',e->'showActorNumbers','actorRepresentation',e->'actorRepresentation',
    'drawings',e->'drawings','hiddenLayers',e->'hiddenLayers','actorMeta',coalesce((
      select jsonb_object_agg(key,
        jsonb_build_object('team',value->'team','locked',value->'locked','simulationSupport',value->'simulationSupport')
        || case when jsonb_typeof(value->'hidden') = 'boolean' then jsonb_build_object('hidden',value->'hidden') else '{}'::jsonb end)
      from jsonb_each(coalesce(e->'actorMeta','{}'::jsonb))
    ), '{}'::jsonb));
  if layer_order is not null then e := e || jsonb_build_object('layerOrder',layer_order); end if;

  d := jsonb_build_object('version',1,'sport','volleyball_indoor','court',p_document->'court',
    'actors',p_document->'actors','markers',p_document->'markers','layers',p_document->'layers','timeline',p_document->'timeline','editor',e);
  insert into public.court_shares(organization_id,class_id,created_by,source_key,proof_hash,document)
  values(p_org,p_class,auth.uid(),p_key,encode(sha256(convert_to(p_proof,'UTF8')),'hex'),d)
  on conflict(organization_id,class_id,created_by,source_key) do update set
    proof_hash=excluded.proof_hash,document=excluded.document,revoked_at=null,updated_at=clock_timestamp()
  returning * into s;
  return jsonb_build_object('id',s.id,'revoked',false,'updatedAt',s.updated_at);
end; $$;
