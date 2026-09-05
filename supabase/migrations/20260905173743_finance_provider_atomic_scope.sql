-- Preserve all imported history. Legacy imports have no reliable account or
-- environment provenance, so NULL connection_id quarantines them from totals.
-- Re-syncing the validated current account creates scoped copies; no historical
-- record is deleted or assigned to an account based only on today's credential.
-- Rollout: deploy the new financial Edge handlers before this migration. They
-- reject requests without writing while connection_id is unavailable. Once this
-- migration commits, old handlers must not be restored (see the rollout guide).
create table public.finance_provider_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  provider text not null check (provider = 'asaas'),
  environment text not null check (environment in ('sandbox', 'production')),
  external_account_id text not null check (length(trim(external_account_id)) > 0),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, provider, environment, external_account_id)
);
alter table public.finance_provider_connections enable row level security;
revoke all on public.finance_provider_connections from public, anon, authenticated;
grant all on public.finance_provider_connections to service_role;

do $$
declare v_table text;
begin
  foreach v_table in array array['merchant_accounts', 'payment_provider_credentials',
    'provider_customers', 'provider_receivables', 'provider_subscriptions',
    'provider_events', 'finance_provider_sync_runs'] loop
    execute format('alter table public.%I add column connection_id uuid', v_table);
    execute format('alter table public.%I add constraint %I foreign key (connection_id, organization_id) references public.finance_provider_connections(id, organization_id)', v_table, v_table || '_connection_scope_fkey');
  end loop;
end;
$$;

create or replace function private.assign_finance_provider_connection()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.provider <> 'asaas' then return new; end if;
  if nullif(trim(new.external_account_id), '') is null then
    new.connection_id := null;
    return new;
  end if;
  insert into public.finance_provider_connections (organization_id, provider, environment, external_account_id)
  values (new.organization_id, new.provider, new.environment, trim(new.external_account_id))
  on conflict (organization_id, provider, environment, external_account_id)
  do update set external_account_id = excluded.external_account_id
  returning id into new.connection_id;
  return new;
end;
$$;
revoke all on function private.assign_finance_provider_connection() from public, anon, authenticated;
create trigger assign_finance_provider_connection
before insert or update of external_account_id, environment on public.merchant_accounts
for each row execute function private.assign_finance_provider_connection();

create or replace function private.assign_finance_provider_credential_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select merchant.connection_id into new.connection_id
  from public.merchant_accounts merchant
  where merchant.organization_id = new.organization_id and merchant.provider = new.provider
    and merchant.environment = new.environment;
  if new.connection_id is null then raise exception 'ASAAS_ACCOUNT_SCOPE_MISMATCH'; end if;
  return new;
end;
$$;
revoke all on function private.assign_finance_provider_credential_scope() from public, anon, authenticated;
create trigger assign_finance_provider_credential_scope
before insert or update on public.payment_provider_credentials
for each row execute function private.assign_finance_provider_credential_scope();

-- Merchant identity is known; imported row identity is deliberately not inferred.
update public.merchant_accounts set external_account_id = external_account_id
where provider = 'asaas' and external_account_id is not null;
update public.payment_provider_credentials set environment = environment where provider = 'asaas';

-- Reject stale handlers before they create new ambiguous imports or acknowledge
-- events outside the scoped transaction. Existing quarantine rows stay intact.
create or replace function private.require_asaas_import_connection()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.provider = 'asaas' and new.connection_id is null then
    -- Account deletion may detach the author of a historical sync run. This
    -- narrow FK cleanup does not change its financial data or provenance.
    if tg_op = 'UPDATE' and tg_table_name = 'finance_provider_sync_runs'
      and (to_jsonb(old)->>'started_by') is not null
      and (to_jsonb(new)->>'started_by') is null
      and (to_jsonb(new) - 'started_by') = (to_jsonb(old) - 'started_by') then
      return new;
    end if;
    raise exception 'ASAAS_CONNECTION_SCOPE_REQUIRED' using errcode = '23514';
  end if;
  -- The existing composite FK (connection_id, organization_id) also rejects a
  -- non-null connection belonging to another organization.
  return new;
end;
$$;
revoke all on function private.require_asaas_import_connection() from public, anon, authenticated;
do $$
declare v_table text;
begin
  foreach v_table in array array['provider_customers', 'provider_receivables',
    'provider_subscriptions', 'provider_events', 'finance_provider_sync_runs'] loop
    execute format('create trigger require_asaas_import_connection before insert or update on public.%I for each row execute function private.require_asaas_import_connection()', v_table);
  end loop;
end;
$$;

