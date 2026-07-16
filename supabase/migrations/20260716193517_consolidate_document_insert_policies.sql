-- Consolidate equivalent INSERT authorization branches into one permissive
-- policy per table. This preserves access semantics while avoiding evaluation
-- of multiple permissive policies for every insert.

drop policy if exists document_sources_personal_insert
  on public.document_sources;
drop policy if exists document_sources_insert
  on public.document_sources;

create policy document_sources_insert
  on public.document_sources
  for insert
  to authenticated
  with check (
    (
      source_scope = 'user_academic'
      and owner_user_id = (select auth.uid())
      and class_id is null
      and (select public.is_org_member(organization_id))
    )
    or (
      source_scope <> 'user_academic'
      and public.can_manage_document_org(organization_id)
    )
  );

drop policy if exists document_source_revisions_personal_insert
  on public.document_source_revisions;
drop policy if exists document_source_revisions_insert
  on public.document_source_revisions;

create policy document_source_revisions_insert
  on public.document_source_revisions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.document_sources source
      where source.id = document_source_revisions.source_id
        and source.organization_id = document_source_revisions.organization_id
        and (
          (
            source.source_scope = 'user_academic'
            and source.owner_user_id = (select auth.uid())
            and (select public.is_org_member(source.organization_id))
          )
          or (
            source.source_scope <> 'user_academic'
            and public.can_manage_document_org(source.organization_id)
          )
        )
    )
  );
