do $$
declare
  t text;
begin
  foreach t in array array[
    'google_drive_connections',
    'document_sources',
    'document_source_revisions',
    'document_interpretations',
    'document_context_bindings',
    'document_app_state_snapshots',
    'document_merge_proposals',
    'document_merge_items',
    'document_change_applications',
    'document_change_application_items'
  ] loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

grant select (id, organization_id, user_id, scopes, google_account_email, expires_at, created_at, updated_at)
  on table public.google_drive_connections to authenticated;

grant select, insert on table
  public.document_sources,
  public.document_source_revisions,
  public.document_interpretations,
  public.document_context_bindings,
  public.document_app_state_snapshots,
  public.document_merge_proposals,
  public.document_merge_items,
  public.document_change_applications,
  public.document_change_application_items
to authenticated;

grant update on table
  public.document_merge_proposals,
  public.document_change_applications
to authenticated;

revoke all on function public.can_manage_document_org(uuid) from public, anon;
revoke all on function public.document_planning_state_version(uuid, text) from public, anon;
revoke all on function public.validate_document_context_scope() from public, anon, authenticated;
revoke all on function public.validate_document_snapshot_scope() from public, anon, authenticated;

grant execute on function public.can_manage_document_org(uuid) to authenticated;
grant execute on function public.document_planning_state_version(uuid, text) to authenticated;;
