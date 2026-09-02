-- Asaas receivables connector foundation.
--
-- The connector starts in read-only mode. Existing Asaas customers, charges
-- and subscriptions are mirrored for reconciliation, while money-moving
-- operations remain blocked by merchant_accounts.charges_enabled = false.
-- API keys are encrypted by an Edge Function before they reach this schema.

alter table public.merchant_accounts
  add column if not exists environment text not null default 'sandbox'
    check (environment in ('sandbox', 'production')),
  add column if not exists connection_mode text not null default 'read_only'
    check (connection_mode in ('read_only', 'active')),
  add column if not exists key_hint text
    check (key_hint is null or char_length(key_hint) between 4 and 24),
  add column if not exists account_status text
    check (account_status is null or char_length(account_status) <= 40),
  add column if not exists webhook_id text
    check (webhook_id is null or char_length(webhook_id) <= 160),
  add column if not exists webhook_status text not null default 'not_configured'
    check (webhook_status in ('not_configured', 'configured', 'error')),
  add column if not exists last_verified_at timestamptz,
  add column if not exists last_sync_at timestamptz,
  add column if not exists sync_error_code text
    check (sync_error_code is null or char_length(sync_error_code) <= 120),
  add column if not exists connected_by uuid references auth.users(id) on delete set null;

create table if not exists public.payment_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider = 'asaas'),
  environment text not null check (environment in ('sandbox', 'production')),
  secret_ciphertext text not null check (char_length(secret_ciphertext) between 24 and 4096),
  secret_iv text not null check (char_length(secret_iv) between 16 and 128),
  secret_fingerprint text not null check (secret_fingerprint ~ '^[0-9a-f]{64}$'),
  key_hint text not null check (char_length(key_hint) between 4 and 24),
  webhook_token_hash text
    check (webhook_token_hash is null or webhook_token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users(id) on delete set null,
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_provider_credentials_org_provider_unique
    unique (organization_id, provider)
);

create unique index if not exists payment_provider_credentials_fingerprint_unique
  on public.payment_provider_credentials (provider, secret_fingerprint);

create unique index if not exists payment_provider_credentials_webhook_token_unique
  on public.payment_provider_credentials (provider, webhook_token_hash)
  where webhook_token_hash is not null;

create table if not exists public.provider_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider = 'asaas'),
  external_customer_id text not null check (char_length(external_customer_id) between 3 and 160),
  external_reference text
    check (external_reference is null or char_length(external_reference) <= 255),
  display_name text not null check (char_length(display_name) between 1 and 200),
  email_masked text check (email_masked is null or char_length(email_masked) <= 254),
  document_last4 text check (document_last4 is null or document_last4 ~ '^[0-9]{4}$'),
  match_status text not null default 'unmatched'
    check (match_status in ('matched', 'ambiguous', 'unmatched')),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_customers_id_workspace_unique unique (id, organization_id),
  constraint provider_customers_external_unique
    unique (organization_id, provider, external_customer_id)
);

create index if not exists provider_customers_org_match_idx
  on public.provider_customers (organization_id, provider, match_status, display_name);

create table if not exists public.provider_customer_relationship_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_customer_id uuid not null,
  payer_relationship_id uuid not null,
  match_basis text not null check (match_basis in ('exact_email', 'manual')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint provider_customer_links_customer_workspace_fkey
    foreign key (provider_customer_id, organization_id)
    references public.provider_customers(id, organization_id)
    on delete cascade,
  constraint provider_customer_links_relationship_workspace_fkey
    foreign key (payer_relationship_id, organization_id)
    references public.student_relationships(id, organization_id)
    on delete cascade,
  constraint provider_customer_links_unique
    unique (provider_customer_id, payer_relationship_id)
);

create index if not exists provider_customer_links_relationship_idx
  on public.provider_customer_relationship_links
    (organization_id, payer_relationship_id, provider_customer_id);

create table if not exists public.provider_receivables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider = 'asaas'),
  external_payment_id text not null check (char_length(external_payment_id) between 3 and 160),
  external_customer_id text not null check (char_length(external_customer_id) between 3 and 160),
  external_subscription_id text
    check (external_subscription_id is null or char_length(external_subscription_id) <= 160),
  external_reference text
    check (external_reference is null or char_length(external_reference) <= 255),
  provider_status text not null check (char_length(provider_status) between 2 and 80),
  billing_type text not null check (char_length(billing_type) between 2 and 40),
  amount_cents bigint not null check (amount_cents >= 0),
  net_amount_cents bigint check (net_amount_cents is null or net_amount_cents >= 0),
  due_date date,
  paid_at timestamptz,
  invoice_id uuid,
  match_status text not null default 'unmatched'
    check (match_status in ('matched', 'ambiguous', 'unmatched')),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_receivables_invoice_workspace_fkey
    foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id)
    on delete restrict,
  constraint provider_receivables_external_unique
    unique (organization_id, provider, external_payment_id)
);

