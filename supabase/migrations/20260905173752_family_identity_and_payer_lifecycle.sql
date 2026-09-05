-- Enforce identity and payer lifecycle at the data boundary, shared by invite
-- claims, editing RPCs, and revocation. No relationship or history is deleted.
create or replace function private.guard_student_relationship_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.relationship_kind = 'athlete' and (
    -- auth.users deletion uses ON DELETE SET NULL to preserve relationship and
    -- finance history. That detachment is not a reassignment to another account.
    (new.user_id is not null and old.user_id is distinct from new.user_id) or old.student_id is distinct from new.student_id
    or old.organization_id is distinct from new.organization_id
  ) then raise exception 'ATHLETE_RELATIONSHIP_IMMUTABLE'; end if;
  if tg_op = 'UPDATE' and old.relationship_kind is distinct from new.relationship_kind
    and (old.relationship_kind = 'athlete' or new.relationship_kind = 'athlete') then
    raise exception 'ATHLETE_RELATIONSHIP_IMMUTABLE';
  end if;
  if new.status = 'active' and new.relationship_kind <> 'athlete' and (
    tg_op = 'INSERT' or old.user_id is distinct from new.user_id or old.status <> 'active'
  ) and exists (select 1 from public.students s where s.id = new.student_id
    and s.organization_id = new.organization_id and s.student_user_id = new.user_id) then
    raise exception 'ATHLETE_RELATIONSHIP_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_student_relationship_identity() from public, anon, authenticated;
create trigger guard_student_relationship_identity before insert or update on public.student_relationships
for each row execute function private.guard_student_relationship_identity();

create or replace function private.guard_student_relationship_invite_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.relationship_kind <> 'athlete' and exists (
    select 1 from public.students s join auth.users u on u.id = s.student_user_id
    where s.id = new.student_id and s.organization_id = new.organization_id
      and lower(trim(u.email)) = lower(trim(new.invited_email))
    union all
    select 1 from public.student_relationships r
    where r.student_id = new.student_id and r.organization_id = new.organization_id
      and r.status = 'active' and r.relationship_kind = 'athlete'
      and lower(trim(r.contact_email)) = lower(trim(new.invited_email))
  ) then raise exception 'ATHLETE_RELATIONSHIP_IMMUTABLE'; end if;
  return new;
end;
$$;
revoke all on function private.guard_student_relationship_invite_identity() from public, anon, authenticated;
create trigger guard_student_relationship_invite_identity before insert on public.student_relationship_invites
for each row execute function private.guard_student_relationship_invite_identity();

create or replace function private.sync_tuition_payer_eligibility(p_relationship_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_relationship public.student_relationships%rowtype;
begin
  select * into v_relationship from public.student_relationships where id = p_relationship_id for update;
  if not found or (v_relationship.status = 'active' and v_relationship.can_pay) then return; end if;
  with paused as (
    update public.tuition_agreements set status = 'paused', updated_at = now()
    where organization_id = v_relationship.organization_id and payer_relationship_id = v_relationship.id and status = 'active'
    returning id, organization_id
  )
  insert into public.finance_audit_events (organization_id,entity_type,entity_id,action,actor_user_id,before_state,after_state)
  select p.organization_id,'agreement',p.id,'paused_payer_ineligible',auth.uid(),
    jsonb_build_object('status','active','payer_relationship_id',v_relationship.id),
    jsonb_build_object('status','paused','payer_relationship_id',v_relationship.id,
      'relationship_status',v_relationship.status,'can_pay',v_relationship.can_pay)
  from paused p;
end;
$$;
revoke all on function private.sync_tuition_payer_eligibility(uuid) from public, anon, authenticated;

create or replace function private.sync_student_relationship_lifecycle()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.sync_tuition_payer_eligibility(new.id);
  return new;
end;
$$;
revoke all on function private.sync_student_relationship_lifecycle() from public, anon, authenticated;
create trigger sync_student_relationship_lifecycle after update of status, can_pay on public.student_relationships
for each row execute function private.sync_student_relationship_lifecycle();

-- Repair active agreement state only where its existing payer is ineligible.
select private.sync_tuition_payer_eligibility(r.id) from public.student_relationships r
where (r.status <> 'active' or not r.can_pay) and exists (
  select 1 from public.tuition_agreements a where a.payer_relationship_id = r.id and a.status = 'active');

-- Revocation delegates pausing to the same lifecycle trigger as edits/claims.
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
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_relationship public.student_relationships%rowtype;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if v_reason is null then
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
    revocation_reason = left(v_reason, 240)
  where relationship.id = p_relationship_id;

  if v_relationship.relationship_kind = 'athlete' or exists (
    select 1 from public.students s where s.id = v_relationship.student_id
      and s.organization_id = v_relationship.organization_id and s.student_user_id = v_relationship.user_id
  ) then
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
