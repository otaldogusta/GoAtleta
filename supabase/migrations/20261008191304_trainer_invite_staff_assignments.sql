-- Selection is made by the institution; identity is attached only on verified claim.
alter table public.trainer_invites
  add column initial_class_ids text[] not null default '{}',
  add column staff_profile_id uuid references public.organization_staff_profiles(id);

create function public.create_trainer_invite_access_v2(
  p_org_id uuid, p_code_hash text, p_target_role_level int, p_invited_via text,
  p_invited_to text default null, p_initial_permissions jsonb default '[]',
  p_class_ids text[] default '{}', p_staff_profile_id uuid default null
) returns table(invite_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = '' set row_security = off as $$
declare created record;
begin
  if auth.uid() is null or not public.is_org_admin(p_org_id) then raise exception 'NOT_AUTHORIZED'; end if;
  if cardinality(p_class_ids) > 200 or exists (
    select 1 from unnest(p_class_ids) selected(id)
    where not exists (select 1 from public.classes c where c.id = selected.id and c.organization_id = p_org_id)
  ) then raise exception 'INVITE_CLASSES_INVALID'; end if;
  if p_staff_profile_id is not null then
    perform 1 from public.organization_staff_profiles
    where id = p_staff_profile_id and organization_id = p_org_id and linked_user_id is null for update;
    if not found then raise exception 'INVITE_PROFILE_INVALID'; end if;
  end if;
  select * into created from public.create_trainer_invite_access(
    p_org_id, p_code_hash, p_target_role_level, p_invited_via, p_invited_to, p_initial_permissions);
  update public.trainer_invites set initial_class_ids = coalesce(p_class_ids, '{}'),
    staff_profile_id = p_staff_profile_id where id = created.invite_id;
  return query select created.invite_id::uuid, created.expires_at::timestamptz;
end;
$$;
revoke all on function public.create_trainer_invite_access_v2(uuid,text,int,text,text,jsonb,text[],uuid) from public, anon;
grant execute on function public.create_trainer_invite_access_v2(uuid,text,int,text,text,jsonb,text[],uuid) to authenticated;

create function public.apply_trainer_invite_staff(p_invite_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' set row_security = off as $$
declare invitation public.trainer_invites%rowtype; profile public.organization_staff_profiles%rowtype;
  class_id_value text; class_ids text[]; staff_role_value text; display_name_value text;
begin
  select * into strict invitation from public.trainer_invites where id = p_invite_id for update;
  if invitation.staff_profile_id is not null then
    select * into profile from public.organization_staff_profiles
    where id = invitation.staff_profile_id and organization_id = invitation.organization_id for update;
    if not found or (profile.linked_user_id is not null and profile.linked_user_id <> p_user_id) then
      raise exception 'INVITE_PROFILE_INVALID';
    end if;
  end if;
  select array_agg(distinct id order by id) into class_ids from (
    select unnest(invitation.initial_class_ids) id
    union select s.class_id from public.class_staff s where s.organization_id = invitation.organization_id and s.staff_profile_id = invitation.staff_profile_id
    union select t.class_id from public.class_staff_tenures t where t.organization_id = invitation.organization_id and t.staff_profile_id = invitation.staff_profile_id
    union select s.class_id from public.class_staff_substitutions s where s.organization_id = invitation.organization_id and s.replacement_staff_profile_id = invitation.staff_profile_id
  ) selected;
  -- Same lock as the versioned class editor, in deterministic order.
  foreach class_id_value in array coalesce(class_ids, '{}') loop
    perform 1 from public.classes where id = class_id_value and organization_id = invitation.organization_id;
    if not found then raise exception 'INVITE_CLASSES_INVALID'; end if;
    insert into public.class_staff_versions(organization_id,class_id,version)
      values(invitation.organization_id,class_id_value,0) on conflict do nothing;
    perform 1 from public.class_staff_versions where organization_id = invitation.organization_id and class_id = class_id_value for update;
  end loop;
  if invitation.staff_profile_id is not null then
    -- Conflicting identities need an explicit coordinator correction; never delete history.
    if exists (select 1 from public.class_staff a join public.class_staff b on a.class_id = b.class_id
      where a.staff_profile_id = invitation.staff_profile_id and b.user_id = p_user_id) then
      raise exception 'INVITE_STAFF_CONFLICT';
    end if;
    update public.organization_staff_profiles set linked_user_id = p_user_id, updated_at = now()
      where id = invitation.staff_profile_id and organization_id = invitation.organization_id;
    update public.classes c set owner_id = p_user_id
      where c.organization_id = invitation.organization_id and exists (
        select 1 from public.class_staff s where s.class_id = c.id
          and s.organization_id = invitation.organization_id
          and s.staff_profile_id = invitation.staff_profile_id and s.staff_role = 'head'
      );
    update public.class_staff set user_id = p_user_id, staff_profile_id = null
      where staff_profile_id = invitation.staff_profile_id and organization_id = invitation.organization_id;
    update public.class_staff_tenures set user_id = p_user_id, updated_at = now()
      where staff_profile_id = invitation.staff_profile_id and organization_id = invitation.organization_id;
    update public.class_staff_substitutions set replacement_user_id = p_user_id, updated_at = now()
      where replacement_staff_profile_id = invitation.staff_profile_id and organization_id = invitation.organization_id;
    update public.class_staff_substitutions s set absent_user_id = p_user_id, updated_at = now()
      from public.class_staff_tenures t where s.absent_tenure_id = t.id
      and t.staff_profile_id = invitation.staff_profile_id and s.organization_id = invitation.organization_id;
  end if;
  staff_role_value := case when invitation.target_role_level < 10 then 'intern' else 'assistant' end;
  select coalesce(profile.display_name, nullif(raw_user_meta_data->>'full_name',''), email::text, 'Professor')
    into display_name_value from auth.users where id = p_user_id;
  foreach class_id_value in array invitation.initial_class_ids loop
    if not exists (select 1 from public.class_staff where class_id = class_id_value and user_id = p_user_id) then
      -- Do not silently reactivate a scheduled/away temporal assignment.
      if exists (select 1 from public.class_staff_tenures where class_id = class_id_value and user_id = p_user_id
        and ends_on is null and status in ('scheduled','active','away')) then raise exception 'INVITE_STAFF_CONFLICT'; end if;
      insert into public.class_staff(organization_id,class_id,user_id,staff_role)
        values(invitation.organization_id,class_id_value,p_user_id,staff_role_value);
      insert into public.class_staff_tenures(organization_id,class_id,user_id,display_name_snapshot,staff_role,starts_on,created_by)
        values(invitation.organization_id,class_id_value,p_user_id,display_name_value,staff_role_value,current_date,invitation.created_by);
    end if;
  end loop;
  update public.class_staff_versions set version = version + 1, updated_at = now()
    where organization_id = invitation.organization_id and class_id = any(coalesce(class_ids, '{}'));
end;
$$;
revoke all on function public.apply_trainer_invite_staff(uuid,uuid) from public, anon, authenticated;

create or replace function public.claim_trainer_invite_access(
  p_invite_id uuid,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_invite public.trainer_invites%rowtype;
  v_role_level int;
  v_permission_key text;
  v_authenticated_email text;
  v_permission_keys constant text[] := array[
    'reports',
    'events',
    'students',
    'classes',
    'training',
    'periodization',
    'calendar',
    'absence_notices',
    'whatsapp_settings',
    'assistant',
    'org_members',
    'financial'
  ];
begin
  select invite.*
    into v_invite
  from public.trainer_invites invite
  where invite.id = p_invite_id
  for update;

  if not found or v_invite.organization_id is null then
    raise exception 'INVITE_INVALID';
  end if;
  if v_invite.claimed_by = p_user_id then
    if v_invite.revoked then
      raise exception 'INVITE_REVOKED';
    end if;
    if not exists (
      select 1
      from public.organization_members member
      where member.organization_id = v_invite.organization_id
        and member.user_id = p_user_id
    ) then
      raise exception 'INVITE_ALREADY_USED';
    end if;
    return 'already_claimed';
  end if;
  if v_invite.claimed_by is not null or v_invite.uses >= v_invite.max_uses then
    raise exception 'INVITE_ALREADY_USED';
  end if;
  if v_invite.revoked then
    raise exception 'INVITE_REVOKED';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'INVITE_EXPIRED';
  end if;
  if v_invite.invited_via = 'email'
    and nullif(lower(trim(coalesce(v_invite.invited_to, ''))), '') is not null then
    select nullif(lower(trim(account.email::text)), '')
      into v_authenticated_email
    from auth.users account
    where account.id = p_user_id;

    if v_authenticated_email is null
      or lower(trim(v_invite.invited_to)) is distinct from v_authenticated_email then
      raise exception 'INVITE_EMAIL_MISMATCH';
    end if;
  end if;

  v_role_level := case
    when coalesce(v_invite.target_role_level, 10) >= 50 then 50
    when coalesce(v_invite.target_role_level, 10) >= 10 then 10
    else 5
  end;

  insert into public.trainers (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  insert into public.organization_members (organization_id, user_id, role_level)
  values (v_invite.organization_id, p_user_id, v_role_level)
  on conflict (organization_id, user_id)
  do update set role_level = greatest(
    public.organization_members.role_level,
    excluded.role_level
  );

  if v_role_level < 50 and v_invite.initial_permissions is not null then
    foreach v_permission_key in array v_permission_keys loop
      insert into public.organization_member_permissions (
        organization_id,
        user_id,
        permission_key,
        is_allowed,
        updated_at,
        updated_by
      )
      values (
        v_invite.organization_id,
        p_user_id,
        v_permission_key,
        v_invite.initial_permissions ? v_permission_key,
        now(),
        v_invite.created_by
      )
      on conflict (organization_id, user_id, permission_key)
      do update set
        is_allowed = excluded.is_allowed,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
    end loop;
  end if;

  perform public.apply_trainer_invite_staff(p_invite_id, p_user_id);

  update public.trainer_invites invite
  set
    uses = invite.uses + 1,
    claimed_by = p_user_id,
    claimed_at = now()
  where invite.id = p_invite_id;

  return 'claimed';
end;
$$;

revoke all on function public.claim_trainer_invite_access(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_trainer_invite_access(uuid, uuid)
  to service_role;
