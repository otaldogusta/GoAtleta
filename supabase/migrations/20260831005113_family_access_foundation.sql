-- Family and athlete access foundation.
--
-- This migration is deliberately additive. The legacy students.student_user_id
-- link and the legacy student invite RPCs remain available while clients move
-- to type-aware relationships. Guardians, payers and viewers never become
-- organization_members and never occupy students.student_user_id.

create unique index if not exists students_id_organization_unique
  on public.students (id, organization_id);

create table if not exists public.student_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  contact_email text,
  relationship_kind text not null
    check (relationship_kind in ('athlete', 'guardian', 'payer', 'viewer')),
  relationship_label text
    check (relationship_label is null or char_length(relationship_label) <= 80),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  can_view_profile boolean not null default true,
  can_view_schedule boolean not null default false,
  can_view_attendance boolean not null default false,
  can_view_progress boolean not null default false,
  can_view_health boolean not null default false,
  can_sign_consents boolean not null default false,
  can_view_financial boolean not null default false,
  can_pay boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_reason text
    check (revocation_reason is null or char_length(revocation_reason) <= 240),
  constraint student_relationships_student_workspace_fkey
    foreign key (student_id, organization_id)
    references public.students(id, organization_id)
    on delete cascade,
  constraint student_relationships_id_workspace_unique
    unique (id, organization_id),
  constraint student_relationships_email_lowercase
    check (contact_email is null or contact_email = lower(contact_email)),
  constraint student_relationships_status_audit_check
    check (
      (status = 'active' and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)
    ),
  constraint student_relationships_pay_implies_financial_check
    check (not can_pay or can_view_financial)
);

create unique index if not exists student_relationships_active_user_student_unique
  on public.student_relationships (organization_id, student_id, user_id)
  where status = 'active';

create unique index if not exists student_relationships_active_athlete_unique
  on public.student_relationships (organization_id, student_id)
  where status = 'active' and relationship_kind = 'athlete';

create index if not exists student_relationships_user_status_org_idx
  on public.student_relationships (user_id, status, organization_id);

create index if not exists student_relationships_org_student_status_idx
  on public.student_relationships (organization_id, student_id, status);

create table if not exists public.student_relationship_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id text not null,
  token_hash text not null unique,
  invited_email text not null,
  invited_via text not null default 'email'
    check (invited_via in ('email', 'whatsapp', 'link')),
  relationship_kind text not null
    check (relationship_kind in ('athlete', 'guardian', 'payer', 'viewer')),
  relationship_label text
    check (relationship_label is null or char_length(relationship_label) <= 80),
  can_view_profile boolean not null default true,
  can_view_schedule boolean not null default false,
  can_view_attendance boolean not null default false,
  can_view_progress boolean not null default false,
  can_view_health boolean not null default false,
  can_sign_consents boolean not null default false,
  can_view_financial boolean not null default false,
  can_pay boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '30 days'),
  used_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_relationship_id uuid references public.student_relationships(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_reason text
    check (revocation_reason is null or char_length(revocation_reason) <= 240),
  constraint student_relationship_invites_student_workspace_fkey
    foreign key (student_id, organization_id)
    references public.students(id, organization_id)
    on delete cascade,
  constraint student_relationship_invites_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint student_relationship_invites_email_lowercase
    check (
      invited_email = lower(invited_email)
      and invited_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  constraint student_relationship_invites_expiry_check
    check (expires_at > created_at),
  constraint student_relationship_invites_claim_state_check
    check (
      (used_at is null and claimed_by is null and claimed_relationship_id is null)
      or (used_at is not null and claimed_by is not null and claimed_relationship_id is not null)
    ),
  constraint student_relationship_invites_pay_implies_financial_check
    check (not can_pay or can_view_financial)
);

create unique index if not exists student_relationship_invites_pending_recipient_unique
  on public.student_relationship_invites (
    organization_id,
    student_id,
    invited_email,
    relationship_kind
  )
  where used_at is null and revoked_at is null;

create index if not exists student_relationship_invites_org_student_created_idx
  on public.student_relationship_invites (organization_id, student_id, created_at desc);

create index if not exists student_relationship_invites_recipient_status_idx
  on public.student_relationship_invites (invited_email, expires_at)
  where used_at is null and revoked_at is null;

alter table public.student_relationships enable row level security;
alter table public.student_relationship_invites enable row level security;

revoke all on table public.student_relationships from public, anon, authenticated;
revoke all on table public.student_relationship_invites from public, anon, authenticated;
grant select on table public.student_relationships to authenticated;
grant all on table public.student_relationships to service_role;
grant all on table public.student_relationship_invites to service_role;

create policy "student relationships select own or managing staff"
  on public.student_relationships
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.can_manage_student_invites(student_id, organization_id)
  );

