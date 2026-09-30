-- Canonical class profile. All writes go through the authenticated assistant,
-- then this service-only atomic command; clients have scoped SELECT only.
create table public.class_pedagogical_profiles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  version integer not null default 0 check (version >= 0),
  profile jsonb not null default '{"schemaVersion":1,"facts":{}}',
  updated_at timestamptz not null default now(),
  primary key (organization_id, class_id)
);
create table public.class_profile_messages (
  id uuid primary key,
  organization_id uuid not null,
  class_id text not null,
  author_id uuid not null,
  content text not null check (length(content) between 1 and 12000),
  status text not null default 'pending' check (status in ('pending','interpreted')),
  reply text not null default '',
  question text not null default '',
  created_at timestamptz not null default now(),
  foreign key (organization_id,class_id) references public.class_pedagogical_profiles on delete cascade
);
create table public.class_profile_revisions (
  id uuid primary key,
  organization_id uuid not null,
  class_id text not null,
  author_id uuid not null,
  version integer not null,
  origin text not null check (origin in ('teacher','selector','legacy','evolution','undo')),
  before_profile jsonb not null,
  after_profile jsonb not null,
  changed_keys text[] not null,
  created_at timestamptz not null default now(),
  unique (organization_id,class_id,version),
  foreign key (organization_id,class_id) references public.class_pedagogical_profiles on delete cascade
);
create table public.class_profile_suggestions (
  id uuid primary key,
  organization_id uuid not null,
  class_id text not null,
  evidence_key text not null,
  base_version integer not null,
  candidate jsonb not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','reviewed')),
  created_at timestamptz not null default now(),
  unique (organization_id,class_id,evidence_key),
  foreign key (organization_id,class_id) references public.class_pedagogical_profiles on delete cascade
);
create index class_profile_messages_scope_date on public.class_profile_messages(organization_id,class_id,created_at);
create index class_profile_revisions_scope_date on public.class_profile_revisions(organization_id,class_id,created_at);

create function public.class_profile_actor_allowed(p_org uuid,p_class text,p_actor uuid)
returns boolean language sql stable security definer set search_path = public,pg_temp as $$
  select p_actor is not null and exists (
    select 1 from public.classes c join public.organization_members m on m.organization_id=c.organization_id
    where c.id=p_class and c.organization_id=p_org and m.user_id=p_actor
      and (m.role_level >= 50 or exists (
        select 1 from public.class_staff s where s.organization_id=p_org and s.class_id=p_class and s.user_id=p_actor
      ))
  );
$$;
revoke all on function public.class_profile_actor_allowed(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.class_profile_actor_allowed(uuid,text,uuid) to service_role;
create function public.can_read_class_profile(p_org uuid,p_class text)
returns boolean language sql stable security definer set search_path = public,pg_temp as $$
  select public.class_profile_actor_allowed(p_org,p_class,(select auth.uid()));
$$;
revoke all on function public.can_read_class_profile(uuid,text) from public,anon;
grant execute on function public.can_read_class_profile(uuid,text) to authenticated;

-- Read-only preview tokens include the complete original row. Manual, finalized
-- and completed lessons are never eligible, even if the browser is stale.
create function public.preview_class_profile_plans(p_org uuid,p_class text,p_dates date[])
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare result jsonb;
begin
  if not public.class_profile_actor_allowed(p_org,p_class,auth.uid()) then raise exception 'PROFILE_FORBIDDEN'; end if;
  if cardinality(p_dates)>62 then raise exception 'PROFILE_PREVIEW_TOO_LARGE'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('plan',to_jsonb(t),'token',md5(to_jsonb(t)::text))),'[]') into result
  from public.training_plans t
  where t.organization_id=p_org and t.classid=p_class and t.applydate=any(p_dates)
    and t.applydate>(now() at time zone 'America/Sao_Paulo')::date
    and t.origin='auto' and t.status='generated' and t.finalizedat is null and t.deleted_at is null
    and not exists(select 1 from public.session_logs s where s.organization_id=p_org and s.classid=p_class
      and case when pg_input_is_valid(s.createdat,'timestamp with time zone')
        then (s.createdat::timestamptz at time zone 'America/Sao_Paulo')::date=t.applydate
        else true end)
    and t.id=(select p.id from public.training_plans p where p.organization_id=p_org and p.classid=p_class and p.applydate=t.applydate and p.deleted_at is null
      order by p.version desc nulls last,p.createdat desc,p.id desc limit 1);
  return result;
