-- New links have no expiry. Existing deadlines and revocations stay unchanged.
-- The signed storage URL still expires independently in the Edge Function.
alter table public.scouting_video_shares alter column expires_at drop not null;

create or replace function public.publish_scouting_video_share(
 p_org uuid, p_session text, p_asset uuid, p_document jsonb, p_team text, p_audience text, p_proof text, p_days int default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.scouting_video_assets; s public.scouting_video_shares; d jsonb;
begin
 if not public.scouting_can_access(p_session,p_org) then raise exception 'access denied' using errcode='42501'; end if;
 select * into a from public.scouting_video_assets where id=p_asset and organization_id=p_org and session_id=p_session for update;
 if a.id is null then raise exception 'access denied' using errcode='42501'; end if;
 if a.provider='storage' and not exists(select 1 from storage.objects o where o.bucket_id='scouting-videos' and o.name=a.object_path and (o.metadata->>'size')::bigint=a.byte_size)
 then raise exception 'video upload incomplete'; end if;
 if p_audience is null or p_audience not in ('team','link') or p_proof is null or p_proof !~ '^[a-f0-9]{64}$' or (p_days is not null and p_days not in (7,30))
 or p_team is null or length(p_team)>120 or p_document is null or octet_length(p_document::text)>15000000
 or p_document->>'version' is distinct from '1' or jsonb_typeof(p_document->'media') is distinct from 'object'
 or jsonb_typeof(p_document->'rallies') is distinct from 'array' or jsonb_typeof(p_document->'contacts') is distinct from 'array'
 or jsonb_typeof(p_document->'corrections') is distinct from 'array' then raise exception 'invalid share'; end if;
 if jsonb_array_length(p_document->'contacts')>20000 or jsonb_array_length(p_document->'rallies') not between 1 and 2000 then raise exception 'invalid share'; end if;
 -- Only the shared projection is stored. No local history, roster IDs, paths, or
 -- unrelated session payload can be disclosed by an altered client.
 d := jsonb_build_object('version',1,
  'media',jsonb_build_object('fingerprint','shared','name','Vídeo da análise','duration',p_document#>'{media,duration}','width',p_document#>'{media,width}','height',p_document#>'{media,height}'),
  'rallies',p_document->'rallies','corrections',p_document->'corrections',
  'contacts',coalesce((select jsonb_agg(jsonb_build_object('id','contact-'||n,'time',c->'time','skill',c->'skill','team',c->'team','athlete',c->'athlete','studentId',null,'outcome',c->'outcome')) from jsonb_array_elements(p_document->'contacts') with ordinality as x(c,n)),'[]'::jsonb));
 if a.provider='youtube' then
  if p_document#>>'{media,youtubeId}' is distinct from a.youtube_id then raise exception 'media mismatch'; end if;
  d := jsonb_set(d,'{media,youtubeId}',to_jsonb(a.youtube_id));
 elsif p_document#>>'{media,youtubeId}' is not null then raise exception 'media mismatch'; end if;
 if p_document ? 'analysis' then d := d||jsonb_build_object('analysis',p_document->'analysis'); end if;
 insert into public.scouting_video_shares(asset_id,created_by,audience,proof_hash,document,team_name,expires_at)
 values(a.id,auth.uid(),p_audience,encode(sha256(convert_to(p_proof,'UTF8')),'hex'),d,p_team,now()+make_interval(days=>p_days))
 on conflict(asset_id) do update set audience=excluded.audience,proof_hash=excluded.proof_hash,document=excluded.document,
 team_name=excluded.team_name,expires_at=excluded.expires_at,updated_at=now(),revoked_at=null
 returning * into s;
 return jsonb_build_object('id',s.id,'audience',s.audience,'expiresAt',s.expires_at,'revoked',false,'updatedAt',s.updated_at);
end; $$;

create or replace function public.resolve_scouting_video_share(p_share uuid,p_proof text,p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.scouting_video_shares; a public.scouting_video_assets; game public.scouting_sessions; allowed boolean;
begin
 if p_proof is null or p_proof !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','LINK_UNAVAILABLE'); end if;
 select * into s from public.scouting_video_shares where id=p_share and revoked_at is null and (expires_at is null or expires_at>now())
 and proof_hash=encode(sha256(convert_to(p_proof,'UTF8')),'hex');
 if s.id is null then return jsonb_build_object('error','LINK_UNAVAILABLE'); end if;
 select * into a from public.scouting_video_assets where id=s.asset_id;
 select * into game from public.scouting_sessions where id=a.session_id and organization_id=a.organization_id;
 if game.id is null then return jsonb_build_object('error','LINK_UNAVAILABLE'); end if;
 if s.audience='team' then
  if p_user is null then return jsonb_build_object('error','LOGIN_REQUIRED'); end if;
  -- Resolve membership for the verified viewer, never via caller-supplied JWT claims.
  allowed := exists(select 1 from public.students st where st.organization_id=a.organization_id and st.student_user_id=p_user
   and st.deleted_at is null and st.membership_status='active' and (
    exists(select 1 from public.student_class_enrollments e where e.organization_id=a.organization_id and e.student_id=st.id and e.class_id=game.classid and e.status='active')
    or (st.classid=game.classid and not exists(select 1 from public.student_class_enrollments e where e.organization_id=a.organization_id and e.student_id=st.id))));
  -- Apply the canonical staff permission helpers using the verified subject.
  perform set_config('request.jwt.claim.sub',p_user::text,true);
  allowed := allowed or public.scouting_can_access(a.session_id,a.organization_id);
  if not coalesce(allowed,false) then return jsonb_build_object('error','ACCESS_DENIED'); end if;
 end if;
 return jsonb_build_object('document',s.document,'teamName',s.team_name,'title',game.title,'opponent',game.opponent,
  'mediaProvider',a.provider,'youtubeId',a.youtube_id,'objectPath',a.object_path,'updatedAt',s.updated_at,'expiresAt',s.expires_at,'permission','viewer');
end; $$;