create index if not exists provider_receivables_org_status_due_idx
  on public.provider_receivables
    (organization_id, provider, provider_status, due_date desc);

create index if not exists provider_receivables_customer_idx
  on public.provider_receivables
    (organization_id, provider, external_customer_id, due_date desc);

create table if not exists public.provider_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider = 'asaas'),
  external_subscription_id text not null
    check (char_length(external_subscription_id) between 3 and 160),
  external_customer_id text not null check (char_length(external_customer_id) between 3 and 160),
  external_reference text
    check (external_reference is null or char_length(external_reference) <= 255),
  provider_status text not null check (char_length(provider_status) between 2 and 80),
  billing_type text not null check (char_length(billing_type) between 2 and 40),
  billing_cycle text not null check (char_length(billing_cycle) between 2 and 40),
  amount_cents bigint not null check (amount_cents >= 0),
  next_due_date date,
  agreement_id uuid,
  match_status text not null default 'unmatched'
    check (match_status in ('matched', 'ambiguous', 'unmatched')),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_subscriptions_agreement_workspace_fkey
    foreign key (agreement_id, organization_id)
    references public.tuition_agreements(id, organization_id)
    on delete restrict,
  constraint provider_subscriptions_external_unique
    unique (organization_id, provider, external_subscription_id)
);

create index if not exists provider_subscriptions_org_status_idx
  on public.provider_subscriptions
    (organization_id, provider, provider_status, next_due_date);

create table if not exists public.finance_provider_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider = 'asaas'),
  environment text not null check (environment in ('sandbox', 'production')),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  customer_count integer not null default 0 check (customer_count >= 0),
  matched_customer_count integer not null default 0 check (matched_customer_count >= 0),
  ambiguous_customer_count integer not null default 0 check (ambiguous_customer_count >= 0),
  payment_count integer not null default 0 check (payment_count >= 0),
  subscription_count integer not null default 0 check (subscription_count >= 0),
  truncated boolean not null default false,
  error_code text check (error_code is null or char_length(error_code) <= 120),
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint finance_provider_sync_runs_completion_check
    check (
      (status = 'running' and completed_at is null)
      or (status in ('completed', 'failed') and completed_at is not null)
    )
);

create index if not exists finance_provider_sync_runs_org_started_idx
  on public.finance_provider_sync_runs
    (organization_id, provider, started_at desc);

create trigger payment_provider_credentials_set_updated_at_v1
before update on public.payment_provider_credentials
for each row execute function private.set_finance_updated_at_v1();

create trigger provider_customers_set_updated_at_v1
before update on public.provider_customers
for each row execute function private.set_finance_updated_at_v1();

create trigger provider_receivables_set_updated_at_v1
before update on public.provider_receivables
for each row execute function private.set_finance_updated_at_v1();

create trigger provider_subscriptions_set_updated_at_v1
before update on public.provider_subscriptions
for each row execute function private.set_finance_updated_at_v1();

alter table public.payment_provider_credentials enable row level security;
alter table public.provider_customers enable row level security;
alter table public.provider_customer_relationship_links enable row level security;
alter table public.provider_receivables enable row level security;
alter table public.provider_subscriptions enable row level security;
alter table public.finance_provider_sync_runs enable row level security;

revoke all on table public.payment_provider_credentials from public, anon, authenticated;
revoke all on table public.provider_customers from public, anon, authenticated;
revoke all on table public.provider_customer_relationship_links from public, anon, authenticated;
revoke all on table public.provider_receivables from public, anon, authenticated;
revoke all on table public.provider_subscriptions from public, anon, authenticated;
revoke all on table public.finance_provider_sync_runs from public, anon, authenticated;

grant all on table public.payment_provider_credentials to service_role;
grant all on table public.provider_customers to service_role;
grant all on table public.provider_customer_relationship_links to service_role;
grant all on table public.provider_receivables to service_role;
grant all on table public.provider_subscriptions to service_role;
grant all on table public.finance_provider_sync_runs to service_role;

