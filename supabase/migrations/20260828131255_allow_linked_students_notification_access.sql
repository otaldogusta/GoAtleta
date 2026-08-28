-- Let a linked athlete use the notification inbox and register their own
-- device without turning the athlete into an organization staff member.

create index if not exists students_org_student_user_idx
  on public.students (organization_id, student_user_id)
  where student_user_id is not null;

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
    )
  from caller;
$$;

revoke all on function public.is_org_member_or_linked_student(uuid)
  from public, anon, authenticated;
grant execute on function public.is_org_member_or_linked_student(uuid)
  to authenticated;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (
    notifications.recipient_user_id = (select auth.uid())
    and public.is_org_member_or_linked_student(notifications.organization_id)
  );

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own"
  on public.notifications
  for insert
  to authenticated
  with check (
    notifications.recipient_user_id = (select auth.uid())
    and public.is_org_member_or_linked_student(notifications.organization_id)
  );

drop policy if exists "notifications_update_read_own" on public.notifications;
create policy "notifications_update_read_own"
  on public.notifications
  for update
  to authenticated
  using (
    notifications.recipient_user_id = (select auth.uid())
    and public.is_org_member_or_linked_student(notifications.organization_id)
  )
  with check (
    notifications.recipient_user_id = (select auth.uid())
    and public.is_org_member_or_linked_student(notifications.organization_id)
  );

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications
  for delete
  to authenticated
  using (
    notifications.recipient_user_id = (select auth.uid())
    and public.is_org_member_or_linked_student(notifications.organization_id)
  );

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_select_own" on public.push_tokens;
create policy "push_tokens_select_own"
  on public.push_tokens
  for select
  to authenticated
  using (
    push_tokens.user_id = (select auth.uid())
    and public.is_org_member_or_linked_student(push_tokens.organization_id)
  );

drop policy if exists "push_tokens_insert_own" on public.push_tokens;
create policy "push_tokens_insert_own"
  on public.push_tokens
  for insert
  to authenticated
  with check (
    push_tokens.user_id = (select auth.uid())
    and public.is_org_member_or_linked_student(push_tokens.organization_id)
  );

drop policy if exists "push_tokens_update_own" on public.push_tokens;
create policy "push_tokens_update_own"
  on public.push_tokens
  for update
  to authenticated
  using (
    push_tokens.user_id = (select auth.uid())
    and public.is_org_member_or_linked_student(push_tokens.organization_id)
  )
  with check (
    push_tokens.user_id = (select auth.uid())
    and public.is_org_member_or_linked_student(push_tokens.organization_id)
  );

drop policy if exists "push_tokens_delete_own" on public.push_tokens;
create policy "push_tokens_delete_own"
  on public.push_tokens
  for delete
  to authenticated
  using (
    push_tokens.user_id = (select auth.uid())
    and public.is_org_member_or_linked_student(push_tokens.organization_id)
  );
