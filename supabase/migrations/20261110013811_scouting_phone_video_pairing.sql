-- Temporary signaling only. The original never passes through Postgres.
create schema if not exists private;

create table private.scouting_phone_video_pairs (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  session_id text not null references public.scouting_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  proof_hash text not null check (proof_hash ~ '^[a-f0-9]{64}$'),
  offer text check (octet_length(offer) between 16 and 16384),
  answer text check (octet_length(answer) between 16 and 16384),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  closed_at timestamptz
);
alter table private.scouting_phone_video_pairs enable row level security;
revoke all on private.scouting_phone_video_pairs from public, anon, authenticated;
create unique index scouting_phone_video_one_pair
  on private.scouting_phone_video_pairs(owner_id, organization_id, class_id, session_id) where closed_at is null;
create index scouting_phone_video_owner_rate on private.scouting_phone_video_pairs(owner_id, created_at desc);
create index scouting_phone_video_expiry on private.scouting_phone_video_pairs(expires_at);

create function private.prune_scouting_phone_video_pairs()
returns void language sql set search_path = '' as $$
  with expired as (
    select p.id from private.scouting_phone_video_pairs p
    where p.expires_at <= clock_timestamp() order by p.expires_at limit 1000 for update skip locked
  )
  delete from private.scouting_phone_video_pairs p using expired e where p.id = e.id;
$$;
revoke all on function private.prune_scouting_phone_video_pairs() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule('scouting_phone_video_pair_expiry', '*/10 * * * *', 'select private.prune_scouting_phone_video_pairs()');
  end if;
end;
$$;

create function private.scouting_phone_video_can_host(p_org uuid, p_class text, p_session text)
returns boolean language sql stable set search_path = '' as $$
  select public.scouting_can_access(p_session, p_org) and exists (
    select 1 from public.scouting_sessions s
    where s.id = p_session and s.organization_id = p_org and s.classid = p_class
      and s.status in ('em_andamento', 'concluido')
  );
$$;
revoke all on function private.scouting_phone_video_can_host(uuid,text,text) from public, anon, authenticated;

create function public.scouting_phone_video_create(
  p_org uuid, p_class text, p_session text, p_id uuid, p_proof_hash text, p_offer text
)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_now timestamptz;
  v_expiry timestamptz;
begin
  if v_owner is null or not private.scouting_phone_video_can_host(p_org, p_class, p_session) then
    raise exception 'PHONE_VIDEO_ACCESS_DENIED' using errcode = '42501';
  end if;
  if p_id is null or p_proof_hash is null or p_proof_hash !~ '^[a-f0-9]{64}$'
     or p_offer is null or octet_length(p_offer) not between 16 and 16384 then
    raise exception 'PHONE_VIDEO_INVALID_PAIRING' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('scouting-phone-video:' || v_owner::text, 0));
  v_now := clock_timestamp();
  v_expiry := v_now + interval '10 minutes';
  if (select count(*) from private.scouting_phone_video_pairs p
      where p.owner_id = v_owner and p.created_at > v_now - interval '1 minute') >= 5 then
    raise exception 'PHONE_VIDEO_RATE_LIMITED' using errcode = 'PT429';
  end if;
  perform private.prune_scouting_phone_video_pairs();
  update private.scouting_phone_video_pairs p set closed_at = v_now, offer = null, answer = null
    where p.owner_id = v_owner and p.organization_id = p_org and p.class_id = p_class
      and p.session_id = p_session and p.closed_at is null;
  insert into private.scouting_phone_video_pairs
    (id, organization_id, class_id, session_id, owner_id, proof_hash, offer, created_at, expires_at)
    values (p_id, p_org, p_class, p_session, v_owner, p_proof_hash, p_offer, v_now, v_expiry);
  return v_expiry;
end;
$$;

create function public.scouting_phone_video_offer(p_id uuid, p_proof text)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if p_proof is null or p_proof !~ '^[a-f0-9]{64}$' then return null; end if;
  return (select p.offer from private.scouting_phone_video_pairs p
    where p.id = p_id and p.proof_hash = encode(sha256(convert_to(p_proof, 'UTF8')), 'hex')
      and p.closed_at is null and p.expires_at > statement_timestamp());
end;
$$;

create function public.scouting_phone_video_answer(p_id uuid, p_proof text, p_answer text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_proof_hash text;
begin
  if p_proof is null or p_proof !~ '^[a-f0-9]{64}$'
     or p_answer is null or octet_length(p_answer) not between 16 and 16384 then return false; end if;
  v_proof_hash := encode(sha256(convert_to(p_proof, 'UTF8')), 'hex');
  update private.scouting_phone_video_pairs p set answer = p_answer
    where p.id = p_id and p.proof_hash = v_proof_hash and p.answer is null
      and p.closed_at is null and p.expires_at > clock_timestamp();
  if found then return true; end if;
  return exists (select 1 from private.scouting_phone_video_pairs p
    where p.id = p_id and p.proof_hash = v_proof_hash and p.answer = p_answer
      and p.closed_at is null and p.expires_at > clock_timestamp());
end;
$$;

create function public.scouting_phone_video_read_answer(p_org uuid, p_class text, p_session text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_answer text;
begin
  if not private.scouting_phone_video_can_host(p_org, p_class, p_session) then
    raise exception 'PHONE_VIDEO_ACCESS_DENIED' using errcode = '42501';
  end if;
  select p.answer into v_answer from private.scouting_phone_video_pairs p
    where p.id = p_id and p.owner_id = auth.uid() and p.organization_id = p_org and p.class_id = p_class
      and p.session_id = p_session and p.closed_at is null and p.expires_at > statement_timestamp();
  if not found then raise exception 'PHONE_VIDEO_PAIRING_UNAVAILABLE' using errcode = 'PT410'; end if;
  return jsonb_build_object('answer', v_answer);
end;
$$;

create function public.scouting_phone_video_close(p_org uuid, p_class text, p_session text, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.scouting_phone_video_can_host(p_org, p_class, p_session) then
    raise exception 'PHONE_VIDEO_ACCESS_DENIED' using errcode = '42501';
  end if;
  update private.scouting_phone_video_pairs p set closed_at = clock_timestamp(), offer = null, answer = null
    where p.id = p_id and p.owner_id = auth.uid() and p.organization_id = p_org and p.class_id = p_class
      and p.session_id = p_session and p.closed_at is null;
end;
$$;

revoke all on function public.scouting_phone_video_create(uuid,text,text,uuid,text,text),
  public.scouting_phone_video_read_answer(uuid,text,text,uuid), public.scouting_phone_video_close(uuid,text,text,uuid),
  public.scouting_phone_video_offer(uuid,text), public.scouting_phone_video_answer(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.scouting_phone_video_create(uuid,text,text,uuid,text,text),
  public.scouting_phone_video_read_answer(uuid,text,text,uuid), public.scouting_phone_video_close(uuid,text,text,uuid)
  to authenticated;
grant execute on function public.scouting_phone_video_offer(uuid,text), public.scouting_phone_video_answer(uuid,text,text)
  to anon, authenticated;
