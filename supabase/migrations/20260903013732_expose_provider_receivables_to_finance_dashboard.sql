create or replace function public.list_organization_provider_receivables_v1(
  p_org_id uuid,
  p_month date,
  p_limit integer default 250
)
returns table (
  receivable_id uuid,
  customer_name text,
  provider_status text,
  billing_type text,
  amount_cents bigint,
  net_amount_cents bigint,
  due_date date,
  paid_at timestamptz,
  match_status text,
  invoice_id uuid,
  imported_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_limit integer := least(greatest(coalesce(p_limit, 250), 1), 500);
begin
  if (select auth.uid()) is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_org_member_permission(p_org_id, 'financial') then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if p_month is null then
    raise exception 'MONTH_REQUIRED';
  end if;

  return query
  select
    receivable.id,
    coalesce(nullif(trim(customer.display_name), ''), 'Cliente Asaas'),
    upper(receivable.provider_status),
    upper(receivable.billing_type),
    receivable.amount_cents,
    coalesce(receivable.net_amount_cents, receivable.amount_cents),
    receivable.due_date,
    receivable.paid_at,
    receivable.match_status,
    receivable.invoice_id,
    receivable.imported_at
  from public.provider_receivables receivable
  left join public.provider_customers customer
    on customer.organization_id = receivable.organization_id
   and customer.provider = receivable.provider
   and customer.external_customer_id = receivable.external_customer_id
  where receivable.organization_id = p_org_id
    and receivable.provider = 'asaas'
    and coalesce(
      receivable.paid_at::date,
      receivable.due_date,
      receivable.imported_at::date
    ) >= v_month_start
    and coalesce(
      receivable.paid_at::date,
      receivable.due_date,
      receivable.imported_at::date
    ) < v_month_end
  order by
    coalesce(
      receivable.paid_at::date,
      receivable.due_date,
      receivable.imported_at::date
    ) desc,
    receivable.imported_at desc,
    receivable.id
  limit v_limit;
end;
$$;

revoke all on function public.list_organization_provider_receivables_v1(
  uuid,
  date,
  integer
) from public, anon;
grant execute on function public.list_organization_provider_receivables_v1(
  uuid,
  date,
  integer
) to authenticated;

comment on function public.list_organization_provider_receivables_v1(
  uuid,
  date,
  integer
) is
  'Returns a sanitized, organization-scoped monthly projection of imported provider receivables for authorized finance members.';
