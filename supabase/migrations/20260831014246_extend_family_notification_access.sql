-- Extend the existing notification/device access helper to active family
-- relationships. Notification policies still require recipient_user_id to be
-- the caller and keep every row scoped to its organization_id.

create or replace function public.is_org_member_or_linked_student(
  p_organization_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  with caller as (
    select (select auth.uid()) as user_id
  )
  select
    caller.user_id is not null
    and (
      (select public.is_org_member(p_organization_id))
      or exists (
        select 1
        from public.students student
        where student.organization_id = p_organization_id
          and student.student_user_id = caller.user_id
      )
      or exists (
        select 1
        from public.student_relationships relationship
        where relationship.organization_id = p_organization_id
          and relationship.user_id = caller.user_id
          and relationship.status = 'active'
      )
    )
  from caller;
$$;

revoke all on function public.is_org_member_or_linked_student(uuid)
  from public, anon, authenticated;
grant execute on function public.is_org_member_or_linked_student(uuid)
  to authenticated;

comment on function public.is_org_member_or_linked_student(uuid) is
  'Organization-scoped notification/device access for staff, legacy linked athletes, and active typed student relationships.';
