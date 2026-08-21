-- Preserve institutional classes when a member deletes their account and
-- return the operational context needed to notify coordination after Auth
-- confirms the deletion.

create or replace function public.prepare_self_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_row record;
  affected_row record;
  replacement_user_id uuid;
  transferred_organizations integer := 0;
  deletion_notices jsonb := '[]'::jsonb;
begin
  if p_user_id is null or not exists (
    select 1 from auth.users account_user where account_user.id = p_user_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ACCOUNT_DELETE_USER_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.organization_members current_membership
    where current_membership.user_id = p_user_id
      and current_membership.role_level >= 50
      and exists (
        select 1
        from public.organization_members other_member
        where other_member.organization_id = current_membership.organization_id
          and other_member.user_id <> p_user_id
      )
      and not exists (
        select 1
        from public.organization_members other_admin
        where other_admin.organization_id = current_membership.organization_id
          and other_admin.user_id <> p_user_id
          and other_admin.role_level >= 50
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'ACCOUNT_DELETE_REQUIRES_ADMIN_TRANSFER';
  end if;

  -- An organization must never disappear as a side effect of deleting its
  -- last account. A replacement administrator keeps classes and history
  -- recoverable; without one, deletion is intentionally blocked.
  for organization_row in
    select organization.id
    from public.organizations organization
    where organization.created_by = p_user_id
    for update
  loop
    select member.user_id
      into replacement_user_id
    from public.organization_members member
    where member.organization_id = organization_row.id
      and member.user_id <> p_user_id
      and member.role_level >= 50
    order by member.role_level desc, member.created_at asc, member.user_id
    limit 1;

    if replacement_user_id is null then
      raise exception using
        errcode = 'P0001',
        message = 'ACCOUNT_DELETE_REQUIRES_ADMIN_TRANSFER';
    end if;

    update public.organizations
    set created_by = replacement_user_id
    where id = organization_row.id;
    transferred_organizations := transferred_organizations + 1;
  end loop;

  for affected_row in
    select
      current_membership.organization_id,
      count(distinct class_row.id)::integer as class_count,
      array_agg(distinct class_row.id)
        filter (where class_row.id is not null) as class_ids,
      array_agg(distinct class_row.name order by class_row.name)
        filter (where class_row.name is not null) as class_names,
      case
        when current_membership.role_level >= 50 then 'Coordenação'
        when current_membership.role_level >= 10 then 'Professor'
        else 'Estagiário'
      end as member_role,
      array_agg(distinct coordinator.user_id)
        filter (where coordinator.user_id is not null) as coordinator_user_ids
    from public.organization_members current_membership
    left join public.class_staff staff
      on staff.user_id = current_membership.user_id
     and staff.staff_role = 'head'
    left join public.classes class_row
      on class_row.id = staff.class_id
     and class_row.organization_id = current_membership.organization_id
    left join public.organization_members coordinator
      on coordinator.organization_id = current_membership.organization_id
     and coordinator.user_id <> p_user_id
     and coordinator.role_level >= 50
    where current_membership.user_id = p_user_id
    group by current_membership.organization_id, current_membership.role_level
  loop
    if coalesce(cardinality(affected_row.coordinator_user_ids), 0) = 0 then
      raise exception using
        errcode = 'P0001',
        message = 'ACCOUNT_DELETE_REQUIRES_ADMIN_TRANSFER';
    end if;

    deletion_notices := deletion_notices || jsonb_build_array(
      jsonb_build_object(
        'organizationId', affected_row.organization_id,
        'classCount', affected_row.class_count,
        'classIds', coalesce(to_jsonb(affected_row.class_ids), '[]'::jsonb),
        'classNames', coalesce(to_jsonb(affected_row.class_names), '[]'::jsonb),
        'memberRole', affected_row.member_role,
        'coordinatorUserIds', to_jsonb(affected_row.coordinator_user_ids)
      )
    );
  end loop;

  return jsonb_build_object(
    'transferredOrganizations', transferred_organizations,
    'removedPersonalOrganizations', 0,
    'affectedOrganizations', deletion_notices
  );
end;
$$;

revoke all on function public.prepare_self_account_deletion(uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_self_account_deletion(uuid)
  to service_role;
