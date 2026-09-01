-- Keep tuition agreements and relationship access in the same lifecycle.
-- Existing invoices remain available to staff as financial history, while a
-- revoked payer can no longer receive newly issued tuition invoices.

with paused_agreements as (
  update public.tuition_agreements agreement
  set
    status = 'paused',
    updated_at = now()
  from public.student_relationships relationship
  where relationship.id = agreement.payer_relationship_id
    and relationship.organization_id = agreement.organization_id
    and agreement.status = 'active'
    and (
      relationship.status <> 'active'
      or not relationship.can_pay
    )
  returning
    agreement.id,
    agreement.organization_id,
    agreement.student_id,
    agreement.plan_id,
    agreement.payer_relationship_id,
    agreement.amount_cents,
    agreement.billing_day,
    agreement.starts_on,
    agreement.ends_on
)
insert into public.finance_audit_events (
  organization_id,
  entity_type,
  entity_id,
  action,
  idempotency_key,
  before_state,
  after_state
)
select
  paused.organization_id,
  'agreement',
  paused.id,
  'paused_ineligible_payer_backfill',
  'migration:20260901000346:' || paused.id::text,
  jsonb_build_object(
    'status', 'active',
    'payer_relationship_id', paused.payer_relationship_id
  ),
  jsonb_build_object(
    'status', 'paused',
    'reason', 'payer_relationship_ineligible',
    'student_id', paused.student_id,
    'plan_id', paused.plan_id,
    'payer_relationship_id', paused.payer_relationship_id,
    'amount_cents', paused.amount_cents,
    'billing_day', paused.billing_day,
    'starts_on', paused.starts_on,
    'ends_on', paused.ends_on
  )
from paused_agreements paused;

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
  v_agreement record;
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

  for v_agreement in
    update public.tuition_agreements agreement
    set
      status = 'paused',
      updated_at = now()
    where agreement.organization_id = v_relationship.organization_id
      and agreement.payer_relationship_id = v_relationship.id
      and agreement.status = 'active'
    returning
      agreement.id,
      agreement.organization_id,
      agreement.student_id,
      agreement.plan_id,
      agreement.payer_relationship_id,
      agreement.amount_cents,
      agreement.billing_day,
      agreement.starts_on,
      agreement.ends_on
  loop
    insert into public.finance_audit_events (
      organization_id,
      entity_type,
      entity_id,
      action,
      actor_user_id,
      idempotency_key,
      before_state,
      after_state
    ) values (
      v_agreement.organization_id,
      'agreement',
      v_agreement.id,
      'paused_payer_relationship_revoked',
      v_actor,
      'relationship-revocation:' || v_relationship.id::text || ':' || v_agreement.id::text,
      jsonb_build_object(
        'status', 'active',
        'payer_relationship_id', v_relationship.id
      ),
      jsonb_build_object(
        'status', 'paused',
        'reason', 'payer_relationship_revoked',
        'revocation_reason', v_reason,
        'student_id', v_agreement.student_id,
        'plan_id', v_agreement.plan_id,
        'payer_relationship_id', v_relationship.id,
        'amount_cents', v_agreement.amount_cents,
        'billing_day', v_agreement.billing_day,
        'starts_on', v_agreement.starts_on,
        'ends_on', v_agreement.ends_on
      )
    );
  end loop;

  update public.student_relationships relationship
  set
    status = 'revoked',
    revoked_at = now(),
    revoked_by = v_actor,
    revocation_reason = left(v_reason, 240)
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

