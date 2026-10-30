-- Event attachments are private institutional files. No historical events change.
-- This migration prepares schema/RLS only; application to a remote project is separate.
create unique index if not exists events_organization_id_id_attachment_fk
  on public.events (organization_id, id);

create table public.event_attachments (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null,
  object_path text not null unique,
  file_name text not null check (
    length(file_name) between 1 and 255 and file_name = btrim(file_name)
    and file_name !~ '[[:cntrl:]/\\]'
  ),
  mime_type text not null check (mime_type in (
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/avif', 'image/heic', 'image/heif',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation', 'text/plain', 'text/csv'
  )),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  deleted_at timestamptz,
  foreign key (organization_id, event_id)
    references public.events(organization_id, id) on delete cascade,
  check (object_path = organization_id::text || '/' || event_id::text || '/' || id::text)
);
create index event_attachments_event_active_idx
  on public.event_attachments (organization_id, event_id, created_at, id)
  where deleted_at is null;
alter table public.event_attachments enable row level security;
revoke all on public.event_attachments from public, anon, authenticated;
grant select on public.event_attachments to authenticated;
grant all on public.event_attachments to service_role;

-- The events subquery deliberately uses the caller's existing events RLS.
-- Ordinary readers see completed files only; admins can inspect upload/cleanup intents.
create policy event_attachments_read_event on public.event_attachments
for select to authenticated using (
  exists (select 1 from public.events e
    where e.id = event_attachments.event_id and e.organization_id = event_attachments.organization_id)
  and ((uploaded_at is not null and deleted_at is null) or public.is_org_admin(organization_id))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-attachments', 'event-attachments', false, 20971520, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/avif', 'image/heic', 'image/heif',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation', 'text/plain', 'text/csv'
]);

create policy event_attachments_object_read on storage.objects
for select to authenticated using (
  bucket_id = 'event-attachments'
  and exists (select 1 from public.event_attachments a where a.object_path = name)
);
create policy event_attachments_object_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'event-attachments'
  and exists (select 1 from public.event_attachments a
    where a.object_path = name and a.uploaded_at is null and a.deleted_at is null
      and a.created_by = auth.uid() and public.is_org_admin(a.organization_id))
);
create policy event_attachments_object_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'event-attachments'
  and exists (select 1 from public.event_attachments a
    where a.object_path = name and public.is_org_admin(a.organization_id))
);
-- No UPDATE policy: a completed or in-flight object can never be overwritten.

create or replace function public.get_event_attachment_capabilities()
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('version', 1, 'bucket', 'event-attachments', 'maxFiles', 10, 'maxFileBytes', 20971520);
$$;

