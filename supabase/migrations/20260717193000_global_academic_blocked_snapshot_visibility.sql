create or replace function public.list_global_academic_publication_states(
  p_public_identity_ids text[]
)
returns table (
  public_identity_id text,
  publication_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select interpretation.public_identity_id, interpretation.publication_status
  from public.global_academic_interpretations interpretation
  where (select auth.uid()) is not null
    and interpretation.public_identity_id = any(coalesce(p_public_identity_ids, '{}'::text[]))
    and interpretation.publication_status in ('published', 'published_outdated', 'withdrawn', 'blocked');
$$;

revoke all on function public.list_global_academic_publication_states(text[]) from public, anon;
grant execute on function public.list_global_academic_publication_states(text[]) to authenticated;