-- The invite table intentionally has no authenticated table grant. This policy
-- is defense in depth for future read-only tooling; public clients use the safe
-- list and validation RPCs below.
create policy "student relationship invites select creator staff"
  on public.student_relationship_invites
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    and public.can_manage_student_invites(student_id, organization_id)
  );

insert into public.student_relationships (
  organization_id,
  student_id,
  user_id,
  contact_email,
  relationship_kind,
  relationship_label,
  status,
  can_view_profile,
  can_view_schedule,
  can_view_attendance,
  can_view_progress,
  can_view_health,
  can_sign_consents,
  can_view_financial,
  can_pay,
  created_at,
  claimed_at
)
select
  student.organization_id,
  student.id,
  student.student_user_id,
  nullif(lower(trim(student.login_email)), ''),
  'athlete',
  'Atleta',
  'active',
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  coalesce(nullif(btrim(student.createdat::text), '')::timestamptz, now()),
  coalesce(nullif(btrim(student.createdat::text), '')::timestamptz, now())
from public.students student
where student.organization_id is not null
  and student.student_user_id is not null
on conflict do nothing;

create or replace function public.has_student_relationship(
  p_org_id uuid,
  p_student_id text,
  p_permission_key text
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
    from public.student_relationships relationship
    where relationship.organization_id = p_org_id
      and relationship.student_id = p_student_id
      and relationship.user_id = (select auth.uid())
      and relationship.status = 'active'
      and case p_permission_key
        when 'profile' then relationship.can_view_profile
        when 'schedule' then relationship.can_view_schedule
        when 'attendance' then relationship.can_view_attendance
        when 'progress' then relationship.can_view_progress
        when 'health' then relationship.can_view_health
        when 'consents' then relationship.can_sign_consents
        when 'financial' then relationship.can_view_financial
        when 'pay' then relationship.can_pay
        else false
      end
  );
$$;

revoke all on function public.has_student_relationship(uuid, text, text)
  from public, anon;
grant execute on function public.has_student_relationship(uuid, text, text)
  to authenticated;

