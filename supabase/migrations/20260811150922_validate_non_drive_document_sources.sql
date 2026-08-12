create or replace function private.validate_document_source_organization_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  referenced_organization_id uuid;
  referenced_user_id uuid;
  referenced_connection_scope text;
  referenced_source_profile text;
  referenced_bound_class_id text;
  referenced_class_confirmed_at timestamptz;
begin
  if new.provider = 'google_drive' then
    select
      organization_id,
      user_id,
      connection_scope,
      source_profile,
      bound_class_id,
      class_binding_confirmed_at
      into
        referenced_organization_id,
        referenced_user_id,
        referenced_connection_scope,
        referenced_source_profile,
        referenced_bound_class_id,
        referenced_class_confirmed_at
    from public.google_drive_connections
    where id = new.connection_id;

    if referenced_organization_id is distinct from new.organization_id then
      raise exception 'document source connection does not belong to organization';
    end if;
    if referenced_source_profile is distinct from new.source_profile then
      raise exception 'document source profile does not match its Drive connection';
    end if;
    if new.class_id is not null
       and (
         referenced_bound_class_id is distinct from new.class_id
         or referenced_class_confirmed_at is null
       ) then
      raise exception 'document source class binding was not explicitly confirmed';
    end if;
  end if;

  if new.source_scope = 'user_academic' then
    if new.class_id is not null then
      raise exception 'user academic source cannot bind directly to a class';
    end if;
    if new.owner_user_id is null then
      raise exception 'user academic source requires an owner';
    end if;
    if new.provider = 'google_drive' then
      if new.owner_user_id is distinct from referenced_user_id then
        raise exception 'user academic source owner must match the Drive connection owner';
      end if;
      if referenced_connection_scope is distinct from 'user_academic' then
        raise exception 'user academic source requires a personal academic Drive connection';
      end if;
    elsif new.owner_user_id is distinct from new.created_by then
      raise exception 'non-Drive personal source owner must match its creator';
    end if;
  end if;

  if new.source_scope = 'workspace_academic' then
    if new.class_id is not null then
      raise exception 'workspace academic source cannot bind directly to a class';
    end if;
    if new.provider = 'google_drive'
       and referenced_connection_scope is distinct from 'workspace_academic' then
      raise exception 'workspace academic source requires a workspace academic Drive connection';
    end if;
  end if;

  if new.class_id is not null and not exists (
    select 1
    from public.classes class_row
    where class_row.id = new.class_id
      and class_row.organization_id = new.organization_id
  ) then
    raise exception 'document source class does not belong to organization';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_document_source_organization_references()
  from public, anon, authenticated, service_role;

drop trigger if exists document_sources_validate_organization_references
  on public.document_sources;

create trigger document_sources_validate_organization_references
before insert or update on public.document_sources
for each row execute function private.validate_document_source_organization_references();
