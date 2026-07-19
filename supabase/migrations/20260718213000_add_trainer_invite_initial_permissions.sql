alter table public.trainer_invites
  add column if not exists initial_permissions jsonb,
  add column if not exists delivery_status text not null default 'pending_delivery',
  add column if not exists delivery_attempted_at timestamptz,
  add column if not exists delivery_provider_id text,
  add column if not exists delivery_error text;

alter table public.trainer_invites
  drop constraint if exists trainer_invites_target_role_level_check;

alter table public.trainer_invites
  add constraint trainer_invites_target_role_level_check
  check (target_role_level in (5, 10, 50));

alter table public.trainer_invites
  drop constraint if exists trainer_invites_initial_permissions_array;

alter table public.trainer_invites
  add constraint trainer_invites_initial_permissions_array
  check (initial_permissions is null or jsonb_typeof(initial_permissions) = 'array');

alter table public.trainer_invites
  drop constraint if exists trainer_invites_delivery_status_check;

alter table public.trainer_invites
  add constraint trainer_invites_delivery_status_check
  check (delivery_status in ('not_applicable', 'pending_delivery', 'sent', 'delivery_failed'));

create or replace function public.claim_trainer_invite_access(
  p_invite_id uuid,
  p_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite public.trainer_invites%rowtype;
  v_role_level int;
  v_permission_key text;
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
    'org_members'
  ];
begin
  select *
    into v_invite
    from public.trainer_invites
   where id = p_invite_id
   for update;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;
  if v_invite.claimed_by = p_user_id then
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

  v_role_level := case
    when coalesce(v_invite.target_role_level, 10) >= 50 then 50
    when coalesce(v_invite.target_role_level, 10) >= 10 then 10
    else 5
  end;

  insert into public.trainers (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  if v_invite.organization_id is not null then
    insert into public.organization_members (organization_id, user_id, role_level)
    values (v_invite.organization_id, p_user_id, v_role_level)
    on conflict (organization_id, user_id)
    do update set role_level = greatest(public.organization_members.role_level, excluded.role_level);

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
  end if;

  update public.trainer_invites
     set uses = uses + 1,
         claimed_by = p_user_id,
         claimed_at = now()
   where id = p_invite_id;

  return 'claimed';
end;
$$;

revoke all on function public.claim_trainer_invite_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_trainer_invite_access(uuid, uuid) to service_role;
