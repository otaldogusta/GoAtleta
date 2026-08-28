-- Financial access follows the same explicit invitation permission model as
-- the other organization capabilities. It is never part of the invite default
-- set; only an explicit initial_permissions entry grants it to a non-admin.
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
