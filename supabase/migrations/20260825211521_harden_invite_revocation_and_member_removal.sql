-- Keep invitation cancellation auditable while remaining compatible with
-- already-issued links and the previous revoke Edge Function during rollout.
alter table public.trainer_invites
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id) on delete set null;

create index if not exists trainer_invites_revoked_by_idx
  on public.trainer_invites (revoked_by)
  where revoked_by is not null;

-- Invitation mutations are server-side operations. Keep authenticated reads
-- available through the existing SELECT policies, but require Edge Functions
-- or another service-role caller for every write.
revoke insert, update, delete on table public.trainer_invites
  from anon, authenticated;
revoke insert, update, delete on table public.student_invites
  from anon, authenticated;

drop policy if exists "trainer_invites insert trainer"
  on public.trainer_invites;
drop policy if exists "trainer_invites update trainer"
  on public.trainer_invites;
drop policy if exists "student_invites insert trainer"
  on public.student_invites;
drop policy if exists "student_invites update trainer"
  on public.student_invites;

create or replace function public.stamp_trainer_invite_revocation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.revoked then
      new.revoked_at := coalesce(new.revoked_at, now());
      new.revoked_by := coalesce(new.revoked_by, auth.uid());
    end if;
    return new;
  end if;

  if new.revoked and not old.revoked then
    new.revoked_at := coalesce(new.revoked_at, now());
    new.revoked_by := coalesce(new.revoked_by, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trainer_invites_stamp_revocation
  on public.trainer_invites;
create trigger trainer_invites_stamp_revocation
before insert or update of revoked on public.trainer_invites
for each row execute function public.stamp_trainer_invite_revocation();

revoke all on function public.stamp_trainer_invite_revocation()
  from public, anon, authenticated;

-- A removed member may have legacy permission overrides left by older RPCs.
-- Preserve those rows in a private, recoverable archive and clear them only if
-- the same identity actually re-enters the organization. An ON CONFLICT upsert
-- for an existing member is left untouched.
create schema if not exists private;

create table if not exists private.orphaned_member_permission_archive (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  permission_key text not null,
  is_allowed boolean not null,
  original_updated_at timestamptz,
  original_updated_by uuid,
  archived_at timestamptz not null default now(),
  archive_reason text not null default 'membership_recreated'
);

create index if not exists orphaned_member_permission_archive_org_user_idx
  on private.orphaned_member_permission_archive (organization_id, user_id, archived_at desc);

revoke all on table private.orphaned_member_permission_archive
  from public, anon, authenticated;

create or replace function private.archive_stale_permissions_before_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if exists (
    select 1
    from public.organization_members member
    where member.organization_id = new.organization_id
      and member.user_id = new.user_id
  ) then
    return new;
  end if;

  insert into private.orphaned_member_permission_archive (
    organization_id,
    user_id,
    permission_key,
    is_allowed,
    original_updated_at,
    original_updated_by
  )
  select
    permission.organization_id,
    permission.user_id,
    permission.permission_key,
    permission.is_allowed,
    permission.updated_at,
    permission.updated_by
  from public.organization_member_permissions permission
  where permission.organization_id = new.organization_id
    and permission.user_id = new.user_id;

  delete from public.organization_member_permissions permission
  where permission.organization_id = new.organization_id
    and permission.user_id = new.user_id;

  return new;
end;
$$;

revoke all on function private.archive_stale_permissions_before_membership()
  from public, anon, authenticated;

drop trigger if exists organization_members_archive_stale_permissions
  on public.organization_members;
create trigger organization_members_archive_stale_permissions
before insert on public.organization_members
for each row execute function private.archive_stale_permissions_before_membership();

-- The persistence model records a single claimant. Enforce that invariant for
-- new invitations without making unrelated updates to legacy multi-use rows
-- fail validation.
alter table public.trainer_invites
  drop constraint if exists trainer_invites_single_use_check;

create or replace function public.enforce_single_use_trainer_invite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.max_uses is distinct from 1 then
    raise exception using
      errcode = '23514',
      message = 'Trainer invitations must be single-use';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_single_use_trainer_invite()
  from public, anon, authenticated;

drop trigger if exists trainer_invites_enforce_single_use
  on public.trainer_invites;
create trigger trainer_invites_enforce_single_use
before insert on public.trainer_invites
for each row execute function public.enforce_single_use_trainer_invite();

-- Couple organization-scoped access rows to the membership that authorizes
-- them. Add the FKs as NOT VALID first so new writes are checked immediately;
-- permission orphans are archived and that FK is validated below.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.class_staff'::regclass
      and conname = 'class_staff_membership_fkey'
  ) then
    alter table public.class_staff
      add constraint class_staff_membership_fkey
      foreign key (organization_id, user_id)
      references public.organization_members (organization_id, user_id)
      on delete cascade
      not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization_member_permissions'::regclass
      and conname = 'organization_member_permissions_membership_fkey'
  ) then
    alter table public.organization_member_permissions
      add constraint organization_member_permissions_membership_fkey
      foreign key (organization_id, user_id)
      references public.organization_members (organization_id, user_id)
      on delete cascade
      not valid;
  end if;
end;
$$;

-- Legacy permission overrides can predate the membership FK. Preserve every
-- orphan in the private archive, remove it from the live authorization table,
-- and then validate the FK so no unverified legacy rows remain.
insert into private.orphaned_member_permission_archive (
  organization_id,
  user_id,
  permission_key,
  is_allowed,
  original_updated_at,
  original_updated_by,
  archive_reason
)
select
  permission.organization_id,
  permission.user_id,
  permission.permission_key,
  permission.is_allowed,
  permission.updated_at,
  permission.updated_by,
  'orphaned_before_membership_fk'
