-- Make the intentional service-only posture explicit so the security advisor
-- does not confuse "no client policy" with an accidentally unfinished table.
drop policy if exists "workspace_scope_quarantine deny client access"
  on private.workspace_scope_quarantine;
create policy "workspace_scope_quarantine deny client access"
  on private.workspace_scope_quarantine
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "system_events deny client access"
  on public.system_events;
create policy "system_events deny client access"
  on public.system_events
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "user_profiles deny direct client access"
  on public.user_profiles;
create policy "user_profiles deny direct client access"
  on public.user_profiles
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- These functions exist only to support RLS/storage policies. Keeping them in
-- an exposed API schema also exposes them as RPC endpoints, which is not needed.
create schema if not exists private;

alter function public.owns_student(text) set schema private;
alter function public.owns_workout(text) set schema private;
alter function public.owns_execution_log(text) set schema private;
alter function public.can_manage_student_photo_object(text) set schema private;
alter function public.can_manage_regulation_doc_object(text) set schema private;
alter function public.can_read_regulation_doc_object(text) set schema private;

-- Pure calculation: elevated privileges and disabled RLS are unnecessary.
alter function public.default_member_permission(integer, text) security invoker;
alter function public.default_member_permission(integer, text) reset row_security;

-- Internal mutating helper used by the tournament trigger. It must never be a
-- callable authenticated RPC because it can activate/archive rule sets.
revoke all on function public.resolve_active_rule_set_for_new_cycle(uuid, text)
  from public, anon, authenticated;
grant execute on function public.resolve_active_rule_set_for_new_cycle(uuid, text)
  to service_role;

-- This is a client-facing RPC, so it remains SECURITY DEFINER but now enforces
-- organization membership before returning any integration rule.
create or replace function public.get_training_integration_rules(
  _organization_id uuid
)
returns table (
  id text,
  organization_id uuid,
  source_session_id text,
  start_at timestamptz,
  end_at timestamptz,
  class_count integer,
  class_ids text[],
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    r.id,
    r.organization_id,
    r.source_session_id,
    r.start_at,
    r.end_at,
    r.class_count,
    coalesce(
      array_agg(rc.class_id order by rc.created_at)
        filter (where rc.class_id is not null),
      array[]::text[]
    ) as class_ids,
    r.created_at,
    r.updated_at
  from public.training_session_integration_rules r
  left join public.training_session_integration_rule_classes rc
    on rc.rule_id = r.id
  where r.organization_id = _organization_id
    and public.is_org_member(_organization_id)
  group by
    r.id,
    r.organization_id,
    r.source_session_id,
    r.start_at,
    r.end_at,
    r.class_count,
    r.created_at,
    r.updated_at
  order by r.start_at desc;
$$;

revoke all on function public.get_training_integration_rules(uuid)
  from public, anon;
grant execute on function public.get_training_integration_rules(uuid)
  to authenticated, service_role;
