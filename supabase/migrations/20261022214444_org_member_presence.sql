begin;

create table private.org_member_presence (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null,
  primary key (organization_id, user_id)
);
alter table private.org_member_presence enable row level security;
revoke all on private.org_member_presence from public, anon, authenticated;

create function public.touch_my_org_presence(p_org_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org_id and m.user_id = auth.uid() and m.role_level > 0
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  insert into private.org_member_presence as presence(organization_id,user_id,last_seen_at)
    values(p_org_id,auth.uid(),clock_timestamp())
    on conflict(organization_id,user_id) do update set last_seen_at = excluded.last_seen_at
      where presence.last_seen_at < clock_timestamp() - interval '20 seconds';
end;
$$;

create function public.get_org_member_presence(p_org_id uuid,p_user_id uuid)
returns table(status text) language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (auth.uid() = p_user_id or public.is_org_admin(p_org_id)) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
    select case when p.last_seen_at is null then 'unknown'
      when p.last_seen_at > clock_timestamp() - interval '75 seconds' then 'online'
      else 'offline' end
    from public.organization_members m
    left join private.org_member_presence p on p.organization_id=m.organization_id and p.user_id=m.user_id
    where m.organization_id=p_org_id and m.user_id=p_user_id and m.role_level > 0;
end;
$$;
revoke all on function public.touch_my_org_presence(uuid),public.get_org_member_presence(uuid,uuid) from public,anon;
grant execute on function public.touch_my_org_presence(uuid),public.get_org_member_presence(uuid,uuid) to authenticated;
commit;
