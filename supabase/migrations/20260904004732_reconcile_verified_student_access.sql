-- Retry safe first access after verification/login. No client email or user id
-- is accepted by the public self-service endpoint.
create schema if not exists private;

alter table public.students
  add column if not exists student_access_revoked_at timestamptz;

create or replace function private.remember_student_access_revocation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.student_user_id is not null and new.student_user_id is null then
    new.student_access_revoked_at := now();
  else
    -- Only an explicit invitation can restore a previously removed access.
    new.student_access_revoked_at := old.student_access_revoked_at;
  end if;
  return new;
end;
$$;
revoke all on function private.remember_student_access_revocation() from public, anon, authenticated;

create or replace trigger remember_student_access_revocation
before update on public.students
for each row execute function private.remember_student_access_revocation();

create index if not exists students_normalized_login_email_idx
  on public.students (lower(btrim(login_email)))
  where login_email is not null;

create or replace function private.reconcile_student_access(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user auth.users%rowtype;
  v_student public.students%rowtype;
  v_email text;
  v_matches integer;
  v_student_id text;
begin
  if p_user_id is null or (
    auth.role() is distinct from 'service_role'
    and auth.uid() is distinct from p_user_id
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  -- Read authoritative proof, never user-editable metadata or the hook payload.
  select * into v_user from auth.users where id = p_user_id for share;
  if not found or v_user.is_anonymous is true or v_user.deleted_at is not null
    or v_user.banned_until > now() then
    return 'review_required';
  end if;
  v_email := nullif(lower(btrim(v_user.email)), '');
  if v_email is null or v_user.email_confirmed_at is null or not (
    nullif(btrim(v_user.raw_app_meta_data ->> 'email_verified_hybrid_at'), '') is not null
    or coalesce(v_user.raw_app_meta_data ->> 'provider', '') in ('google', 'apple', 'facebook')
    or coalesce(v_user.raw_app_meta_data -> 'providers', '[]'::jsonb)
      ?| array['google', 'apple', 'facebook']
  ) then
    return 'verification_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 1));
  if exists (select 1 from public.students where student_user_id = p_user_id) then
    return 'already_linked';
  end if;

  -- An email reused by siblings or organizations is not enough to pick a profile.
  select count(*), min(id) into v_matches, v_student_id
  from public.students where lower(btrim(login_email)) = v_email;
  if v_matches = 0 then return 'not_found'; end if;
  if v_matches <> 1 then return 'review_required'; end if;

  -- Same student lock as canonical invitation claims and legacy revocations.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_student_id, 0));
  select * into v_student from public.students where id = v_student_id for update;
  if not found or lower(btrim(v_student.login_email)) is distinct from v_email
    or v_student.organization_id is null
    or v_student.membership_status is distinct from 'active'
    or v_student.student_access_revoked_at is not null then
    return 'review_required';
  end if;
  if v_student.student_user_id = p_user_id then return 'already_linked'; end if;
  if v_student.student_user_id is not null then return 'review_required'; end if;
  if (select count(*) from public.students where lower(btrim(login_email)) = v_email) <> 1 then
    return 'review_required';
  end if;

  -- Never reactivate a revoked athlete or turn an existing guardian into one.
  if exists (
    select 1 from public.student_relationships r
    where r.organization_id = v_student.organization_id and r.student_id = v_student.id
      and (r.relationship_kind = 'athlete' or r.user_id = p_user_id
        or lower(btrim(r.contact_email)) = v_email)
  ) then return 'review_required'; end if;

  -- Explicit invitations retain their own expiry, revocation and permission rules.
  if exists (
    select 1 from public.student_invites i
    where i.organization_id = v_student.organization_id and i.student_id = v_student.id
  ) or exists (
    select 1 from public.student_relationship_invites i
    where i.organization_id = v_student.organization_id and i.student_id = v_student.id
      and (i.relationship_kind = 'athlete' or lower(btrim(i.invited_email)) = v_email)
  ) then return 'invite_required'; end if;

  -- Keep the existing self-access contract. Do not invent relationship grants
  -- (financial, health, consent, guardian) outside an explicit invitation.
  update public.students set student_user_id = p_user_id
  where id = v_student.id and organization_id = v_student.organization_id;
  return 'linked';
end;
$$;

revoke all on function private.reconcile_student_access(uuid) from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.reconcile_student_access(uuid) to authenticated, service_role;

create or replace function public.reconcile_my_student_access_v1()
returns text language sql security invoker set search_path = ''
as $$ select private.reconcile_student_access(auth.uid()); $$;
revoke all on function public.reconcile_my_student_access_v1() from public, anon;
grant execute on function public.reconcile_my_student_access_v1() to authenticated;

create or replace function public.reconcile_student_access_for_user_v1(p_user_id uuid)
returns text language sql security invoker set search_path = ''
as $$ select private.reconcile_student_access(p_user_id); $$;
revoke all on function public.reconcile_student_access_for_user_v1(uuid) from public, anon, authenticated;
grant execute on function public.reconcile_student_access_for_user_v1(uuid) to service_role;

comment on function public.reconcile_my_student_access_v1() is
  'Verified first access only; ambiguous, revoked and invitation-managed profiles are never auto-claimed.';
