-- Claiming a student invite must never consume the token without linking the
-- athlete profile. Keep the whole mutation inside one database transaction and
-- expose it only to the service role used by the authenticated Edge Function.
alter table public.student_invites
  add column if not exists organization_id uuid,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id) on delete set null;

update public.student_invites invite
set organization_id = student.organization_id
from public.students student
where student.id = invite.student_id
  and invite.organization_id is null;

do $$
begin
  if exists (
    select 1
    from public.student_invites invite
    where invite.organization_id is null
  ) then
    raise exception 'Student invites without an organization must be reconciled';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.student_invites'::regclass
      and conname = 'student_invites_organization_fkey'
  ) then
    alter table public.student_invites
      add constraint student_invites_organization_fkey
      foreign key (organization_id)
      references public.organizations (id)
      on delete cascade
      not valid;
  end if;
end
$$;

alter table public.student_invites
  alter column organization_id set not null;

alter table public.student_invites
  validate constraint student_invites_organization_fkey;

create index if not exists student_invites_org_created_idx
  on public.student_invites (organization_id, created_at desc);

create index if not exists student_invites_revoked_by_idx
  on public.student_invites (revoked_by)
  where revoked_by is not null;

create or replace function public.guard_student_invite_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_student_organization_id uuid;
begin
  select student.organization_id
    into v_student_organization_id
  from public.students student
  where student.id = new.student_id;

  if not found then
    raise exception 'STUDENT_NOT_FOUND';
  end if;
  if tg_op = 'UPDATE' and (
    new.student_id is distinct from old.student_id
    or new.organization_id is distinct from old.organization_id
  ) then
    raise exception 'INVITE_IDENTITY_IMMUTABLE';
  end if;
  if new.organization_id is null then
    new.organization_id := v_student_organization_id;
  elsif new.organization_id is distinct from v_student_organization_id then
    raise exception 'INVITE_ORGANIZATION_MISMATCH';
  end if;

  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.student_id, 0));
    update public.student_invites invite
    set
      revoked = true,
      revoked_at = now(),
      revoked_by = new.created_by
    where invite.student_id = new.student_id
      and invite.used_at is null
      and not invite.revoked;
  end if;

  if new.invited_via = 'email' then
    new.invited_to := nullif(lower(trim(coalesce(new.invited_to, ''))), '');
    if new.invited_to is null
      or new.invited_to !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'INVITE_EMAIL_REQUIRED';
    end if;
  end if;

  if (new.used_at is null) <> (new.claimed_by is null) then
    raise exception 'INVITE_CLAIM_STATE_INVALID';
  end if;

  if new.revoked then
    if tg_op = 'INSERT' then
      new.revoked_at := coalesce(new.revoked_at, now());
      new.revoked_by := coalesce(new.revoked_by, auth.uid());
    elsif not old.revoked then
      new.revoked_at := coalesce(new.revoked_at, now());
      new.revoked_by := coalesce(new.revoked_by, auth.uid());
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists student_invites_guard_integrity
  on public.student_invites;
create trigger student_invites_guard_integrity
before insert or update of organization_id, student_id, invited_via, invited_to, used_at, claimed_by, revoked
on public.student_invites
for each row execute function public.guard_student_invite_integrity();

revoke all on function public.guard_student_invite_integrity()
  from public, anon, authenticated;

drop policy if exists "student_invites select own" on public.student_invites;

create or replace function public.can_manage_student_invites(
  p_student_id text,
  p_org_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.students student
    where student.id = p_student_id
      and student.organization_id = p_org_id
      and public.has_org_member_permission(p_org_id, 'students')
      and (
        public.is_org_admin(p_org_id)
        or public.is_class_staff(student.classid)
      )
  );
$$;

revoke all on function public.can_manage_student_invites(text, uuid)
  from public, anon;
grant execute on function public.can_manage_student_invites(text, uuid)
  to authenticated;

create policy "student_invites select own"
  on public.student_invites
  for select
  to authenticated
  using (
    created_by = auth.uid()
    and public.can_manage_student_invites(
      student_invites.student_id,
      student_invites.organization_id
    )
  );

