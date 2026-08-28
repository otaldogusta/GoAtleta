-- Re-check authorization against the proposed organization/class identity on
-- UPDATE. The original policy validated staff scope only against the old row.
drop policy if exists class_session_coverages_update
  on public.class_session_coverages;

create policy class_session_coverages_update
  on public.class_session_coverages
  for update
  to authenticated
  using (
    public.is_org_admin(organization_id)
    or exists (
      select 1
      from public.class_staff staff
      where staff.organization_id = class_session_coverages.organization_id
        and staff.class_id = class_session_coverages.class_id
        and staff.user_id = (select auth.uid())
        and staff.staff_role in ('head', 'assistant')
    )
  )
  with check (
    public.is_org_member(organization_id)
    and exists (
      select 1
      from public.classes class_row
      where class_row.id = class_session_coverages.class_id
        and class_row.organization_id = class_session_coverages.organization_id
    )
    and (
      public.is_org_admin(organization_id)
      or exists (
        select 1
        from public.class_staff staff
        where staff.organization_id = class_session_coverages.organization_id
          and staff.class_id = class_session_coverages.class_id
          and staff.user_id = (select auth.uid())
          and staff.staff_role in ('head', 'assistant')
      )
    )
  );
