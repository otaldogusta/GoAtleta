-- Qualify every outer row reference so the nested checks cannot accidentally
-- compare class_staff/classes columns to themselves.
drop policy if exists class_session_coverages_insert
  on public.class_session_coverages;

create policy class_session_coverages_insert
  on public.class_session_coverages
  for insert
  to authenticated
  with check (
    public.is_org_member(class_session_coverages.organization_id)
    and exists (
      select 1
      from public.classes class_row
      where class_row.id = class_session_coverages.class_id
        and class_row.organization_id = class_session_coverages.organization_id
    )
    and (
      public.is_org_admin(class_session_coverages.organization_id)
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

drop policy if exists class_session_coverages_delete
  on public.class_session_coverages;

create policy class_session_coverages_delete
  on public.class_session_coverages
  for delete
  to authenticated
  using (
    public.is_org_member(class_session_coverages.organization_id)
    and (
      public.is_org_admin(class_session_coverages.organization_id)
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