create or replace function public.get_my_student_contexts_v1()
returns table (
  relationship_id uuid,
  relationship_kind text,
  relationship_label text,
  organization_id uuid,
  organization_name text,
  student_id text,
  student_name text,
  student_photo_url text,
  class_id text,
  class_name text,
  class_unit text,
  membership_status text,
  can_view_profile boolean,
  can_view_schedule boolean,
  can_view_attendance boolean,
  can_view_progress boolean,
  can_view_health boolean,
  can_sign_consents boolean,
  can_view_financial boolean,
  can_pay boolean
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select
    relationship.id,
    relationship.relationship_kind,
    relationship.relationship_label,
    organization.id,
    organization.name,
    student.id,
    student.name,
    case when relationship.can_view_profile then student.photo_url else null end,
    case when relationship.can_view_schedule then class.id else null end,
    case when relationship.can_view_schedule then class.name else null end,
    case when relationship.can_view_schedule then class.unit else null end,
    case when relationship.can_view_profile then student.membership_status else null end,
    relationship.can_view_profile,
    relationship.can_view_schedule,
    relationship.can_view_attendance,
    relationship.can_view_progress,
    relationship.can_view_health,
    relationship.can_sign_consents,
    relationship.can_view_financial,
    relationship.can_pay
  from public.student_relationships relationship
  join public.students student
    on student.id = relationship.student_id
   and student.organization_id = relationship.organization_id
  join public.organizations organization
    on organization.id = relationship.organization_id
  left join public.classes class
    on class.id = student.classid
   and class.organization_id = student.organization_id
  where relationship.user_id = (select auth.uid())
    and relationship.status = 'active'
  order by organization.name, student.name;
$$;

revoke all on function public.get_my_student_contexts_v1()
  from public, anon;
grant execute on function public.get_my_student_contexts_v1()
  to authenticated;

create or replace function public.get_my_family_overview_v1()
returns table (
  relationship_id uuid,
  organization_id uuid,
  organization_name text,
  student_id text,
  student_name text,
  class_id text,
  class_name text,
  can_view_schedule boolean,
  can_view_attendance boolean,
  can_view_progress boolean,
  next_schedule jsonb,
  attendance_summary jsonb,
  progress_summary jsonb
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select
    relationship.id,
    relationship.organization_id,
    organization.name,
    relationship.student_id,
    student.name,
    case when relationship.can_view_schedule then class.id else null end,
    case when relationship.can_view_schedule then class.name else null end,
    relationship.can_view_schedule,
    relationship.can_view_attendance,
    relationship.can_view_progress,
    case
      when relationship.can_view_schedule then coalesce(schedule.items, '[]'::jsonb)
      else '[]'::jsonb
    end,
    case
      when relationship.can_view_attendance then jsonb_build_object(
        'available', true,
        'total', attendance_totals.total_count,
        'present', attendance_totals.present_count,
        'absent', attendance_totals.absent_count,
        'attendance_rate_percent', attendance_totals.attendance_rate_percent,
        'last_recorded_on', attendance_totals.last_recorded_on,
        'history', coalesce(attendance_history.items, '[]'::jsonb)
      )
      else jsonb_build_object(
        'available', false,
        'reason', 'permission_denied',
        'history', '[]'::jsonb
      )
    end,
    case
      when relationship.can_view_progress then jsonb_build_object(
        'available', false,
        'reason', 'progress_semantics_not_modeled_yet',
        'items', '[]'::jsonb
      )
      else jsonb_build_object(
        'available', false,
        'reason', 'permission_denied',
        'items', '[]'::jsonb
      )
    end
  from public.student_relationships relationship
  join public.organizations organization
    on organization.id = relationship.organization_id
  join public.students student
    on student.id = relationship.student_id
   and student.organization_id = relationship.organization_id
  left join public.classes class
    on class.id = student.classid
   and class.organization_id = student.organization_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'session_id', upcoming.id,
        'class_id', upcoming.class_id,
        'class_name', upcoming.class_name,
        'starts_at', upcoming.start_at,
        'ends_at', upcoming.end_at,
        'session_type', upcoming.type
      ) order by upcoming.start_at
    ) as items
    from (
      select
        session.id,
        session_class.class_id,
        scheduled_class.name as class_name,
        session.start_at,
        session.end_at,
        session.type
      from public.training_sessions session
      join public.training_session_classes session_class
        on session_class.session_id = session.id
       and session_class.organization_id = session.organization_id
      join public.classes scheduled_class
        on scheduled_class.id = session_class.class_id
       and scheduled_class.organization_id = session.organization_id
      where session.organization_id = relationship.organization_id
        and relationship.can_view_schedule
        and session_class.class_id = student.classid
        and session.status = 'scheduled'
        and session.start_at >= now()
      order by session.start_at
      limit 5
    ) upcoming
  ) schedule on true
  left join lateral (
    select
      count(*)::bigint as total_count,
      count(*) filter (
        where lower(attendance.status) in ('presente', 'present')
      )::bigint as present_count,
      count(*) filter (
        where lower(attendance.status) not in ('presente', 'present')
      )::bigint as absent_count,
      case
        when count(*) = 0 then 0::numeric
        else round(
          100::numeric
          * count(*) filter (
              where lower(attendance.status) in ('presente', 'present')
            )::numeric
          / count(*)::numeric,
          1
        )
      end as attendance_rate_percent,
      max(attendance.date) as last_recorded_on
    from public.attendance_logs attendance
    where attendance.organization_id = relationship.organization_id
      and relationship.can_view_attendance
      and attendance.studentid = relationship.student_id
  ) attendance_totals on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'date', recent.date,
        'status', recent.normalized_status,
        'class_id', case when relationship.can_view_schedule then recent.class_id else null end,
        'class_name', case when relationship.can_view_schedule then recent.class_name else null end
      ) order by recent.date desc
    ) as items
    from (
      select
        attendance.date,
        case
          when lower(attendance.status) in ('presente', 'present') then 'present'
          else 'absent'
        end as normalized_status,
        attendance.classid as class_id,
        attended_class.name as class_name
      from public.attendance_logs attendance
      left join public.classes attended_class
        on attended_class.id = attendance.classid
       and attended_class.organization_id = attendance.organization_id
      where attendance.organization_id = relationship.organization_id
        and relationship.can_view_attendance
        and attendance.studentid = relationship.student_id
      order by attendance.date desc
      limit 12
    ) recent
  ) attendance_history on true
  where relationship.user_id = (select auth.uid())
    and relationship.status = 'active'
  order by organization.name, student.name;