end $$;
revoke all on function public.preview_class_profile_plans(uuid,text,date[]) from public,anon;
grant execute on function public.preview_class_profile_plans(uuid,text,date[]) to authenticated;

create function public.apply_class_profile_plan(p_org uuid,p_class text,p_base text,p_token text,p_version integer,p_plan jsonb)
returns text language plpgsql security definer set search_path = public,pg_temp as $$
declare base public.training_plans%rowtype; current_version integer; new_id text:=p_plan->>'id'; existing public.training_plans%rowtype;
begin
  if not public.class_profile_actor_allowed(p_org,p_class,auth.uid()) then raise exception 'PROFILE_FORBIDDEN'; end if;
  select version into current_version from public.class_pedagogical_profiles where organization_id=p_org and class_id=p_class for update;
  -- Short locks also coordinate with legacy writers that do not take advisory locks.
  lock table public.training_plans in share row exclusive mode;
  lock table public.session_logs in share mode;
  select * into existing from public.training_plans where id=new_id;
  if found then
    if existing.organization_id=p_org and existing.classid=p_class and existing.previous_version_id=p_base
      and existing.created_by=auth.uid() and existing.inputhash='profile:'||p_version||':'||p_token then return new_id; end if;
    raise exception 'PROFILE_REQUEST_REUSED';
  end if;
  if current_version is distinct from p_version then raise exception 'PROFILE_VERSION_CONFLICT'; end if;
  select * into base from public.training_plans where id=p_base and organization_id=p_org and classid=p_class;
  if not found or md5(to_jsonb(base)::text)<>p_token then raise exception 'PROFILE_PLAN_CHANGED'; end if;
  if not exists(select 1 from jsonb_array_elements(public.preview_class_profile_plans(p_org,p_class,array[base.applydate])) item where item->'plan'->>'id'=p_base)
    then raise exception 'PROFILE_PLAN_PROTECTED'; end if;
  if length(new_id) not between 1 and 120 or jsonb_typeof(p_plan->'main')<>'array' or jsonb_array_length(p_plan->'main')=0
    or p_plan->'pedagogy'->'decisionTrace'->'influences'->'pedagogicalProfile'->>'version' is distinct from p_version::text
    then raise exception 'PROFILE_PLAN_INVALID'; end if;
  insert into public.training_plans(id,organization_id,classid,title,tags,warmup,main,cooldown,warmuptime,maintime,cooldowntime,
    applydays,applydate,createdat,version,status,origin,inputhash,generatedat,parent_plan_id,previous_version_id,pedagogy,created_by,updated_by)
  values(new_id,p_org,p_class,p_plan->>'title',coalesce(p_plan->'tags','[]'),p_plan->'warmup',p_plan->'main',p_plan->'cooldown',
    p_plan->>'warmuptime',p_plan->>'maintime',p_plan->>'cooldowntime','{}',base.applydate,now(),coalesce(base.version,0)+1,
    'generated','auto','profile:'||p_version||':'||p_token,now(),coalesce(base.parent_plan_id,base.id),base.id,p_plan->'pedagogy',auth.uid(),auth.uid());
  return new_id;
end $$;
revoke all on function public.apply_class_profile_plan(uuid,text,text,text,integer,jsonb) from public,anon;
grant execute on function public.apply_class_profile_plan(uuid,text,text,text,integer,jsonb) to authenticated;

alter table public.class_pedagogical_profiles enable row level security;
alter table public.class_profile_messages enable row level security;
alter table public.class_profile_revisions enable row level security;
alter table public.class_profile_suggestions enable row level security;
revoke all on public.class_pedagogical_profiles,public.class_profile_messages,public.class_profile_revisions,public.class_profile_suggestions from anon,authenticated;
grant select on public.class_pedagogical_profiles,public.class_profile_messages,public.class_profile_revisions,public.class_profile_suggestions to authenticated;
grant all on public.class_pedagogical_profiles,public.class_profile_messages,public.class_profile_revisions,public.class_profile_suggestions to service_role;
create policy profile_read on public.class_pedagogical_profiles for select to authenticated using (public.can_read_class_profile(organization_id,class_id));
create policy profile_messages_read on public.class_profile_messages for select to authenticated using (public.can_read_class_profile(organization_id,class_id));
create policy profile_revisions_read on public.class_profile_revisions for select to authenticated using (public.can_read_class_profile(organization_id,class_id));
create policy profile_suggestions_read on public.class_profile_suggestions for select to authenticated using (public.can_read_class_profile(organization_id,class_id));