-- Replace uniqueness keys, not data. NULL legacy namespaces remain quarantined.
alter table public.provider_customers drop constraint provider_customers_external_unique;
alter table public.provider_customers add constraint provider_customers_scoped_external_unique unique (connection_id, external_customer_id);
alter table public.provider_receivables drop constraint provider_receivables_external_unique;
alter table public.provider_receivables add constraint provider_receivables_scoped_external_unique unique (connection_id, external_payment_id);
alter table public.provider_subscriptions drop constraint provider_subscriptions_external_unique;
alter table public.provider_subscriptions add constraint provider_subscriptions_scoped_external_unique unique (connection_id, external_subscription_id);
alter table public.provider_events drop constraint provider_events_external_unique;
alter table public.provider_events add constraint provider_events_scoped_external_unique unique (connection_id, external_event_id);
-- Preserve the foundation's deduplication for any non-Asaas event providers.
create unique index provider_events_other_provider_external_unique
  on public.provider_events (provider, external_event_id) where provider <> 'asaas';
create index provider_receivables_connection_month_idx on public.provider_receivables
  (connection_id, (coalesce(paid_at at time zone 'UTC', due_date::timestamp, imported_at at time zone 'UTC')) desc, id);

-- One database transaction owns deduplication, projection, and completion.
-- Any error rolls back the event insertion as well, making a retry safe.
create or replace function public.process_asaas_event_v2(
  p_org_id uuid, p_connection_id uuid, p_event_id text, p_event_type text,
  p_payload_hash text, p_occurred_at timestamptz, p_payment jsonb default null,
  p_subscription jsonb default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_event public.provider_events%rowtype;
  v_payment public.provider_receivables%rowtype;
  v_subscription public.provider_subscriptions%rowtype;
  v_status text := 'ignored';
begin
  if not exists (select 1 from public.payment_provider_credentials c
    where c.organization_id = p_org_id and c.connection_id = p_connection_id and c.provider = 'asaas') then
    raise exception 'ASAAS_ACCOUNT_SCOPE_MISMATCH';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_connection_id::text || ':' || p_event_id, 0));
  select * into v_event from public.provider_events
  where connection_id = p_connection_id and external_event_id = p_event_id for update;
  if found then
    if v_event.payload_hash <> p_payload_hash then raise exception 'PROVIDER_EVENT_PAYLOAD_MISMATCH'; end if;
    if v_event.processing_status in ('processed', 'ignored') then
      return jsonb_build_object('duplicate', true);
    end if;
  else
    insert into public.provider_events (organization_id, provider, connection_id, external_event_id,
      event_type, payload_hash, occurred_at, processing_status)
    values (p_org_id, 'asaas', p_connection_id, p_event_id, p_event_type, p_payload_hash, p_occurred_at, 'received')
    returning * into v_event;
  end if;
  if p_payment is not null then
    v_payment := jsonb_populate_record(null::public.provider_receivables, p_payment);
    insert into public.provider_receivables (organization_id, provider, connection_id, external_payment_id,
      external_customer_id, external_subscription_id, external_reference, provider_status, billing_type,
      amount_cents, net_amount_cents, due_date, paid_at, invoice_id, match_status)
    values (p_org_id, 'asaas', p_connection_id, v_payment.external_payment_id, v_payment.external_customer_id,
      v_payment.external_subscription_id, v_payment.external_reference, v_payment.provider_status,
      v_payment.billing_type, v_payment.amount_cents, v_payment.net_amount_cents, v_payment.due_date,
      v_payment.paid_at, v_payment.invoice_id, v_payment.match_status)
    on conflict (connection_id, external_payment_id) do update set
      external_customer_id = excluded.external_customer_id, external_subscription_id = excluded.external_subscription_id,
      external_reference = excluded.external_reference, provider_status = excluded.provider_status,
      billing_type = excluded.billing_type, amount_cents = excluded.amount_cents,
      net_amount_cents = excluded.net_amount_cents, due_date = excluded.due_date, paid_at = excluded.paid_at,
      invoice_id = excluded.invoice_id, match_status = excluded.match_status, imported_at = now();
    v_status := 'processed';
  elsif p_subscription is not null then
    v_subscription := jsonb_populate_record(null::public.provider_subscriptions, p_subscription);
    insert into public.provider_subscriptions (organization_id, provider, connection_id, external_subscription_id,
      external_customer_id, external_reference, provider_status, billing_type, billing_cycle, amount_cents,
      next_due_date, match_status)
    values (p_org_id, 'asaas', p_connection_id, v_subscription.external_subscription_id, v_subscription.external_customer_id,
      v_subscription.external_reference, v_subscription.provider_status, v_subscription.billing_type,
      v_subscription.billing_cycle, v_subscription.amount_cents, v_subscription.next_due_date, v_subscription.match_status)
    on conflict (connection_id, external_subscription_id) do update set
      external_customer_id = excluded.external_customer_id, external_reference = excluded.external_reference,
      provider_status = excluded.provider_status, billing_type = excluded.billing_type,
      billing_cycle = excluded.billing_cycle, amount_cents = excluded.amount_cents,
      next_due_date = excluded.next_due_date, match_status = excluded.match_status, imported_at = now();
    v_status := 'processed';
  end if;
  update public.provider_events set processing_status = v_status, processed_at = now(), processing_error_code = null
  where id = v_event.id;
  return jsonb_build_object('duplicate', false);
