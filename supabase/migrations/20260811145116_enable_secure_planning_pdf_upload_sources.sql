-- Allow traceable, class-scoped PDF uploads without manufacturing a Drive
-- connection. The uploaded bytes are processed in the Edge Function and are
-- never persisted; only their hash, provenance, interpretation and proposal
-- are stored.

alter table public.document_sources
  alter column connection_id drop not null;

alter table public.document_sources
  drop constraint if exists document_sources_provider_check,
  add constraint document_sources_provider_check
    check (provider in ('google_drive', 'upload', 'url', 'pasted_text'));

alter table public.document_sources
  drop constraint if exists document_sources_connection_provider_external_key,
  add constraint document_sources_connection_provider_external_key
    unique (organization_id, connection_id, provider, external_id);

create unique index if not exists document_sources_upload_identity_key
  on public.document_sources (organization_id, provider, external_id)
  where provider = 'upload' and connection_id is null;

alter table public.document_sources
  drop constraint if exists document_sources_connection_required_for_drive_check,
  add constraint document_sources_connection_required_for_drive_check
    check (
      (provider = 'google_drive' and connection_id is not null)
      or (provider <> 'google_drive' and connection_id is null)
    );

alter table public.document_merge_proposals
  add column if not exists approved_item_ids uuid[] not null default '{}'::uuid[],
  add column if not exists reviewed_by uuid references auth.users(id) on delete restrict,
  add column if not exists reviewed_at timestamptz;

alter table public.document_merge_proposals
  drop constraint if exists document_merge_proposals_review_audit_check,
  add constraint document_merge_proposals_review_audit_check
    check (
      (reviewed_at is null and reviewed_by is null)
      or (reviewed_at is not null and reviewed_by is not null)
    );