create function public.mutate_class_profile(
  p_org uuid,p_class text,p_actor uuid,p_request uuid,p_action text,
  p_payload jsonb default '{}',p_expected_version integer default null
) returns jsonb language plpgsql security invoker set search_path = public,pg_temp as $$
declare
  current_profile public.class_pedagogical_profiles;
  old_revision public.class_profile_revisions;
  old_message public.class_profile_messages;
  suggestion public.class_profile_suggestions;
  new_fact jsonb; previous_fact jsonb;
  next_profile jsonb;
  changes jsonb;
  item jsonb;
  fact_key text;
  changed text[] := '{}';
  origin text;
begin
  if not public.class_profile_actor_allowed(p_org,p_class,p_actor) then
    raise exception 'PROFILE_FORBIDDEN' using errcode='42501';
  end if;
  insert into public.class_pedagogical_profiles(organization_id,class_id) values(p_org,p_class) on conflict do nothing;
  select * into current_profile from public.class_pedagogical_profiles where organization_id=p_org and class_id=p_class for update;

  if p_action='message' then
    select * into old_message from public.class_profile_messages where id=p_request;
    if found then
      if old_message.organization_id<>p_org or old_message.class_id<>p_class or old_message.author_id<>p_actor or old_message.content<>p_payload->>'content' then
        raise exception 'PROFILE_REQUEST_REUSED';
      end if;
      return to_jsonb(old_message);
    end if;
    insert into public.class_profile_messages(id,organization_id,class_id,author_id,content)
      values(p_request,p_org,p_class,p_actor,p_payload->>'content') returning * into old_message;
    return to_jsonb(old_message);
  end if;

  if p_action='suggest' then
    if p_expected_version is null or current_profile.version<>p_expected_version then raise exception 'PROFILE_VERSION_CONFLICT' using errcode='40001'; end if;
    insert into public.class_profile_suggestions(id,organization_id,class_id,evidence_key,base_version,candidate,status)
    values(p_request,p_org,p_class,p_payload->>'evidenceKey',current_profile.version,p_payload->'candidate',case when p_payload->>'reviewed'='true' then 'reviewed' else 'pending' end) on conflict do nothing;
    return to_jsonb(current_profile);
  end if;
  if p_action='reject' then
    update public.class_profile_suggestions set status='rejected' where id=(p_payload->>'suggestionId')::uuid and organization_id=p_org and class_id=p_class and status='pending';
    return to_jsonb(current_profile);
  end if;

  select * into old_revision from public.class_profile_revisions where id=p_request;
  if found then
    if old_revision.organization_id<>p_org or old_revision.class_id<>p_class or old_revision.author_id<>p_actor then raise exception 'PROFILE_REQUEST_REUSED'; end if;
    return to_jsonb(current_profile);
  end if;
  if p_action='commit' then
    select * into old_message from public.class_profile_messages where id=p_request and organization_id=p_org and class_id=p_class and author_id=p_actor;
    if not found then raise exception 'PROFILE_MESSAGE_REQUIRED'; end if;
    if old_message.status='interpreted' then return to_jsonb(current_profile); end if;
  end if;
  if p_action='bootstrap' and current_profile.version>0 then return to_jsonb(current_profile); end if;
  if p_expected_version is null or current_profile.version<>p_expected_version then raise exception 'PROFILE_VERSION_CONFLICT' using errcode='40001'; end if;
  next_profile := current_profile.profile;
  origin := case p_action when 'commit' then 'teacher' when 'selectors' then 'selector' when 'bootstrap' then 'legacy' when 'accept' then 'evolution' when 'undo' then 'undo' end;
  if origin is null then raise exception 'PROFILE_INVALID_ACTION'; end if;

  if p_action='undo' then
    select * into old_revision from public.class_profile_revisions where id=(p_payload->>'revisionId')::uuid and organization_id=p_org and class_id=p_class;
    if not found then raise exception 'PROFILE_REVISION_NOT_FOUND'; end if;
    foreach fact_key in array old_revision.changed_keys loop
      -- Do not undo another revision's later change to the same key (including removal).
      if (next_profile->'facts'->fact_key) is not distinct from (old_revision.after_profile->'facts'->fact_key)
        and not exists(select 1 from public.class_profile_revisions r where r.organization_id=p_org and r.class_id=p_class and r.version>old_revision.version and fact_key=any(r.changed_keys)) then
        next_profile := jsonb_set(next_profile,'{facts}',(next_profile->'facts')-fact_key);
        if old_revision.before_profile->'facts' ? fact_key then
          next_profile := jsonb_set(next_profile,array['facts',fact_key],old_revision.before_profile->'facts'->fact_key);
        end if;
        changed := array_append(changed,fact_key);
      end if;
    end loop;
  else
    changes := coalesce(p_payload->'changes','[]');
    if p_action='accept' then
      select * into suggestion from public.class_profile_suggestions where id=(p_payload->>'suggestionId')::uuid and organization_id=p_org and class_id=p_class for update;
      if not found or suggestion.status<>'pending' or suggestion.base_version<>current_profile.version then raise exception 'PROFILE_SUGGESTION_STALE'; end if;
      changes := suggestion.candidate->'changes';
    end if;
    for item in select value from jsonb_array_elements(changes) loop
      fact_key := item->>'key';
      if fact_key not in ('gameFormat','netHeight','space','fundamentals','organization','continuity','bounce','rules','difficulties','priorities','objectives','resources','constraints','legacyContext') then raise exception 'PROFILE_INVALID_KEY'; end if;
      if p_action='selectors' and fact_key not in ('gameFormat','netHeight') then raise exception 'PROFILE_INVALID_SELECTOR'; end if;
      if item->>'value' is null then
        next_profile := jsonb_set(next_profile,'{facts}',(next_profile->'facts')-fact_key);
      else
        if length(item->>'value')>12000 then raise exception 'PROFILE_VALUE_TOO_LONG'; end if;
        new_fact := jsonb_build_object(
          'value',item->>'value','quote',coalesce(item->>'quote',''),'sourceId',p_request,'authorId',p_actor,
          'updatedAt',coalesce(p_payload->>'sourceDate',now()::text),'origin',origin);
        previous_fact := next_profile->'facts'->fact_key;
        if item->>'operation'='append' and previous_fact is not null then
          new_fact := new_fact || jsonb_build_object('value',(previous_fact->>'value')||'; '||(item->>'value'),
            'claims',coalesce(previous_fact->'claims',jsonb_build_array(previous_fact))||jsonb_build_array(new_fact));
        end if;
        next_profile := jsonb_set(next_profile,array['facts',fact_key],new_fact);
      end if;
      if (next_profile->'facts'->fact_key) is distinct from (current_profile.profile->'facts'->fact_key) then changed:=array_append(changed,fact_key); end if;
    end loop;
  end if;
  if cardinality(changed)>0 then
    insert into public.class_profile_revisions(id,organization_id,class_id,author_id,version,origin,before_profile,after_profile,changed_keys)
      values(p_request,p_org,p_class,p_actor,current_profile.version+1,origin,current_profile.profile,next_profile,changed);
    update public.class_pedagogical_profiles set profile=next_profile,version=version+1,updated_at=now()
      where organization_id=p_org and class_id=p_class returning * into current_profile;
  end if;
  if p_action='commit' then
    update public.class_profile_messages set status='interpreted',reply=coalesce(p_payload->>'reply',''),question=coalesce(p_payload->>'question','') where id=p_request;
  end if;
  if p_action='accept' then update public.class_profile_suggestions set status='accepted' where id=suggestion.id; end if;
  return to_jsonb(current_profile);
end;
$$;
revoke all on function public.mutate_class_profile(uuid,text,uuid,uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.mutate_class_profile(uuid,text,uuid,uuid,text,jsonb,integer) to service_role;
