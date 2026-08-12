create index if not exists document_merge_proposals_reviewed_by_idx
  on public.document_merge_proposals (reviewed_by)
  where reviewed_by is not null;