create or replace function public.issue_tuition_invoice_v1(
  p_org_id uuid,
  p_agreement_id uuid,
  p_competence_month date,
  p_due_date date,
  p_idempotency_key text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor uuid := auth.uid();
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_competence date := date_trunc('month', p_competence_month)::date;
  v_agreement public.tuition_agreements%rowtype;
  v_payer_relationship public.student_relationships%rowtype;
  v_existing public.invoices%rowtype;
  v_invoice_id uuid;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_org_member_permission(p_org_id, 'financial') then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if p_competence_month is null or p_due_date is null then
    raise exception 'INVOICE_DATES_REQUIRED';
  end if;
  if v_key is null or char_length(v_key) > 160 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tuition_invoice:' || p_org_id::text || ':' || v_key, 0));

  select invoice.*
    into v_existing
  from public.invoices invoice
  where invoice.organization_id = p_org_id
    and invoice.idempotency_key = v_key
  for update;

  if found then
    if v_existing.agreement_id is distinct from p_agreement_id
      or v_existing.competence_month is distinct from v_competence
      or v_existing.due_date is distinct from p_due_date
      or v_existing.description is distinct from nullif(trim(p_description), '') then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_existing.id;
  end if;

  select agreement.*
    into v_agreement
  from public.tuition_agreements agreement
  where agreement.id = p_agreement_id
    and agreement.organization_id = p_org_id
    and agreement.status = 'active';
  if not found then
    raise exception 'ACTIVE_AGREEMENT_NOT_FOUND';
  end if;

  select relationship.*
    into v_payer_relationship
  from public.student_relationships relationship
  where relationship.id = v_agreement.payer_relationship_id
    and relationship.organization_id = p_org_id
    and relationship.student_id = v_agreement.student_id
    and relationship.status = 'active'
    and relationship.can_pay
  for update;
  if not found then
    raise exception 'PAYER_RELATIONSHIP_INVALID';
  end if;

  select agreement.*
    into v_agreement
  from public.tuition_agreements agreement
  where agreement.id = p_agreement_id
    and agreement.organization_id = p_org_id
    and agreement.status = 'active'
    and agreement.payer_relationship_id = v_payer_relationship.id
    and agreement.student_id = v_payer_relationship.student_id
  for update;
  if not found then
    raise exception 'ACTIVE_AGREEMENT_NOT_FOUND';
  end if;

  if v_competence < date_trunc('month', v_agreement.starts_on)::date
    or (
      v_agreement.ends_on is not null
      and v_competence > date_trunc('month', v_agreement.ends_on)::date
    ) then
    raise exception 'COMPETENCE_OUTSIDE_AGREEMENT';
  end if;

  insert into public.invoices (
    organization_id,
    agreement_id,
    student_id,
    payer_relationship_id,
    competence_month,
    due_date,
    amount_cents,
    description,
    idempotency_key,
    created_by
  ) values (
    p_org_id,
    v_agreement.id,
    v_agreement.student_id,
    v_agreement.payer_relationship_id,
    v_competence,
    p_due_date,
    v_agreement.amount_cents,
    nullif(trim(p_description), ''),
    v_key,
    v_actor
  ) returning id into v_invoice_id;

  insert into public.finance_audit_events (
    organization_id,
    entity_type,
    entity_id,
    action,
    actor_user_id,
    idempotency_key,
    after_state
  ) values (
    p_org_id,
    'invoice',
    v_invoice_id,
    'issued',
    v_actor,
    v_key,
    jsonb_build_object(
      'agreement_id', v_agreement.id,
      'student_id', v_agreement.student_id,
      'payer_relationship_id', v_agreement.payer_relationship_id,
      'competence_month', v_competence,
      'due_date', p_due_date,
      'amount_cents', v_agreement.amount_cents,
      'currency', 'BRL',
      'status', 'open'
    )
  );

  return v_invoice_id;
end;
$$;

revoke all on function public.issue_tuition_invoice_v1(
  uuid, uuid, date, date, text, text
) from public, anon;
grant execute on function public.issue_tuition_invoice_v1(
  uuid, uuid, date, date, text, text
) to authenticated;

comment on function public.revoke_student_relationship_v1(uuid, text, boolean) is
  'Revokes a family relationship and atomically pauses active tuition agreements tied to that payer.';
comment on function public.issue_tuition_invoice_v1(uuid, uuid, date, date, text, text) is
  'Issues an idempotent tuition invoice only while the agreement and payer relationship remain active and payable.';