from public.organization_member_permissions permission
where not exists (
  select 1
  from public.organization_members member
  where member.organization_id = permission.organization_id
    and member.user_id = permission.user_id
);

delete from public.organization_member_permissions permission
where not exists (
  select 1
  from public.organization_members member
  where member.organization_id = permission.organization_id
    and member.user_id = permission.user_id
);

alter table public.organization_member_permissions
  validate constraint organization_member_permissions_membership_fkey;

-- Class authorization must be backed by both a consistent class assignment
-- and a current organization membership, including for legacy staff rows that
-- are not yet covered by the NOT VALID FK validation.
create or replace function public.is_class_staff(_class_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.class_staff staff
    join public.classes class_group
      on class_group.id = staff.class_id
     and class_group.organization_id = staff.organization_id
    join public.organization_members member
      on member.organization_id = staff.organization_id
     and member.user_id = staff.user_id
    where staff.class_id = _class_id
      and staff.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_class_head(_class_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.class_staff staff
    join public.classes class_group
      on class_group.id = staff.class_id
     and class_group.organization_id = staff.organization_id
    join public.organization_members member
      on member.organization_id = staff.organization_id
     and member.user_id = staff.user_id
    where staff.class_id = _class_id
      and staff.user_id = (select auth.uid())
      and staff.staff_role = 'head'
  );
$$;

revoke all on function public.is_class_staff(text) from public, anon;
revoke all on function public.is_class_head(text) from public, anon;
grant execute on function public.is_class_staff(text) to authenticated;
grant execute on function public.is_class_head(text) to authenticated;

drop policy if exists "org_member_permissions select own_or_admin"
  on public.organization_member_permissions;
create policy "org_member_permissions select own_or_admin"
  on public.organization_member_permissions
  for select
  using (
    (
      user_id = auth.uid()
      and public.is_org_member(organization_member_permissions.organization_id)
    )
    or public.is_org_admin(organization_member_permissions.organization_id)
  );

-- The latest class policy reintroduced an owner fallback without checking the
-- organization membership. Keep the legacy owner path only while that owner is
-- still an active member of the class organization.
drop policy if exists "classes select trainer" on public.classes;
create policy "classes select trainer"
  on public.classes
  for select
  using (
    public.is_org_admin(classes.organization_id)
    or public.is_class_staff(classes.id)
    or (
      classes.owner_id = auth.uid()
      and public.is_org_member(classes.organization_id)
    )
  );

drop policy if exists "classes update trainer" on public.classes;
create policy "classes update trainer"
  on public.classes
  for update
  using (
    public.is_org_admin(classes.organization_id)
    or public.is_class_head(classes.id)
    or (
      classes.owner_id = auth.uid()
      and public.is_org_member(classes.organization_id)
    )
  )
  with check (
    public.is_org_admin(classes.organization_id)
    or public.is_class_head(classes.id)
    or (
      classes.owner_id = auth.uid()
      and public.is_org_member(classes.organization_id)
    )
  );

-- Removal is transactional: responsibility checks still protect head coaches,
-- then all organization-scoped staff and permission rows are removed before
-- the membership itself. The global trainer identity is intentionally kept,
-- since the same account may belong to another organization.
create or replace function public.admin_remove_org_member(
  p_org_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_current_role int;
  v_other_admin_count int;
  v_has_responsible_classes boolean;
begin
  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Cannot remove yourself';
  end if;

  -- Serialize removals within one organization, then re-check the actor after
  -- any concurrent removal committed while this call was waiting.
  perform 1
  from public.organizations organization
  where organization.id = p_org_id
  for update;

  if not found then
    raise exception 'Organization not found';
  end if;

  if not public.is_org_admin(p_org_id) then
    raise exception 'Not authorized';
  end if;

  select member.role_level
    into v_current_role
  from public.organization_members member
  where member.organization_id = p_org_id
    and member.user_id = p_user_id
  for update;

  if v_current_role is null then
    raise exception 'Member not found';
  end if;

  select exists (
    select 1
    from public.classes class
    where class.organization_id = p_org_id
      and (
        class.owner_id = p_user_id
        or exists (
          select 1
          from public.class_staff staff
          where staff.organization_id = p_org_id
            and staff.class_id = class.id
            and staff.user_id = p_user_id
            and staff.staff_role = 'head'
        )
      )
  )
  into v_has_responsible_classes;

  if coalesce(v_has_responsible_classes, false) then
    raise exception 'Member has responsible classes';
  end if;

  if v_current_role >= 50 then
    select count(*)
      into v_other_admin_count
    from public.organization_members member
    where member.organization_id = p_org_id
      and member.role_level >= 50
      and member.user_id <> p_user_id;

    if coalesce(v_other_admin_count, 0) = 0 then
      raise exception 'Cannot remove last admin';
    end if;
  end if;

  delete from public.class_staff staff
  where staff.organization_id = p_org_id
    and staff.user_id = p_user_id;

  delete from public.organization_member_permissions permission
  where permission.organization_id = p_org_id
    and permission.user_id = p_user_id;

  delete from public.organization_members member
  where member.organization_id = p_org_id
    and member.user_id = p_user_id;
end;
$$;

revoke all on function public.admin_remove_org_member(uuid, uuid)
  from public, anon;
grant execute on function public.admin_remove_org_member(uuid, uuid)
  to authenticated;
