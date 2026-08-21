-- Self-service account deletion keeps shared institutional records while
-- removing the user identity and personal rows. References that previously
-- blocked auth deletion become nullable audit references.

do $migration$
declare
  constraint_row record;
  column_row record;
  source_columns text;
  target_columns text;
begin
  for constraint_row in
    select
      constraint_definition.oid,
      source_namespace.nspname as source_schema,
      source_table.relname as source_table,
      constraint_definition.conname,
      constraint_definition.conkey,
      constraint_definition.confkey,
      constraint_definition.confrelid
    from pg_constraint constraint_definition
    join pg_class source_table
      on source_table.oid = constraint_definition.conrelid
    join pg_namespace source_namespace
      on source_namespace.oid = source_table.relnamespace
    where constraint_definition.contype = 'f'
      and constraint_definition.confrelid = 'auth.users'::regclass
      and constraint_definition.confdeltype in ('a', 'r')
      and source_namespace.nspname in ('public', 'private')
  loop
    for column_row in
      select source_attribute.attname
      from unnest(constraint_row.conkey) with ordinality as source_key(attnum, ordinality)
      join pg_attribute source_attribute
        on source_attribute.attrelid = (
          select conrelid from pg_constraint where oid = constraint_row.oid
        )
       and source_attribute.attnum = source_key.attnum
      order by source_key.ordinality
    loop
      execute format(
        'alter table %I.%I alter column %I drop not null',
        constraint_row.source_schema,
        constraint_row.source_table,
        column_row.attname
      );
    end loop;

    select string_agg(format('%I', source_attribute.attname), ', ' order by source_key.ordinality)
      into source_columns
    from unnest(constraint_row.conkey) with ordinality as source_key(attnum, ordinality)
    join pg_attribute source_attribute
      on source_attribute.attrelid = (
        select conrelid from pg_constraint where oid = constraint_row.oid
      )
     and source_attribute.attnum = source_key.attnum;

    select string_agg(format('%I', target_attribute.attname), ', ' order by target_key.ordinality)
      into target_columns
    from unnest(constraint_row.confkey) with ordinality as target_key(attnum, ordinality)
    join pg_attribute target_attribute
      on target_attribute.attrelid = constraint_row.confrelid
     and target_attribute.attnum = target_key.attnum;

    execute format(
      'alter table %I.%I drop constraint %I',
      constraint_row.source_schema,
      constraint_row.source_table,
      constraint_row.conname
    );
    execute format(
      'alter table %I.%I add constraint %I foreign key (%s) references auth.users (%s) on delete set null',
      constraint_row.source_schema,
      constraint_row.source_table,
      constraint_row.conname,
      source_columns,
      target_columns
    );
  end loop;
end
$migration$;

create or replace function public.prepare_self_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_row record;
  replacement_user_id uuid;
  transferred_organizations integer := 0;
  removed_personal_organizations integer := 0;
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

    if replacement_user_id is not null then
      update public.organizations
      set created_by = replacement_user_id
      where id = organization_row.id;
      transferred_organizations := transferred_organizations + 1;
    elsif exists (
      select 1
      from public.organization_members member
      where member.organization_id = organization_row.id
        and member.user_id <> p_user_id
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'ACCOUNT_DELETE_REQUIRES_ADMIN_TRANSFER';
    else
      delete from public.organizations
      where id = organization_row.id;
      removed_personal_organizations := removed_personal_organizations + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'transferredOrganizations', transferred_organizations,
    'removedPersonalOrganizations', removed_personal_organizations
  );
end;
$$;

create or replace function public.list_owned_storage_objects_for_account_deletion(
  p_user_id uuid
)
returns table (
  bucket_id text,
  object_name text,
  object_metadata jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    storage_object.bucket_id,
    storage_object.name,
    coalesce(storage_object.metadata, '{}'::jsonb)
  from storage.objects storage_object
  where storage_object.owner_id = p_user_id::text
  order by storage_object.bucket_id, storage_object.name;
$$;

revoke all on function public.prepare_self_account_deletion(uuid)
  from public, anon, authenticated;
revoke all on function public.list_owned_storage_objects_for_account_deletion(uuid)
  from public, anon, authenticated;

grant execute on function public.prepare_self_account_deletion(uuid) to service_role;
grant execute on function public.list_owned_storage_objects_for_account_deletion(uuid)
  to service_role;