end;
$$;
revoke all on function public.process_asaas_event_v2(uuid,uuid,text,text,text,timestamptz,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.process_asaas_event_v2(uuid,uuid,text,text,text,timestamptz,jsonb,jsonb) to service_role;

create or replace function private.get_organization_provider_receivables_v2(
  p_org_id uuid, p_month date, p_limit integer default 250, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' set row_security = off as $$
declare
  v_connection_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not public.has_org_member_permission(p_org_id, 'financial') then raise exception 'NOT_AUTHORIZED'; end if;
  if p_month is null then raise exception 'MONTH_REQUIRED'; end if;
  select connection_id into v_connection_id from public.merchant_accounts where organization_id = p_org_id and provider = 'asaas';
  with scoped as materialized (
    select r.*, coalesce((r.paid_at at time zone 'UTC')::date, r.due_date, (r.imported_at at time zone 'UTC')::date) as effective_date
    from public.provider_receivables r where r.organization_id = p_org_id and r.connection_id = v_connection_id
  ), monthly as materialized (
    select * from scoped where effective_date >= date_trunc('month', p_month)::date
      and effective_date < (date_trunc('month', p_month) + interval '1 month')::date
  ), page as (
    select r.* from monthly r order by effective_date desc, id
    limit least(greatest(coalesce(p_limit,250),1),500) offset greatest(coalesce(p_offset,0),0)
  )
  select jsonb_build_object(
    'connection_id', v_connection_id,
    'summary', (select jsonb_build_object(
      'total_count', count(*),
      'received_count', count(*) filter(where upper(provider_status) in ('RECEIVED','RECEIVED_IN_CASH','DUNNING_RECEIVED')),
      'received_gross_cents', coalesce(sum(amount_cents) filter(where upper(provider_status) in ('RECEIVED','RECEIVED_IN_CASH','DUNNING_RECEIVED')),0),
      'received_net_cents', coalesce(sum(coalesce(net_amount_cents,amount_cents)) filter(where upper(provider_status) in ('RECEIVED','RECEIVED_IN_CASH','DUNNING_RECEIVED')),0),
      'identified_customer_count', count(distinct external_customer_id) filter(where match_status = 'matched'),
      'reconciliation_count', count(*) filter(where match_status <> 'matched')
    ) from monthly),
    'months', (select coalesce(jsonb_agg(month_key order by month_key desc),'[]'::jsonb) from
      (select distinct to_char(effective_date,'YYYY-MM') as month_key from scoped) m),
    'quarantined_count', (select count(*) from public.provider_receivables where organization_id = p_org_id and provider = 'asaas' and connection_id is null),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
      'receivable_id',p.id,'customer_name',coalesce(nullif(trim(c.display_name),''),'Cliente Asaas'),
      'provider_status',upper(p.provider_status),'billing_type',upper(p.billing_type),
      'amount_cents',p.amount_cents,'net_amount_cents',coalesce(p.net_amount_cents,p.amount_cents),
      'due_date',p.due_date,'paid_at',p.paid_at,'match_status',p.match_status,'invoice_id',p.invoice_id,
      'imported_at',p.imported_at) order by p.effective_date desc,p.id),'[]'::jsonb)
      from page p left join public.provider_customers c on c.connection_id = p.connection_id and c.external_customer_id = p.external_customer_id)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function private.get_organization_provider_receivables_v2(uuid,date,integer,integer) from public, anon;
grant execute on function private.get_organization_provider_receivables_v2(uuid,date,integer,integer) to authenticated;
create or replace function public.get_organization_provider_receivables_v2(
  p_org_id uuid, p_month date, p_limit integer default 250, p_offset integer default 0
) returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.get_organization_provider_receivables_v2(p_org_id,p_month,p_limit,p_offset);
$$;
revoke all on function public.get_organization_provider_receivables_v2(uuid,date,integer,integer) from public, anon;
grant execute on function public.get_organization_provider_receivables_v2(uuid,date,integer,integer) to authenticated;

-- Older clients also see only the current account, through the same projection.
create or replace function public.list_organization_provider_receivables_v1(p_org_id uuid,p_month date,p_limit integer default 250)
returns table(receivable_id uuid,customer_name text,provider_status text,billing_type text,amount_cents bigint,
  net_amount_cents bigint,due_date date,paid_at timestamptz,match_status text,invoice_id uuid,imported_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select * from jsonb_to_recordset(public.get_organization_provider_receivables_v2(p_org_id,p_month,p_limit,0)->'items')
  as x(receivable_id uuid,customer_name text,provider_status text,billing_type text,amount_cents bigint,
    net_amount_cents bigint,due_date date,paid_at timestamptz,match_status text,invoice_id uuid,imported_at timestamptz);
$$;