$$;

revoke all on function public.get_my_family_overview_v1()
  from public, anon;
grant execute on function public.get_my_family_overview_v1()
  to authenticated;

create or replace function public.list_student_relationships_v1(
  p_org_id uuid,
  p_student_id text
)
returns table (
  relationship_id uuid,
  user_id uuid,
  contact_email text,
  relationship_kind text,
  relationship_label text,
  status text,
  can_view_profile boolean,
  can_view_schedule boolean,
  can_view_attendance boolean,
  can_view_progress boolean,
  can_view_health boolean,
  can_sign_consents boolean,
  can_view_financial boolean,
  can_pay boolean,
  claimed_at timestamptz,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select
    relationship.id,
    relationship.user_id,
    relationship.contact_email,
    relationship.relationship_kind,
    relationship.relationship_label,
    relationship.status,
    relationship.can_view_profile,
    relationship.can_view_schedule,
    relationship.can_view_attendance,
    relationship.can_view_progress,
    relationship.can_view_health,
    relationship.can_sign_consents,
    relationship.can_view_financial,
    relationship.can_pay,
    relationship.claimed_at,
    relationship.revoked_at
  from public.student_relationships relationship
  where relationship.organization_id = p_org_id
    and relationship.student_id = p_student_id
    and (
      public.can_manage_student_invites(p_student_id, p_org_id)
      or relationship.user_id = (select auth.uid())
    )
  order by relationship.status, relationship.claimed_at desc;
$$;

revoke all on function public.list_student_relationships_v1(uuid, text)
  from public, anon;
grant execute on function public.list_student_relationships_v1(uuid, text)
  to authenticated;

create or replace function public.list_student_relationship_invites_v1(
  p_org_id uuid,
  p_student_id text
)
returns table (
  invite_id uuid,
  invited_email text,
  invited_via text,
  relationship_kind text,
  relationship_label text,
  status text,
  expires_at timestamptz,
  created_at timestamptz,
  created_by uuid,
  used_at timestamptz,
  claimed_by uuid,
  revoked_at timestamptz
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
  if not public.can_manage_student_invites(p_student_id, p_org_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  return query
  select
    invite.id,
    invite.invited_email,
    invite.invited_via,
    invite.relationship_kind,
    invite.relationship_label,
    case
      when invite.used_at is not null then 'claimed'
      when invite.revoked_at is not null then 'revoked'
      when invite.expires_at < now() then 'expired'
      else 'pending'
    end,
    invite.expires_at,
    invite.created_at,
    invite.created_by,
    invite.used_at,
    invite.claimed_by,
    invite.revoked_at
  from public.student_relationship_invites invite
  where invite.organization_id = p_org_id
    and invite.student_id = p_student_id
  order by invite.created_at desc;
end;
$$;

revoke all on function public.list_student_relationship_invites_v1(uuid, text)
  from public, anon;
grant execute on function public.list_student_relationship_invites_v1(uuid, text)
  to authenticated;

create or replace function public.create_student_relationship_invite_v1(
  p_org_id uuid,
  p_student_id text,
  p_token_hash text,
  p_invited_email text,
  p_relationship_kind text,
  p_relationship_label text default null,
  p_invited_via text default 'email',
  p_can_view_profile boolean default true,
  p_can_view_schedule boolean default false,
  p_can_view_attendance boolean default false,
  p_can_view_progress boolean default false,
  p_can_view_health boolean default false,
  p_can_sign_consents boolean default false,
  p_can_view_financial boolean default false,
  p_can_pay boolean default false
)
returns table (invite_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor uuid := auth.uid();
  v_email text := nullif(lower(trim(coalesce(p_invited_email, ''))), '');
  v_kind text := lower(trim(coalesce(p_relationship_kind, '')));
  v_channel text := lower(trim(coalesce(p_invited_via, 'email')));
  v_student public.students%rowtype;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVITE_TOKEN_HASH_INVALID';
  end if;
  if v_email is null
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'INVITE_EMAIL_REQUIRED';
  end if;
  if v_kind not in ('athlete', 'guardian', 'payer', 'viewer') then
    raise exception 'RELATIONSHIP_KIND_INVALID';
  end if;
  if v_channel not in ('email', 'whatsapp', 'link') then
    raise exception 'INVITE_CHANNEL_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_org_id::text || ':' || p_student_id || ':' || v_email || ':' || v_kind, 0)
  );

  select student.*
    into v_student
  from public.students student
  where student.id = p_student_id
    and student.organization_id = p_org_id
  for update;

  if not found then
    raise exception 'STUDENT_NOT_FOUND';
  end if;
  if not public.can_manage_student_invites(p_student_id, p_org_id) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_kind = 'athlete' and (
    v_student.student_user_id is not null
    or exists (
      select 1
      from public.student_relationships relationship
      where relationship.organization_id = p_org_id
        and relationship.student_id = p_student_id
        and relationship.relationship_kind = 'athlete'
        and relationship.status = 'active'
    )
  ) then
    raise exception 'ATHLETE_ALREADY_LINKED';
  end if;

  update public.student_relationship_invites invite
  set
    revoked_at = now(),
    revoked_by = v_actor,
    revocation_reason = 'superseded'
  where invite.organization_id = p_org_id
    and invite.student_id = p_student_id
    and invite.invited_email = v_email
    and invite.relationship_kind = v_kind
    and invite.used_at is null
    and invite.revoked_at is null;

  return query
  insert into public.student_relationship_invites (
    organization_id,
    student_id,
    token_hash,
    invited_email,
    invited_via,
    relationship_kind,
    relationship_label,
    can_view_profile,
    can_view_schedule,
    can_view_attendance,
    can_view_progress,
    can_view_health,
    can_sign_consents,
    can_view_financial,
    can_pay,
    created_by
  ) values (
    p_org_id,
    p_student_id,
    lower(p_token_hash),
    v_email,
    v_channel,
    v_kind,
    nullif(trim(p_relationship_label), ''),
    coalesce(p_can_view_profile, true),
    coalesce(p_can_view_schedule, false),
    coalesce(p_can_view_attendance, false),
    coalesce(p_can_view_progress, false),
    coalesce(p_can_view_health, false),
    coalesce(p_can_sign_consents, false),
    coalesce(p_can_view_financial, false) or coalesce(p_can_pay, false),
    coalesce(p_can_pay, false),
    v_actor
  )
  returning
    student_relationship_invites.id,
    student_relationship_invites.expires_at;
end;
$$;

revoke all on function public.create_student_relationship_invite_v1(
  uuid, text, text, text, text, text, text,
  boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) from public, anon;
grant execute on function public.create_student_relationship_invite_v1(
  uuid, text, text, text, text, text, text,
  boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) to authenticated;

create or replace function public.validate_student_relationship_invite_v1(
  p_token_hash text
)
returns table (
  invite_id uuid,
  organization_id uuid,
  organization_name text,
  student_id text,
  student_name text,
  relationship_kind text,
  relationship_label text,
  expires_at timestamptz,
  can_view_profile boolean,
  can_view_schedule boolean,
  can_view_attendance boolean,
  can_view_progress boolean,
  can_view_health boolean,
  can_sign_consents boolean,
  can_view_financial boolean,
  can_pay boolean
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_invite public.student_relationship_invites%rowtype;
begin
  if p_token_hash is null or lower(p_token_hash) !~ '^[0-9a-f]{64}$' then
    raise exception 'INVITE_INVALID';
  end if;

  select invite.*
    into v_invite
  from public.student_relationship_invites invite
  where invite.token_hash = lower(p_token_hash);

  if not found then
    raise exception 'INVITE_INVALID';
  end if;
  if v_invite.used_at is not null then
    raise exception 'INVITE_ALREADY_USED';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'INVITE_REVOKED';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'INVITE_EXPIRED';
  end if;

  return query
  select
    invite.id,
    invite.organization_id,
    organization.name,
    invite.student_id,
    student.name,
    invite.relationship_kind,
    invite.relationship_label,
    invite.expires_at,
    invite.can_view_profile,
    invite.can_view_schedule,
    invite.can_view_attendance,
    invite.can_view_progress,
    invite.can_view_health,
    invite.can_sign_consents,
    invite.can_view_financial,
    invite.can_pay
  from public.student_relationship_invites invite
  join public.organizations organization
    on organization.id = invite.organization_id
  join public.students student
    on student.id = invite.student_id
   and student.organization_id = invite.organization_id
  where invite.id = v_invite.id;
end;
$$;

revoke all on function public.validate_student_relationship_invite_v1(text)
  from public, anon, authenticated;
grant execute on function public.validate_student_relationship_invite_v1(text)
  to service_role;

create or replace function public.claim_student_relationship_invite_v1(
  p_token_hash text,
  p_user_id uuid,
  p_user_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_email text := nullif(lower(trim(coalesce(p_user_email, ''))), '');
  v_invite public.student_relationship_invites%rowtype;
  v_student public.students%rowtype;
  v_relationship_id uuid;
  v_existing_relationship_id uuid;
  v_existing_user_id uuid;
begin
  if p_user_id is null or v_email is null then
    raise exception 'CLAIM_IDENTITY_REQUIRED';
  end if;
  if p_token_hash is null or lower(p_token_hash) !~ '^[0-9a-f]{64}$' then
    raise exception 'INVITE_TOKEN_HASH_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(lower(p_token_hash), 0));

  select invite.*
    into v_invite
  from public.student_relationship_invites invite
  where invite.token_hash = lower(p_token_hash)
  for update;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;
  if v_invite.used_at is not null then
    if v_invite.claimed_by is distinct from p_user_id then
      raise exception 'INVITE_ALREADY_USED';
    end if;
    return jsonb_build_object(
      'status', 'already_claimed',
      'relationship_id', v_invite.claimed_relationship_id,
      'organization_id', v_invite.organization_id,
      'student_id', v_invite.student_id,
      'relationship_kind', v_invite.relationship_kind
    );
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'INVITE_REVOKED';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'INVITE_EXPIRED';
  end if;
  if v_invite.invited_email is distinct from v_email then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_invite.student_id, 0));

  select student.*
    into v_student
  from public.students student
  where student.id = v_invite.student_id
    and student.organization_id = v_invite.organization_id
  for update;

  if not found then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  if v_invite.relationship_kind = 'athlete' then
    select relationship.id, relationship.user_id
      into v_existing_relationship_id, v_existing_user_id
    from public.student_relationships relationship
    where relationship.organization_id = v_invite.organization_id
      and relationship.student_id = v_invite.student_id
      and relationship.relationship_kind = 'athlete'
      and relationship.status = 'active'
    for update;

    if v_existing_user_id is not null and v_existing_user_id is distinct from p_user_id then
      raise exception 'ATHLETE_ALREADY_LINKED';
    end if;
    if v_student.student_user_id is not null
      and v_student.student_user_id is distinct from p_user_id then
      raise exception 'ATHLETE_ALREADY_LINKED';
    end if;
  end if;

  insert into public.student_relationships (
    organization_id,
    student_id,
    user_id,
    contact_email,
    relationship_kind,
    relationship_label,
    status,
    can_view_profile,
    can_view_schedule,
    can_view_attendance,
    can_view_progress,
    can_view_health,
    can_sign_consents,
    can_view_financial,
    can_pay,
    created_by,
    claimed_at
  ) values (
    v_invite.organization_id,
    v_invite.student_id,
    p_user_id,
    v_email,
    v_invite.relationship_kind,
    v_invite.relationship_label,
    'active',
    v_invite.can_view_profile,
    v_invite.can_view_schedule,
    v_invite.can_view_attendance,
    v_invite.can_view_progress,
    v_invite.can_view_health,
    v_invite.can_sign_consents,
    v_invite.can_view_financial,
    v_invite.can_pay,
    v_invite.created_by,
    now()
  )
  on conflict (organization_id, student_id, user_id) where status = 'active'
  do update set
    contact_email = excluded.contact_email,
    relationship_kind = excluded.relationship_kind,
    relationship_label = excluded.relationship_label,
    can_view_profile = excluded.can_view_profile,
    can_view_schedule = excluded.can_view_schedule,
    can_view_attendance = excluded.can_view_attendance,
    can_view_progress = excluded.can_view_progress,
    can_view_health = excluded.can_view_health,
    can_sign_consents = excluded.can_sign_consents,
    can_view_financial = excluded.can_view_financial,
    can_pay = excluded.can_pay,
    revoked_at = null,
    revoked_by = null,
    revocation_reason = null
  returning id into v_relationship_id;

  if v_invite.relationship_kind = 'athlete' then
    update public.students student
    set
      student_user_id = p_user_id,
      login_email = v_email
    where student.id = v_invite.student_id
      and student.organization_id = v_invite.organization_id;
  end if;

  update public.student_relationship_invites invite
  set
    used_at = now(),
    claimed_by = p_user_id,
    claimed_relationship_id = v_relationship_id
  where invite.id = v_invite.id;

  update public.student_relationship_invites invite
  set
    revoked_at = now(),
    revoked_by = p_user_id,
    revocation_reason = 'claimed_elsewhere'
  where invite.organization_id = v_invite.organization_id
    and invite.student_id = v_invite.student_id
    and invite.invited_email = v_invite.invited_email
    and invite.relationship_kind = v_invite.relationship_kind
    and invite.id <> v_invite.id
    and invite.used_at is null
    and invite.revoked_at is null;

  return jsonb_build_object(
    'status', 'claimed',
    'relationship_id', v_relationship_id,
    'organization_id', v_invite.organization_id,
    'student_id', v_invite.student_id,
    'relationship_kind', v_invite.relationship_kind
  );
end;
$$;

revoke all on function public.claim_student_relationship_invite_v1(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_student_relationship_invite_v1(text, uuid, text)
  to service_role;

create or replace function public.revoke_student_relationship_invite_v1(
  p_invite_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_invite public.student_relationship_invites%rowtype;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if v_reason is null then
    raise exception 'REVOCATION_REASON_REQUIRED';
  end if;

  select invite.*
    into v_invite
  from public.student_relationship_invites invite
  where invite.id = p_invite_id
  for update;

  if not found then
    raise exception 'INVITE_NOT_FOUND';
  end if;
  if not public.can_manage_student_invites(
    v_invite.student_id,
    v_invite.organization_id
  ) then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_invite.used_at is not null then
    raise exception 'INVITE_ALREADY_USED';
  end if;
  if v_invite.revoked_at is not null then
    return;
  end if;

  update public.student_relationship_invites invite
  set
    revoked_at = now(),
    revoked_by = v_actor,
    revocation_reason = left(v_reason, 240)
  where invite.id = p_invite_id;
end;
$$;

revoke all on function public.revoke_student_relationship_invite_v1(uuid, text)
  from public, anon;
grant execute on function public.revoke_student_relationship_invite_v1(uuid, text)
  to authenticated;

create or replace function public.revoke_student_relationship_v1(
  p_relationship_id uuid,
  p_reason text,
  p_clear_legacy_login_email boolean default false
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
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'REVOCATION_REASON_REQUIRED';
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
  if v_relationship.status = 'revoked' then
    return;
  end if;

  update public.student_relationships relationship
  set
    status = 'revoked',
    revoked_at = now(),
    revoked_by = v_actor,
    revocation_reason = left(trim(p_reason), 240)
  where relationship.id = p_relationship_id;

  if v_relationship.relationship_kind = 'athlete' then
    update public.students student
    set
      student_user_id = null,
      login_email = case
        when p_clear_legacy_login_email then null
        else student.login_email
      end
    where student.id = v_relationship.student_id
      and student.organization_id = v_relationship.organization_id
      and student.student_user_id = v_relationship.user_id;
  end if;

  update public.student_relationship_invites invite
  set
    revoked_at = coalesce(invite.revoked_at, now()),
    revoked_by = coalesce(invite.revoked_by, v_actor),
    revocation_reason = coalesce(invite.revocation_reason, 'relationship_revoked')
  where invite.organization_id = v_relationship.organization_id
    and invite.student_id = v_relationship.student_id
    and invite.invited_email = v_relationship.contact_email
    and invite.relationship_kind = v_relationship.relationship_kind
    and invite.used_at is null
    and invite.revoked_at is null;
end;
$$;

revoke all on function public.revoke_student_relationship_v1(uuid, text, boolean)
  from public, anon;
grant execute on function public.revoke_student_relationship_v1(uuid, text, boolean)
  to authenticated;

comment on table public.student_relationships is
  'Organization-scoped links between auth users and athletes. Family users are not staff memberships.';
comment on table public.student_relationship_invites is
  'Hashed, expiring and type-aware invitations. Only athlete claims maintain legacy student_user_id compatibility.';
comment on function public.get_my_student_contexts_v1() is
  'Safe family context projection. It intentionally excludes health, CPF, phone, login and raw student rows.';
comment on function public.get_my_family_overview_v1() is
  'Safe schedule and attendance projection. Progress remains unavailable until a reviewed metric contract exists.';
