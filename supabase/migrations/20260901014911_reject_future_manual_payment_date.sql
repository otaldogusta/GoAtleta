-- Manual receipts represent money that has already been received. Keep the
-- invariant in the RPC so alternate clients cannot bypass the UI validation.
create or replace function public.record_manual_payment_v1(
  p_org_id uuid,
  p_invoice_id uuid,
  p_amount_cents bigint,
  p_method text,
  p_idempotency_key text,
  p_paid_at timestamptz default now(),
  p_notes text default null
)
returns table (
  payment_id uuid,
  invoice_status text,
  paid_cents bigint
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_actor uuid := auth.uid();
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_method text := lower(trim(coalesce(p_method, '')));
  v_invoice public.invoices%rowtype;
  v_existing public.payments%rowtype;
  v_payment_id uuid;
  v_new_paid bigint;
  v_new_status text;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_org_member_permission(p_org_id, 'financial') then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'AMOUNT_INVALID';
  end if;
  if v_method not in ('pix', 'boleto', 'card', 'cash', 'bank_transfer', 'other') then
    raise exception 'PAYMENT_METHOD_INVALID';
  end if;
  if p_paid_at is null then
    raise exception 'PAID_AT_REQUIRED';
  end if;
  if (p_paid_at at time zone 'America/Sao_Paulo')::date
    > (clock_timestamp() at time zone 'America/Sao_Paulo')::date then
    raise exception 'PAYMENT_DATE_IN_FUTURE';
  end if;
  if v_key is null or char_length(v_key) > 160 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('manual_payment:' || p_org_id::text || ':' || v_key, 0));

  select payment.*
    into v_existing
  from public.payments payment
  where payment.organization_id = p_org_id
    and payment.idempotency_key = v_key
  for update;

  if found then
    if v_existing.invoice_id is distinct from p_invoice_id
      or v_existing.amount_cents is distinct from p_amount_cents
      or v_existing.method is distinct from v_method
      or v_existing.notes is distinct from nullif(trim(p_notes), '') then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;

    select invoice.*
      into v_invoice
    from public.invoices invoice
    where invoice.id = p_invoice_id
      and invoice.organization_id = p_org_id;

    return query select v_existing.id, v_invoice.status, v_invoice.paid_cents;
    return;
  end if;

  select invoice.*
    into v_invoice
  from public.invoices invoice
  where invoice.id = p_invoice_id
    and invoice.organization_id = p_org_id
  for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;
  if v_invoice.status not in ('open', 'pending', 'overdue') then
    raise exception 'INVOICE_NOT_PAYABLE';
  end if;
  if p_amount_cents > v_invoice.amount_cents - v_invoice.paid_cents then
    raise exception 'PAYMENT_EXCEEDS_BALANCE';
  end if;

  v_new_paid := v_invoice.paid_cents + p_amount_cents;
  v_new_status := case
    when v_new_paid = v_invoice.amount_cents then 'paid'
    when v_invoice.due_date < current_date then 'overdue'
    else 'open'
  end;

  insert into public.payments (
    organization_id,
    invoice_id,
    amount_cents,
    method,
    status,
    idempotency_key,
    paid_at,
    recorded_by,
    notes
  ) values (
    p_org_id,
    p_invoice_id,
    p_amount_cents,
    v_method,
    'confirmed',
    v_key,
    p_paid_at,
    v_actor,
    nullif(trim(p_notes), '')
  ) returning id into v_payment_id;

  update public.invoices invoice
  set
    paid_cents = v_new_paid,
    status = v_new_status,
    paid_at = case when v_new_status = 'paid' then p_paid_at else null end
  where invoice.id = p_invoice_id
    and invoice.organization_id = p_org_id;

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
    p_org_id,
    'payment',
    v_payment_id,
    'manual_payment_recorded',
    v_actor,
    v_key,
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'invoice_status', v_invoice.status,
      'paid_cents', v_invoice.paid_cents
    ),
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'invoice_status', v_new_status,
      'paid_cents', v_new_paid,
      'amount_cents', p_amount_cents,
      'method', v_method,
      'currency', 'BRL'
    )
  );

  return query select v_payment_id, v_new_status, v_new_paid;
end;
$$;

revoke all on function public.record_manual_payment_v1(
  uuid, uuid, bigint, text, text, timestamptz, text
) from public, anon;
grant execute on function public.record_manual_payment_v1(
  uuid, uuid, bigint, text, text, timestamptz, text
) to authenticated;
