-- Reviewer identities are anonymized by ON DELETE SET NULL during account
-- deletion. Preserve the resolved audit row and its timestamp after that
-- anonymization instead of making the Auth deletion fail its CHECK constraint.
alter table public.organization_access_requests
  drop constraint if exists organization_access_requests_resolution_check,
  add constraint organization_access_requests_resolution_check
    check (
      (status = 'pending' and reviewed_at is null and reviewed_by is null)
      or
      (status <> 'pending' and reviewed_at is not null)
    );

alter table public.document_merge_proposals
  drop constraint if exists document_merge_proposals_review_audit_check,
  add constraint document_merge_proposals_review_audit_check
    check (
      reviewed_by is null
      or reviewed_at is not null
    );
