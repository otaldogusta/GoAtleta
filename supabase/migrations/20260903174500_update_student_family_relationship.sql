-- Allow authorized coordination staff to edit an accepted family relationship
-- without replacing the identity attached to the athlete.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.update_student_relationship_v1(
  p_relationship_id uuid,
  p_relationship_kind text,
  p_relationship_label text,
  p_can_view_profile boolean,
  p_can_view_schedule boolean,
  p_can_view_attendance boolean,
  p_can_view_progress boolean,
  p_can_view_health boolean,
  p_can_sign_consents boolean,
  p_can_view_financial boolean,
  p_can_pay boolean
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor uuid := auth.uid();
  v_relationship public.student_relationships%rowtype;
  v_kind text := lower(trim(coalesce(p_relationship_kind, '')));
  v_label text := nullif(trim(coalesce(p_relationship_label, '')), '');
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select relationship.*
    into v_relationship
  from public.student_relationships relationship
  where relationship.id = p_relationship_id
  for update;

  if not found then
    raise exception 'RELATIONSHIP_NOT_FOUND';
  end if;
  if not public.can_manage_student_invites(
    v_relationship.student_id,
    v_relationship.organization_id
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_relationship.status <> 'active' then
    raise exception 'RELATIONSHIP_NOT_ACTIVE';
  end if;
  if v_relationship.relationship_kind = 'athlete' or v_kind = 'athlete' then
    raise exception 'ATHLETE_RELATIONSHIP_IMMUTABLE';
  end if;
  if v_kind not in ('guardian', 'payer', 'viewer') then
    raise exception 'RELATIONSHIP_KIND_INVALID';
  end if;
  if char_length(coalesce(v_label, '')) > 80 then
    raise exception 'RELATIONSHIP_LABEL_INVALID';
  end if;

  update public.student_relationships relationship
  set
    relationship_kind = v_kind,
    relationship_label = v_label,
    can_view_profile = coalesce(p_can_view_profile, false),
    can_view_schedule = coalesce(p_can_view_schedule, false),
    can_view_attendance = coalesce(p_can_view_attendance, false),
    can_view_progress = coalesce(p_can_view_progress, false),
    can_view_health = false,
    can_sign_consents = false,
    can_view_financial = coalesce(p_can_view_financial, false)
      or coalesce(p_can_pay, false),
    can_pay = coalesce(p_can_pay, false)
  where relationship.id = v_relationship.id;
end;
$$;

revoke all on function private.update_student_relationship_v1(
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) from public, anon;

grant execute on function private.update_student_relationship_v1(
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) to authenticated;

-- One organization-scoped read replaces per-row requests in the athlete list.
-- It returns only the primary active family link or newest valid pending invite.
create or replace function private.list_student_family_access_summaries_v1(
  p_org_id uuid
)
returns table (
  student_id text,
  access_status text,
  relationship_id uuid,
  invite_id uuid,
  contact_name text,
  contact_email text,
  relationship_kind text,
  relationship_label text,
  expires_at timestamptz
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

  return query
  select
    student.id,
    case
      when active_relationship.id is not null then 'active'
      when pending_invite.id is not null then 'invited'
      else 'none'
    end,
    active_relationship.id,
    pending_invite.id,
    coalesce(
      nullif(trim(family_user.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(family_user.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(student.guardian_name), '')
    ),
    coalesce(active_relationship.contact_email, pending_invite.invited_email),
    coalesce(active_relationship.relationship_kind, pending_invite.relationship_kind),
    coalesce(active_relationship.relationship_label, pending_invite.relationship_label),
    pending_invite.expires_at
  from public.students student
  left join lateral (
    select relationship.*
    from public.student_relationships relationship
    where relationship.organization_id = p_org_id
      and relationship.student_id = student.id
      and relationship.status = 'active'
      and relationship.relationship_kind <> 'athlete'
    order by relationship.claimed_at desc
    limit 1
  ) active_relationship on true
  left join lateral (
    select invite.*
    from public.student_relationship_invites invite
    where invite.organization_id = p_org_id
      and invite.student_id = student.id
      and invite.relationship_kind <> 'athlete'
      and invite.used_at is null
      and invite.revoked_at is null
      and invite.expires_at >= now()
    order by invite.created_at desc
    limit 1
  ) pending_invite on active_relationship.id is null
  left join auth.users family_user
    on family_user.id = active_relationship.user_id
  where student.organization_id = p_org_id
    and public.can_manage_student_invites(student.id, p_org_id)
  order by student.name;
end;
$$;

revoke all on function private.list_student_family_access_summaries_v1(uuid)
  from public, anon;
grant execute on function private.list_student_family_access_summaries_v1(uuid)
  to authenticated;

-- Public endpoints keep the caller's privileges; authorization is checked again
-- inside the private implementation before any scoped read or write.
create or replace function public.update_student_relationship_v1(
  p_relationship_id uuid,
  p_relationship_kind text,
  p_relationship_label text,
  p_can_view_profile boolean,
  p_can_view_schedule boolean,
  p_can_view_attendance boolean,
  p_can_view_progress boolean,
  p_can_view_health boolean,
  p_can_sign_consents boolean,
  p_can_view_financial boolean,
  p_can_pay boolean
)
returns void language sql security invoker set search_path = ''
as $$
  select private.update_student_relationship_v1(
    p_relationship_id, p_relationship_kind, p_relationship_label,
    p_can_view_profile, p_can_view_schedule, p_can_view_attendance,
    p_can_view_progress, p_can_view_health, p_can_sign_consents,
    p_can_view_financial, p_can_pay
  );
$$;
revoke all on function public.update_student_relationship_v1(uuid,text,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) from public, anon;
grant execute on function public.update_student_relationship_v1(uuid,text,text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;

create or replace function public.list_student_family_access_summaries_v1(p_org_id uuid)
returns table (
  student_id text, access_status text, relationship_id uuid, invite_id uuid,
  contact_name text, contact_email text, relationship_kind text,
  relationship_label text, expires_at timestamptz
)
language sql stable security invoker set search_path = ''
as $$ select * from private.list_student_family_access_summaries_v1(p_org_id); $$;
revoke all on function public.list_student_family_access_summaries_v1(uuid) from public, anon;
grant execute on function public.list_student_family_access_summaries_v1(uuid) to authenticated;
