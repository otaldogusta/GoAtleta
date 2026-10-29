-- Immutable snapshots; no public access to the original class/editor document.
create table public.court_shares (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 class_id text not null references public.classes(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade,
 source_key text not null check(length(source_key) between 1 and 160),
 proof_hash text not null,
 document jsonb not null,
 revoked_at timestamptz,
 updated_at timestamptz not null default now(),
 unique(organization_id,class_id,created_by,source_key)
);
alter table public.court_shares enable row level security;
revoke all on public.court_shares from public,anon,authenticated;

create function public.court_share_can_manage(p_org uuid,p_class text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.classes c
 where c.id=p_class and c.organization_id=p_org
 and (public.is_org_admin(p_org) or public.is_class_staff(p_class)));
$$;

create function public.get_court_share(p_org uuid,p_class text,p_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.court_shares;
begin
 if not public.court_share_can_manage(p_org,p_class) then raise exception 'access denied' using errcode='42501'; end if;
 select * into s from public.court_shares where organization_id=p_org and class_id=p_class and source_key=p_key and created_by=auth.uid();
 if s.id is null then return null; end if;
 return jsonb_build_object('id',s.id,'revoked',s.revoked_at is not null,'updatedAt',s.updated_at);
end; $$;

create function public.publish_court_share(p_org uuid,p_class text,p_key text,p_document jsonb,p_proof text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.court_shares; d jsonb; e jsonb;
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
 -- Whitelist the editor projection and remove private enrollment/lesson links,
 -- even when a caller bypasses the client serializer. Labels/notes are authored content.
 e := p_document->'editor';
 e := jsonb_build_object('version',1,'coordinates','regulation','title',e->'title','folder','','tags','','favorite',false,
 'showActorNumbers',e->'showActorNumbers','actorRepresentation',e->'actorRepresentation',
 'drawings',e->'drawings','hiddenLayers',e->'hiddenLayers','actorMeta',coalesce((
 select jsonb_object_agg(key,jsonb_build_object('team',value->'team','locked',value->'locked','simulationSupport',value->'simulationSupport'))
 from jsonb_each(coalesce(e->'actorMeta','{}'::jsonb))),'{}'::jsonb));
 d := jsonb_build_object('version',1,'sport','volleyball_indoor','court',p_document->'court',
 'actors',p_document->'actors','markers',p_document->'markers','layers',p_document->'layers','timeline',p_document->'timeline','editor',e);
 insert into public.court_shares(organization_id,class_id,created_by,source_key,proof_hash,document)
 values(p_org,p_class,auth.uid(),p_key,encode(sha256(convert_to(p_proof,'UTF8')),'hex'),d)
 on conflict(organization_id,class_id,created_by,source_key) do update set
 proof_hash=excluded.proof_hash,document=excluded.document,revoked_at=null,updated_at=clock_timestamp()
 returning * into s;
 return jsonb_build_object('id',s.id,'revoked',false,'updatedAt',s.updated_at);
end; $$;

create function public.revoke_court_share(p_org uuid,p_class text,p_key text,p_share uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.court_share_can_manage(p_org,p_class) then raise exception 'access denied' using errcode='42501'; end if;
 update public.court_shares set revoked_at=now(),updated_at=clock_timestamp()
 where id=p_share and organization_id=p_org and class_id=p_class and source_key=p_key and created_by=auth.uid();
 if not found then raise exception 'access denied' using errcode='42501'; end if;
end; $$;

create function public.read_court_share(p_share uuid,p_proof text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.court_shares;
begin
 if p_proof is null or p_proof !~ '^[a-f0-9]{64}$' then return null; end if;
 select cs.* into s from public.court_shares cs join public.classes c on c.id=cs.class_id and c.organization_id=cs.organization_id
 where cs.id=p_share and cs.revoked_at is null and cs.proof_hash=encode(sha256(convert_to(p_proof,'UTF8')),'hex');
 if s.id is null then return null; end if;
 return jsonb_build_object('permission','viewer','document',s.document,'updatedAt',s.updated_at);
end; $$;
revoke all on function public.court_share_can_manage(uuid,text),public.get_court_share(uuid,text,text),public.publish_court_share(uuid,text,text,jsonb,text),public.revoke_court_share(uuid,text,text,uuid),public.read_court_share(uuid,text) from public,anon,authenticated;
grant execute on function public.court_share_can_manage(uuid,text),public.get_court_share(uuid,text,text),public.publish_court_share(uuid,text,text,jsonb,text),public.revoke_court_share(uuid,text,text,uuid) to authenticated;
grant execute on function public.read_court_share(uuid,text) to anon,authenticated;
