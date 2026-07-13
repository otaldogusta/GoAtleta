-- Harden the public Data API without changing or deleting application rows.

-- Admin reporting views must evaluate the underlying tables with the caller's
-- RLS context instead of inheriting the view owner's privileges.
alter view public.v_admin_pending_attendance set (security_invoker = true);
alter view public.v_admin_pending_session_logs set (security_invoker = true);
alter view public.v_admin_recent_activity set (security_invoker = true);

revoke all on public.v_admin_pending_attendance from public, anon, authenticated;
revoke all on public.v_admin_pending_session_logs from public, anon, authenticated;
revoke all on public.v_admin_recent_activity from public, anon, authenticated;

grant select on public.v_admin_pending_attendance to authenticated, service_role;
grant select on public.v_admin_pending_session_logs to authenticated, service_role;
grant select on public.v_admin_recent_activity to authenticated, service_role;

-- Observability writes and aggregate metrics are internal Edge Function
-- capabilities. The service role already bypasses RLS, so these functions do
-- not need SECURITY DEFINER.
alter function public.log_system_event(uuid, text, text, uuid, uuid, integer, integer, jsonb)
  security invoker;
alter function public.log_system_event(uuid, text, text, uuid, uuid, integer, integer, jsonb)
  set search_path = public, pg_temp;
revoke all on function public.log_system_event(uuid, text, text, uuid, uuid, integer, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.log_system_event(uuid, text, text, uuid, uuid, integer, integer, jsonb)
  to service_role;

alter function public.get_system_metrics(timestamptz, timestamptz)
  security invoker;
alter function public.get_system_metrics(timestamptz, timestamptz)
  set search_path = public, pg_temp;
revoke all on function public.get_system_metrics(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_system_metrics(timestamptz, timestamptz)
  to service_role;

revoke all on table public.system_events from public, anon, authenticated;
grant select, insert on table public.system_events to service_role;

-- Remove obsolete permissive policies. The scoped trainer/student policies
-- already present on these tables remain in force.
drop policy if exists session_logs_all on public.session_logs;
drop policy if exists scouting_logs_all on public.scouting_logs;

-- Restore organization-scoped NFC policies. These replace permissive policy
-- bodies found in the linked project while preserving every binding/check-in.
drop policy if exists nfc_bindings_select on public.nfc_tag_bindings;
create policy nfc_bindings_select
on public.nfc_tag_bindings
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists nfc_bindings_insert on public.nfc_tag_bindings;
create policy nfc_bindings_insert
on public.nfc_tag_bindings
for insert
to authenticated
with check (public.is_org_admin(organization_id));

drop policy if exists nfc_bindings_delete on public.nfc_tag_bindings;
create policy nfc_bindings_delete
on public.nfc_tag_bindings
for delete
to authenticated
using (public.is_org_admin(organization_id));

drop policy if exists nfc_checkins_select on public.attendance_checkins;
create policy nfc_checkins_select
on public.attendance_checkins
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists nfc_checkins_insert on public.attendance_checkins;
create policy nfc_checkins_insert
on public.attendance_checkins
for insert
to authenticated
with check (public.is_org_member(organization_id));

revoke all on table public.nfc_tag_bindings from public, anon;
revoke all on table public.attendance_checkins from public, anon;
revoke all on table public.nfc_tag_bindings from authenticated;
revoke all on table public.attendance_checkins from authenticated;
grant select, insert, delete on table public.nfc_tag_bindings to authenticated;
grant select, insert on table public.attendance_checkins to authenticated;

-- CPF reveal remains available to authenticated organization admins only; the
-- function itself performs the admin check and writes an access audit record.
revoke all on function public.reveal_student_cpf(text, text, text) from public, anon;
grant execute on function public.reveal_student_cpf(text, text, text) to authenticated, service_role;

-- Trigger-only helpers must not be callable through PostgREST RPC. Some older
-- linked projects contain compatibility helpers that were never part of a
-- clean local bootstrap, so harden whichever helpers are actually present.
do $block$
declare
  helper record;
begin
  for helper in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'events_set_ruleset_for_tournament',
        'set_audit_fields',
        'set_events_updated_at',
        'set_push_tokens_updated_at',
        'set_regulation_clauses_updated_at',
        'sync_scouting_action_compat_columns',
        'sync_scouting_session_compat_columns'
      ])
  loop
    execute format(
      'alter function %s set search_path = public, pg_temp',
      helper.signature
    );
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      helper.signature
    );
  end loop;
end
$block$;

-- PostgREST never needs schema-changing table capabilities.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- New objects require explicit API grants. Existing DML grants are left intact
-- so this migration cannot interrupt or erase current application data.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