revoke insert, update, delete on table public.student_invites from authenticated;
grant select on table public.student_invites to authenticated;

-- Invitation creation is an authorization-sensitive mutation. Keep the raw
-- token in the Edge Function, but validate the actor and persist its hash in
-- the same transaction that serializes every operation for this athlete.
create or replace function public.create_student_invite_access(
  p_student_id text,
  p_token_hash text,
  p_invited_via text,
  p_invited_to text default null
)
returns table (
  invite_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_student public.students%rowtype;
  v_invited_via text := lower(trim(coalesce(p_invited_via, '')));
  v_invited_to text := nullif(trim(coalesce(p_invited_to, '')), '');
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVITE_INVALID';
  end if;

  if v_invited_via not in ('whatsapp', 'email', 'link') then
    raise exception 'INVITE_CHANNEL_INVALID';
  end if;

  if char_length(coalesce(v_invited_to, '')) > 255 then
    raise exception 'INVITE_DESTINATION_INVALID';
  end if;

  if v_invited_via = 'email' then
    v_invited_to := nullif(lower(v_invited_to), '');
    if v_invited_to is null
      or v_invited_to !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'INVITE_EMAIL_REQUIRED';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_student_id, 0));

  select student.*
    into v_student
  from public.students student
  where student.id = p_student_id
  for update;

  if not found then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  if not public.can_manage_student_invites(
    v_student.id,
    v_student.organization_id
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_student.student_user_id is not null then
    raise exception 'STUDENT_ALREADY_LINKED';
  end if;

  return query
  insert into public.student_invites (
    student_id,
    organization_id,
    token_hash,
    created_by,
    expires_at,
    invited_via,
    invited_to
  )
  values (
    v_student.id,
    v_student.organization_id,
    p_token_hash,
    auth.uid(),
    now() + interval '30 days',
    v_invited_via,
    v_invited_to
  )
  returning
    student_invites.id,
    student_invites.expires_at;
end;
$$;

revoke all on function public.create_student_invite_access(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_student_invite_access(text, text, text, text)
  to authenticated;

create or replace function public.list_student_invites_access(
  p_org_id uuid
)
returns table (
  id uuid,
  student_id text,
  student_name text,
  organization_id uuid,
  created_at timestamptz,
  expires_at timestamptz,
  invited_via text,
  invited_to text
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if p_org_id is null then
    raise exception 'ORGANIZATION_REQUIRED';
  end if;

  return query
  select
    invite.id,
    invite.student_id,
    student.name,
    invite.organization_id,
    invite.created_at,
    invite.expires_at,
    invite.invited_via,
    invite.invited_to
  from public.student_invites invite
  join public.students student
    on student.id = invite.student_id
   and student.organization_id = invite.organization_id
  where invite.organization_id = p_org_id
    and invite.used_at is null
    and not invite.revoked
    and (invite.expires_at is null or invite.expires_at >= now())
    and public.can_manage_student_invites(
      invite.student_id,
      invite.organization_id
    )
  order by invite.created_at desc
  limit 100;
end;
$$;

revoke all on function public.list_student_invites_access(uuid)
  from public, anon, authenticated;
grant execute on function public.list_student_invites_access(uuid)
  to authenticated;

create or replace function public.revoke_student_invite_access(
  p_invite_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_student_id text;
  v_student public.students%rowtype;
  v_invite public.student_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select invite.student_id
    into v_student_id
  from public.student_invites invite
  where invite.id = p_invite_id;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_student_id, 0));

  select student.*
    into v_student
  from public.students student
  where student.id = v_student_id
  for update;

  if not found then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  select invite.*
    into v_invite
  from public.student_invites invite
  where invite.id = p_invite_id
  for update;

  if not found or v_invite.student_id is distinct from v_student.id then
    raise exception 'INVITE_INVALID';
  end if;

  if not public.can_manage_student_invites(
    v_student.id,
    v_student.organization_id
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_invite.revoked then
    return 'already_revoked';
  end if;

  update public.student_invites invite
  set
    revoked = true,
    revoked_at = now(),
    revoked_by = auth.uid()
  where invite.id = v_invite.id;

  return 'revoked';
end;
$$;

revoke all on function public.revoke_student_invite_access(uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_student_invite_access(uuid)
  to authenticated;

create or replace function public.claim_student_invite_access(
  p_token_hash text,
  p_user_id uuid,
  p_user_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_invite public.student_invites%rowtype;
  v_student public.students%rowtype;
  v_student_id text;
  v_normalized_email text := nullif(lower(trim(coalesce(p_user_email, ''))), '');
  v_already_claimed boolean := false;
begin
  if p_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVITE_INVALID';
  end if;

  select invite.student_id
    into v_student_id
  from public.student_invites invite
  where invite.token_hash = p_token_hash;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_student_id, 0));

  -- Every athlete-link mutation uses the same lock order: advisory key,
  -- athlete row, then invitation row. This prevents claim/revoke deadlocks.
  select student.*
    into v_student
  from public.students student
  where student.id = v_student_id
  for update;

  if not found then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  select invite.*
    into v_invite
  from public.student_invites invite
  where invite.token_hash = p_token_hash
  for update;

  if not found or v_invite.student_id is distinct from v_student.id then
    raise exception 'INVITE_INVALID';
  end if;

  if v_invite.used_at is not null then
    if v_invite.claimed_by is distinct from p_user_id then
      raise exception 'INVITE_ALREADY_USED';
    end if;
    v_already_claimed := true;
  else
    if v_invite.revoked then
      raise exception 'INVITE_REVOKED';
    end if;
    if v_invite.expires_at is not null and v_invite.expires_at < now() then
      raise exception 'INVITE_EXPIRED';
    end if;
    if v_invite.invited_via = 'email' then
      if nullif(lower(trim(coalesce(v_invite.invited_to, ''))), '') is null then
        raise exception 'INVITE_INVALID';
      end if;
      if v_normalized_email is null
        or lower(trim(v_invite.invited_to)) is distinct from v_normalized_email then
        raise exception 'INVITE_EMAIL_MISMATCH';
      end if;
    end if;
  end if;

  if v_student.student_user_id is not null
    and v_student.student_user_id is distinct from p_user_id then
    raise exception 'STUDENT_ALREADY_LINKED';
  end if;

  if v_already_claimed then
    if v_invite.revoked then
      raise exception 'INVITE_REVOKED';
    end if;
    if v_student.student_user_id is distinct from p_user_id then
      raise exception 'INVITE_ALREADY_USED';
    end if;
    return jsonb_build_object(
      'status', 'already_claimed',
      'student_id', v_invite.student_id
    );
  end if;

  update public.students student
  set
    student_user_id = p_user_id,
    login_email = case
      when student.login_email is null then v_normalized_email
      else student.login_email
    end
  where student.id = v_invite.student_id;

  update public.student_invites invite
  set
    used_at = now(),
    claimed_by = p_user_id
  where invite.id = v_invite.id;

  update public.student_invites invite
  set
    revoked = true,
    revoked_at = now(),
    revoked_by = p_user_id
  where invite.student_id = v_invite.student_id
    and invite.id <> v_invite.id
    and invite.used_at is null
    and not invite.revoked;

  return jsonb_build_object(
    'status', 'claimed',
    'student_id', v_invite.student_id
  );
end;
$$;

revoke all on function public.claim_student_invite_access(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_student_invite_access(text, uuid, text)
  to service_role;

-- Revoking access and invalidating every outstanding or previously used link
-- is the inverse atomic operation. Authorization is evaluated from the caller's
-- JWT inside the database to avoid a read-then-write IDOR window.
create or replace function public.revoke_student_access(
  p_student_id text,
  p_clear_login_email boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_student public.students%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_student_id, 0));

  select student.*
    into v_student
  from public.students student
  where student.id = p_student_id
  for update;

  if not found then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  if not (
    public.can_manage_student_invites(
      v_student.id,
      v_student.organization_id
    )
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  update public.student_invites invite
  set
    revoked = true,
    revoked_at = now(),
    revoked_by = auth.uid()
  where invite.student_id = v_student.id
    and not invite.revoked;

  update public.students student
  set
    student_user_id = null,
    login_email = case
      when p_clear_login_email then null
      else student.login_email
    end
  where student.id = v_student.id;
end;
$$;

revoke all on function public.revoke_student_access(text, boolean)
  from public, anon;
grant execute on function public.revoke_student_access(text, boolean)
  to authenticated;

-- Trainer invitation creation and cancellation use the caller JWT inside the
-- transaction. Holding the actor membership row prevents an authorization
-- check from racing a concurrent demotion or organization removal.
create or replace function public.create_trainer_invite_access(
  p_org_id uuid,
  p_code_hash text,
  p_target_role_level int,
  p_invited_via text,
  p_invited_to text default null,
  p_initial_permissions jsonb default '[]'::jsonb
)
returns table (
  invite_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor_role_level int;
  v_invited_via text := lower(trim(coalesce(p_invited_via, '')));
  v_invited_to text := nullif(trim(coalesce(p_invited_to, '')), '');
  v_permissions jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVITE_INVALID';
  end if;

  if p_target_role_level is null
    or p_target_role_level not in (5, 10, 50) then
    raise exception 'INVITE_ROLE_INVALID';
  end if;

  if v_invited_via not in ('whatsapp', 'email', 'link') then
    raise exception 'INVITE_CHANNEL_INVALID';
  end if;

  if char_length(coalesce(v_invited_to, '')) > 255 then
    raise exception 'INVITE_DESTINATION_INVALID';
  end if;

  if v_invited_via = 'email' then
    v_invited_to := nullif(lower(v_invited_to), '');
    if v_invited_to is null
      or v_invited_to !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'INVITE_EMAIL_REQUIRED';
    end if;
  end if;

  if p_initial_permissions is null then
    p_initial_permissions := '[]'::jsonb;
  elsif jsonb_typeof(p_initial_permissions) <> 'array' then
    raise exception 'INVITE_PERMISSIONS_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_initial_permissions) permission(permission_key)
    where permission.permission_key is null
      or permission.permission_key not in (
        'reports', 'events', 'students', 'classes', 'training', 'periodization',
        'calendar', 'absence_notices', 'whatsapp_settings', 'assistant',
        'financial'
      )
  ) then
    raise exception 'INVITE_PERMISSIONS_INVALID';
  end if;

  select coalesce(jsonb_agg(permission.permission_key order by permission.permission_key), '[]'::jsonb)
    into v_permissions
  from (
    select distinct permission.permission_key
    from jsonb_array_elements_text(p_initial_permissions) permission(permission_key)
  ) permission;

  select member.role_level
    into v_actor_role_level
  from public.organization_members member
  where member.organization_id = p_org_id
    and member.user_id = auth.uid()
  for update;

  if v_actor_role_level is null or v_actor_role_level < 50 then
    raise exception 'NOT_AUTHORIZED';
  end if;

  return query
  insert into public.trainer_invites (
    code_hash,
    created_by,
    expires_at,
    max_uses,
    uses,
    revoked,
    organization_id,
    target_role_level,
    invited_via,
    invited_to,
    initial_permissions,
    delivery_status
  )
  values (
    p_code_hash,
    auth.uid(),
    now() + interval '14 days',
    1,
    0,
    false,
    p_org_id,
    p_target_role_level,
    v_invited_via,
    v_invited_to,
    v_permissions,
    case when v_invited_via = 'email' then 'pending_delivery' else 'not_applicable' end
  )
  returning
    trainer_invites.id,
    trainer_invites.expires_at;
end;
$$;

revoke all on function public.create_trainer_invite_access(
  uuid, text, int, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_trainer_invite_access(
  uuid, text, int, text, text, jsonb
) to authenticated;

create or replace function public.list_trainer_invites_access(
  p_org_id uuid
)
returns table (
  id uuid,
  organization_id uuid,
  target_role_level int,
  created_at timestamptz,
  expires_at timestamptz,
  max_uses int,
  uses int,
  revoked boolean,
  revoked_at timestamptz,
  revoked_by uuid,
  claimed_by uuid,
  claimed_at timestamptz,
  invited_via text,
  invited_to text,
  initial_permissions jsonb,
  delivery_status text,
  delivery_attempted_at timestamptz,
  claim_failed_at timestamptz,
  claim_error_code text
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor_role_level int;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if p_org_id is null then
    raise exception 'ORGANIZATION_REQUIRED';
  end if;

  select member.role_level
    into v_actor_role_level
  from public.organization_members member
  where member.organization_id = p_org_id
    and member.user_id = auth.uid()
  for share;

  if v_actor_role_level is null or v_actor_role_level < 50 then
    raise exception 'NOT_AUTHORIZED';
  end if;

  return query
  select
    invite.id,
    invite.organization_id,
    invite.target_role_level,
    invite.created_at,
    invite.expires_at,
    invite.max_uses,
    invite.uses,
    invite.revoked,
    invite.revoked_at,
    invite.revoked_by,
    invite.claimed_by,
    invite.claimed_at,
    invite.invited_via,
    invite.invited_to,
    invite.initial_permissions,
    invite.delivery_status,
    invite.delivery_attempted_at,
    invite.claim_failed_at,
    invite.claim_error_code
  from public.trainer_invites invite
  where invite.organization_id = p_org_id
  order by invite.created_at desc
  limit 100;
end;
$$;

revoke all on function public.list_trainer_invites_access(uuid)
  from public, anon, authenticated;
grant execute on function public.list_trainer_invites_access(uuid)
  to authenticated;

create or replace function public.revoke_trainer_invite_access(
  p_invite_id uuid,
  p_org_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor_role_level int;
  v_invite public.trainer_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  -- Claiming a trainer invite locks the invitation before touching a member.
  -- Use the same order here to prevent claim/cancel deadlocks.
  select invite.*
    into v_invite
  from public.trainer_invites invite
  where invite.id = p_invite_id
    and invite.organization_id = p_org_id
  for update;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  select member.role_level
    into v_actor_role_level
  from public.organization_members member
  where member.organization_id = p_org_id
    and member.user_id = auth.uid()
  for update;

  if v_actor_role_level is null or v_actor_role_level < 50 then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if v_invite.revoked then
    return 'already_revoked';
  end if;

  update public.trainer_invites invite
  set
    revoked = true,
    revoked_at = now(),
    revoked_by = auth.uid()
  where invite.id = v_invite.id;

  return 'revoked';
end;
$$;

revoke all on function public.revoke_trainer_invite_access(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_trainer_invite_access(uuid, uuid)
  to authenticated;

-- Access requests use the same response for matching and non-matching e-mails.
-- Resolve the coordinator directly without paginating Auth users, and keep
-- notification creation idempotent even after the first notification is read.
do $$
begin
  if exists (
    select 1
    from public.notifications notification
    where notification.source_type = 'access_request'
      and notification.source_id is not null
    group by
      notification.organization_id,
      notification.recipient_user_id,
      notification.source_type,
      notification.source_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate access request notifications must be reconciled';
  end if;
end
$$;

create unique index if not exists notifications_access_request_delivery_uidx
  on public.notifications (
    organization_id,
    recipient_user_id,
    source_type,
    source_id
  )
  where source_type = 'access_request'
    and source_id is not null;

create or replace function public.resolve_access_request_coordinator(
  p_email text
)
returns table (
  coordinator_user_id uuid,
  organization_id uuid
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select
    account.id,
    member.organization_id
  from auth.users account
  join public.organization_members member
    on member.user_id = account.id
   and member.role_level >= 50
  where lower(account.email::text) = lower(trim(p_email))
  order by member.created_at asc
  limit 20;
$$;

revoke all on function public.resolve_access_request_coordinator(text)
  from public, anon, authenticated;
grant execute on function public.resolve_access_request_coordinator(text)
  to service_role;