create or replace function public.connect_asaas_receivables_v1(
  p_org_id uuid,
  p_environment text,
  p_external_account_id text,
  p_account_status text,
  p_key_hint text,
  p_secret_ciphertext text,
  p_secret_iv text,
  p_secret_fingerprint text,
  p_connected_by uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_merchant_id uuid;
begin
  if p_environment not in ('sandbox', 'production') then
    raise exception 'ASAAS_ENVIRONMENT_INVALID';
  end if;
  if nullif(trim(p_external_account_id), '') is null
    or nullif(trim(p_secret_ciphertext), '') is null
    or nullif(trim(p_secret_iv), '') is null
    or p_secret_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'ASAAS_CONNECTION_INVALID';
  end if;
  if exists (
    select 1
    from public.payment_provider_credentials credential
    where credential.organization_id = p_org_id
      and credential.provider = 'asaas'
  ) then
    raise exception 'ASAAS_ALREADY_CONNECTED';
  end if;

  insert into public.merchant_accounts (
    organization_id,
    provider,
    external_account_id,
    status,
    charges_enabled,
    payouts_enabled,
    environment,
    connection_mode,
    key_hint,
    account_status,
    webhook_id,
    webhook_status,
    last_verified_at,
    last_sync_at,
    sync_error_code,
    connected_by
  )
  values (
    p_org_id,
    'asaas',
    trim(p_external_account_id),
    case when upper(coalesce(p_account_status, '')) = 'APPROVED'
      then 'active' else 'restricted' end,
    false,
    false,
    p_environment,
    'read_only',
    p_key_hint,
    upper(nullif(trim(p_account_status), '')),
    null,
    'not_configured',
    now(),
    null,
    null,
    p_connected_by
  )
  on conflict (organization_id, provider)
  do update set
    external_account_id = excluded.external_account_id,
    status = excluded.status,
    charges_enabled = false,
    payouts_enabled = false,
    environment = excluded.environment,
    connection_mode = 'read_only',
    key_hint = excluded.key_hint,
    account_status = excluded.account_status,
    webhook_id = null,
    webhook_status = 'not_configured',
    last_verified_at = now(),
    last_sync_at = null,
    sync_error_code = null,
    connected_by = excluded.connected_by,
    updated_at = now()
  returning id into v_merchant_id;

  insert into public.payment_provider_credentials (
    organization_id,
    provider,
    environment,
    secret_ciphertext,
    secret_iv,
    secret_fingerprint,
    key_hint,
    created_by,
    rotated_at
  )
  values (
    p_org_id,
    'asaas',
    p_environment,
    p_secret_ciphertext,
    p_secret_iv,
    p_secret_fingerprint,
    p_key_hint,
    p_connected_by,
    now()
  );

  insert into public.finance_audit_events (
    organization_id,
    entity_type,
    entity_id,
    action,
    actor_user_id,
    after_state
  )
  values (
    p_org_id,
    'merchant_account',
    v_merchant_id,
    'provider_connected_read_only',
    p_connected_by,
    jsonb_build_object(
      'provider', 'asaas',
      'environment', p_environment,
      'connection_mode', 'read_only',
      'account_status', upper(nullif(trim(p_account_status), ''))
    )
  );

  return v_merchant_id;
end;
$$;

create or replace function public.disconnect_asaas_receivables_v1(
  p_org_id uuid,
  p_disconnected_by uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_merchant_id uuid;
begin
  select merchant.id
    into v_merchant_id
  from public.merchant_accounts merchant
  where merchant.organization_id = p_org_id
    and merchant.provider = 'asaas'
  for update;

  delete from public.payment_provider_credentials credential
  where credential.organization_id = p_org_id
    and credential.provider = 'asaas';

  if v_merchant_id is not null then
    update public.merchant_accounts merchant
    set
      status = 'disconnected',
      charges_enabled = false,
      payouts_enabled = false,
      connection_mode = 'read_only',
      key_hint = null,
      webhook_id = null,
      webhook_status = 'not_configured',
      last_verified_at = null,
      sync_error_code = null,
      connected_by = null,
      updated_at = now()
    where merchant.id = v_merchant_id;

    insert into public.finance_audit_events (
      organization_id,
      entity_type,
      entity_id,
      action,
      actor_user_id,
      after_state
    )
    values (
      p_org_id,
      'merchant_account',
      v_merchant_id,
      'provider_disconnected',
      p_disconnected_by,
      jsonb_build_object('provider', 'asaas', 'history_preserved', true)
    );
  end if;

  return v_merchant_id is not null;
end;
$$;

revoke all on function public.connect_asaas_receivables_v1(
  uuid, text, text, text, text, text, text, text, uuid
) from public, anon, authenticated;
revoke all on function public.disconnect_asaas_receivables_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.connect_asaas_receivables_v1(
  uuid, text, text, text, text, text, text, text, uuid
) to service_role;
grant execute on function public.disconnect_asaas_receivables_v1(uuid, uuid)
  to service_role;

comment on table public.payment_provider_credentials is
  'Encrypted provider credentials. Never expose through the Data API or client projections.';
comment on table public.provider_receivables is
  'Read-only mirror of provider charges used for migration and reconciliation before activation.';
comment on table public.finance_provider_sync_runs is
  'Auditable receipts for bounded, idempotent provider history imports.';
