-- Shared video annotations are a separate, read-only projection. They never grant
-- access to scouting_sessions/actions, rosters, or another organization.
create table public.scouting_video_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id text not null references public.scouting_sessions(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  fingerprint text not null check (length(fingerprint) between 1 and 300),
  object_path text not null unique,
  byte_size bigint not null check (byte_size between 1 and 2147483648),
  content_type text not null check (content_type in ('video/mp4','video/webm','video/quicktime')),
  created_at timestamptz not null default now(),
  unique(organization_id, session_id, created_by, fingerprint)
);
create table public.scouting_video_shares (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.scouting_video_assets(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  audience text not null check (audience in ('team','link')),
  permission text not null default 'viewer' check (permission = 'viewer'),
  proof_hash text not null check (length(proof_hash) = 64),
  document jsonb not null check (octet_length(document::text) <= 15000000),
  team_name text not null check (length(team_name) <= 120),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  unique(asset_id)
);
alter table public.scouting_video_assets enable row level security;
alter table public.scouting_video_shares enable row level security;
revoke all on public.scouting_video_assets, public.scouting_video_shares from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scouting-videos','scouting-videos',false,2147483648,array['video/mp4','video/webm','video/quicktime']);
-- Project-level Storage limits still apply; this does not change a plan or quota.
create or replace function public.scouting_video_can_upload(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.scouting_video_assets a
    where a.object_path = p_path and a.created_by = auth.uid()
    and public.scouting_can_access(a.session_id,a.organization_id));
$$;
revoke all on function public.scouting_video_can_upload(text) from public, anon;
grant execute on function public.scouting_video_can_upload(text) to authenticated;
create policy scouting_video_upload on storage.objects for insert to authenticated
with check (bucket_id = 'scouting-videos' and public.scouting_video_can_upload(name));
-- TUS may read an existing upload; immutable object names have no UPDATE policy.
create policy scouting_video_upload_read on storage.objects for select to authenticated
using (bucket_id = 'scouting-videos' and public.scouting_video_can_upload(name));

create or replace function public.prepare_scouting_video_share(
 p_org uuid, p_session text, p_fingerprint text, p_size bigint, p_type text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.scouting_video_assets; s public.scouting_video_shares; v_id uuid;
begin
 if not public.scouting_can_access(p_session,p_org) then raise exception 'access denied' using errcode='42501'; end if;
 if p_fingerprint is null or length(p_fingerprint) not between 1 and 300 or p_size is null or p_size not between 1 and 2147483648
   or p_type is null or p_type not in ('video/mp4','video/webm','video/quicktime') then raise exception 'invalid media'; end if;
 v_id := gen_random_uuid();
 insert into public.scouting_video_assets(id,organization_id,session_id,created_by,fingerprint,object_path,byte_size,content_type)
 values(v_id,p_org,p_session,auth.uid(),p_fingerprint,p_org::text||'/'||v_id::text||'/video',p_size,p_type)
 on conflict(organization_id,session_id,created_by,fingerprint) do nothing;
 select * into a from public.scouting_video_assets where organization_id=p_org and session_id=p_session and created_by=auth.uid() and fingerprint=p_fingerprint;
 if a.byte_size <> p_size or a.content_type <> p_type then raise exception 'media mismatch'; end if;
 select * into s from public.scouting_video_shares where asset_id=a.id;
 return jsonb_build_object('assetId',a.id,'objectPath',a.object_path,
  'uploaded',exists(select 1 from storage.objects o where o.bucket_id='scouting-videos' and o.name=a.object_path and (o.metadata->>'size')::bigint=a.byte_size),
  'share',case when s.id is null then null else jsonb_build_object('id',s.id,'audience',s.audience,'expiresAt',s.expires_at,'revoked',s.revoked_at is not null,'updatedAt',s.updated_at) end);
end; $$;

create or replace function public.get_scouting_video_share(p_org uuid,p_session text,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 if not public.scouting_can_access(p_session,p_org) then raise exception 'access denied' using errcode='42501'; end if;
 select jsonb_build_object('id',s.id,'audience',s.audience,'expiresAt',s.expires_at,'revoked',s.revoked_at is not null,'updatedAt',s.updated_at)
 into result from public.scouting_video_shares s join public.scouting_video_assets a on a.id=s.asset_id
 where a.organization_id=p_org and a.session_id=p_session and a.created_by=auth.uid() and a.fingerprint=p_fingerprint;
 return result;
end; $$;

create or replace function public.publish_scouting_video_share(
 p_org uuid, p_session text, p_asset uuid, p_document jsonb, p_team text, p_audience text, p_proof text, p_days int
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.scouting_video_assets; s public.scouting_video_shares; d jsonb;
begin
 if not public.scouting_can_access(p_session,p_org) then raise exception 'access denied' using errcode='42501'; end if;
 select * into a from public.scouting_video_assets where id=p_asset and organization_id=p_org and session_id=p_session for update;
 if a.id is null then raise exception 'access denied' using errcode='42501'; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='scouting-videos' and o.name=a.object_path and (o.metadata->>'size')::bigint=a.byte_size)
 then raise exception 'video upload incomplete'; end if;
 if p_audience is null or p_audience not in ('team','link') or p_proof is null or p_proof !~ '^[a-f0-9]{64}$' or p_days is null or p_days not in (7,30)
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
 if p_document ? 'analysis' then d := d||jsonb_build_object('analysis',p_document->'analysis'); end if;
 insert into public.scouting_video_shares(asset_id,created_by,audience,proof_hash,document,team_name,expires_at)
 values(a.id,auth.uid(),p_audience,encode(sha256(convert_to(p_proof,'UTF8')),'hex'),d,p_team,now()+make_interval(days=>p_days))
 on conflict(asset_id) do update set audience=excluded.audience,proof_hash=excluded.proof_hash,document=excluded.document,
 team_name=excluded.team_name,expires_at=excluded.expires_at,updated_at=now(),revoked_at=null
 returning * into s;
 return jsonb_build_object('id',s.id,'audience',s.audience,'expiresAt',s.expires_at,'revoked',false,'updatedAt',s.updated_at);
end; $$;

create or replace function public.revoke_scouting_video_share(p_org uuid,p_session text,p_share uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.scouting_can_access(p_session,p_org) then raise exception 'access denied' using errcode='42501'; end if;
 update public.scouting_video_shares s set revoked_at=now(),updated_at=now()
 from public.scouting_video_assets a where s.id=p_share and s.asset_id=a.id and a.organization_id=p_org and a.session_id=p_session;
 if not found then raise exception 'access denied' using errcode='42501'; end if;
end; $$;

-- Only the Edge Function may resolve a proof and a verified identity. Anonymous
-- users cannot enumerate rows or supply somebody else's identity through REST.
create or replace function public.resolve_scouting_video_share(p_share uuid,p_proof text,p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.scouting_video_shares; a public.scouting_video_assets; game public.scouting_sessions; allowed boolean;
begin
 if p_proof is null or p_proof !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','LINK_UNAVAILABLE'); end if;
 select * into s from public.scouting_video_shares where id=p_share and revoked_at is null and expires_at>now()
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
  'objectPath',a.object_path,'updatedAt',s.updated_at,'expiresAt',s.expires_at,'permission','viewer');
end; $$;

revoke all on function public.prepare_scouting_video_share(uuid,text,text,bigint,text), public.publish_scouting_video_share(uuid,text,uuid,jsonb,text,text,text,int), public.revoke_scouting_video_share(uuid,text,uuid), public.resolve_scouting_video_share(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.prepare_scouting_video_share(uuid,text,text,bigint,text), public.publish_scouting_video_share(uuid,text,uuid,jsonb,text,text,text,int), public.revoke_scouting_video_share(uuid,text,uuid) to authenticated;
grant execute on function public.resolve_scouting_video_share(uuid,text,uuid) to service_role;
revoke all on function public.get_scouting_video_share(uuid,text,text) from public,anon;
grant execute on function public.get_scouting_video_share(uuid,text,text) to authenticated;
