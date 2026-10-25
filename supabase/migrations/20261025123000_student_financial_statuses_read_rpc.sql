-- Add a read-only scalar projection; preserve table grants and every RLS rule.
-- A scalar JSON array remains complete under PostgREST's table-row cap.
-- Larger directories are split into bounded calls by the client, not truncated.
create function public.get_student_financial_statuses_v1(
  p_org_id uuid,
  p_student_ids text[]
) returns jsonb
language plpgsql stable security invoker
set search_path = ''
as $$
begin
  if p_org_id is null or p_student_ids is null
    or pg_catalog.cardinality(p_student_ids) > 5000
    or coalesce(pg_catalog.array_ndims(p_student_ids), 1) > 1
    or exists (
      select 1 from pg_catalog.unnest(p_student_ids) requested(id)
      where requested.id is null or pg_catalog.btrim(requested.id) = ''
    ) then
    raise exception 'An organization and at most 5000 student IDs are required' using errcode = '22023';
  end if;
  return (
    select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object('student_id', financial.student_id, 'status', financial.status)
      order by financial.student_id
    ), '[]'::jsonb)
    from public.student_financial_statuses financial
    where financial.organization_id = p_org_id
      and financial.student_id = any(p_student_ids)
  );
end;
$$;
revoke all on function public.get_student_financial_statuses_v1(uuid, text[]) from public, anon;
grant execute on function public.get_student_financial_statuses_v1(uuid, text[]) to authenticated;