create or replace function public.prepare_event_attachment(
  p_organization_id uuid, p_event_id uuid, p_id uuid,
  p_file_name text, p_mime_type text, p_size_bytes bigint
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event uuid;
  v_attachment public.event_attachments;
  v_extension text;
begin
  if auth.uid() is null or not public.is_org_admin(p_organization_id) then
    raise exception 'Event attachment access denied' using errcode = '42501';
  end if;
  -- All prepare/remove operations serialize on the same parent, enforcing ten slots.
  select e.id into v_event from public.events e
    where e.id = p_event_id and e.organization_id = p_organization_id for update;
  if v_event is null then raise exception 'Event attachment access denied' using errcode = '42501'; end if;
  if p_id is null or p_file_name is null or length(p_file_name) not between 1 and 255
    or p_file_name <> btrim(p_file_name) or p_file_name ~ '[[:cntrl:]/\\]'
    or p_size_bytes is null or p_size_bytes not between 1 and 20971520 then
    raise exception 'Invalid event attachment';
  end if;
  v_extension := lower(substring(p_file_name from '\.([^.]+)$'));
  if not coalesce(case p_mime_type
    when 'image/jpeg' then v_extension in ('jpg', 'jpeg')
    when 'image/png' then v_extension = 'png'
    when 'image/webp' then v_extension = 'webp'
    when 'image/gif' then v_extension = 'gif'
    when 'image/bmp' then v_extension = 'bmp'
    when 'image/avif' then v_extension = 'avif'
    when 'image/heic' then v_extension = 'heic'
    when 'image/heif' then v_extension = 'heif'
    when 'application/pdf' then v_extension = 'pdf'
    when 'application/msword' then v_extension = 'doc'
    when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then v_extension = 'docx'
    when 'application/vnd.ms-excel' then v_extension = 'xls'
    when 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' then v_extension = 'xlsx'
    when 'application/vnd.ms-powerpoint' then v_extension = 'ppt'
    when 'application/vnd.openxmlformats-officedocument.presentationml.presentation' then v_extension = 'pptx'
    when 'application/vnd.oasis.opendocument.text' then v_extension = 'odt'
    when 'application/vnd.oasis.opendocument.spreadsheet' then v_extension = 'ods'
    when 'application/vnd.oasis.opendocument.presentation' then v_extension = 'odp'
    when 'text/plain' then v_extension = 'txt'
    when 'text/csv' then v_extension = 'csv'
    else false end, false) then raise exception 'Invalid event attachment type'; end if;

  select * into v_attachment from public.event_attachments where id = p_id for update;
  if v_attachment.id is not null then
    if v_attachment.organization_id <> p_organization_id or v_attachment.event_id <> p_event_id
      or v_attachment.file_name <> p_file_name or v_attachment.mime_type <> p_mime_type
      or v_attachment.size_bytes <> p_size_bytes or v_attachment.deleted_at is not null
      or (v_attachment.uploaded_at is null and v_attachment.created_by <> auth.uid()) then
      raise exception 'Event attachment conflict';
    end if;
    return to_jsonb(v_attachment);
  end if;
  if (select count(*) from public.event_attachments
      where organization_id = p_organization_id and event_id = p_event_id and deleted_at is null) >= 10 then
    raise exception 'Event attachment limit reached';
  end if;
  insert into public.event_attachments (id, organization_id, event_id, object_path, file_name, mime_type, size_bytes, created_by)
  values (p_id, p_organization_id, p_event_id,
    p_organization_id::text || '/' || p_event_id::text || '/' || p_id::text,
    p_file_name, p_mime_type, p_size_bytes, auth.uid()) returning * into v_attachment;
  return to_jsonb(v_attachment);
end;
$$;

create or replace function public.finalize_event_attachment(p_organization_id uuid, p_event_id uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_attachment public.event_attachments; v_metadata jsonb;
begin
  if auth.uid() is null or not public.is_org_admin(p_organization_id) then
    raise exception 'Event attachment access denied' using errcode = '42501';
  end if;
  select e.id into v_event from public.events e
    where e.id = p_event_id and e.organization_id = p_organization_id for update;
  if v_event is null then raise exception 'Event attachment access denied' using errcode = '42501'; end if;
  select * into v_attachment from public.event_attachments
    where id = p_id and organization_id = p_organization_id and event_id = p_event_id and deleted_at is null for update;
  if v_attachment.id is null then raise exception 'Event attachment unavailable'; end if;
  select o.metadata into v_metadata from storage.objects o
    where o.bucket_id = 'event-attachments' and o.name = v_attachment.object_path;
  if v_metadata is null or coalesce(v_metadata->>'size', '') !~ '^[0-9]{1,8}$' then
    raise exception 'Event attachment upload incomplete';
  end if;
  if (v_metadata->>'size')::bigint <> v_attachment.size_bytes
    or v_metadata->>'mimetype' is distinct from v_attachment.mime_type then
    raise exception 'Event attachment upload incomplete';
  end if;
  update public.event_attachments set uploaded_at = coalesce(uploaded_at, now())
    where id = p_id returning * into v_attachment;
  return to_jsonb(v_attachment);
end;
$$;

create or replace function public.remove_event_attachment(p_organization_id uuid, p_event_id uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_event uuid; v_attachment public.event_attachments;
begin
  if auth.uid() is null or not public.is_org_admin(p_organization_id) then
    raise exception 'Event attachment access denied' using errcode = '42501';
  end if;
  select e.id into v_event from public.events e
    where e.id = p_event_id and e.organization_id = p_organization_id for update;
  if v_event is null then raise exception 'Event attachment access denied' using errcode = '42501'; end if;
  update public.event_attachments set deleted_at = coalesce(deleted_at, now())
    where id = p_id and organization_id = p_organization_id and event_id = p_event_id returning * into v_attachment;
  if v_attachment.id is null then return null; end if;
  return to_jsonb(v_attachment);
end;
$$;

revoke all on function public.get_event_attachment_capabilities() from public, anon;
revoke all on function public.prepare_event_attachment(uuid, uuid, uuid, text, text, bigint) from public, anon;
revoke all on function public.finalize_event_attachment(uuid, uuid, uuid) from public, anon;
revoke all on function public.remove_event_attachment(uuid, uuid, uuid) from public, anon;
grant execute on function public.get_event_attachment_capabilities() to authenticated;
grant execute on function public.prepare_event_attachment(uuid, uuid, uuid, text, text, bigint) to authenticated;
grant execute on function public.finalize_event_attachment(uuid, uuid, uuid) to authenticated;
grant execute on function public.remove_event_attachment(uuid, uuid, uuid) to authenticated;

comment on table public.event_attachments is
  'Private institutional event files; prepare/upload/finalize is idempotent. Ten active intents per event, 20MiB each. Metadata/declared MIME checks are not antivirus or content certification.';
-- Removal RPC tombstones first; the client then deletes through the Storage API.
-- Never DELETE storage.objects from SQL: that would leave the real S3 object behind.
-- Event/org cascade deletes metadata and revokes future Storage access immediately.
-- Existing signed URLs remain bearer grants until their short expiry. Physical files
-- left by cascade or abandoned uploads require a separately authorized Storage API
-- reconciliation job (compare bucket paths with live attachment metadata). This
-- migration does not install a cron or authorize deletion of historical files.
