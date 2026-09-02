create or replace function public.get_organization_finance_dashboard_v1(
  p_org_id uuid
)
returns table (
  organization_id uuid,
  expected_cents bigint,
  received_cents bigint,
  overdue_cents bigint,
  open_cents bigint,
  overdue_count bigint,
  open_count bigint,
  paid_count bigint,
  active_agreements_count bigint
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
  if not public.has_org_member_permission(p_org_id, 'financial') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  return query
  with invoice_totals as (
    select
      coalesce(sum(invoice.amount_cents) filter (
        where invoice.status not in ('draft', 'void', 'refunded')
      ), 0)::bigint as expected_cents,
      coalesce(sum(invoice.paid_cents) filter (
        where invoice.status not in ('draft', 'void', 'refunded')
      ), 0)::bigint as received_cents,
      coalesce(sum(invoice.amount_cents - invoice.paid_cents) filter (
        where invoice.status = 'overdue'
           or (invoice.status in ('open', 'pending') and invoice.due_date < current_date)
      ), 0)::bigint as overdue_cents,
      coalesce(sum(invoice.amount_cents - invoice.paid_cents) filter (
        where invoice.status in ('open', 'pending')
          and invoice.due_date >= current_date
      ), 0)::bigint as open_cents,
      count(*) filter (
        where invoice.status = 'overdue'
           or (invoice.status in ('open', 'pending') and invoice.due_date < current_date)
      )::bigint as overdue_count,
      count(*) filter (
        where invoice.status in ('open', 'pending')
          and invoice.due_date >= current_date
      )::bigint as open_count,
      count(*) filter (where invoice.status = 'paid')::bigint as paid_count
    from public.invoices invoice
    where invoice.organization_id = p_org_id
  ), agreement_totals as (
    select count(*)::bigint as active_agreements_count
    from public.tuition_agreements agreement
    where agreement.organization_id = p_org_id
      and agreement.status = 'active'
  )
  select
    p_org_id,
    invoice_totals.expected_cents,
    invoice_totals.received_cents,
    invoice_totals.overdue_cents,
    invoice_totals.open_cents,
    invoice_totals.overdue_count,
    invoice_totals.open_count,
    invoice_totals.paid_count,
    agreement_totals.active_agreements_count
  from invoice_totals
  cross join agreement_totals;
end;
$$;

revoke all on function public.get_organization_finance_dashboard_v1(uuid)
  from public, anon;
grant execute on function public.get_organization_finance_dashboard_v1(uuid)
  to authenticated;
