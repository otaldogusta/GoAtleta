-- Financial foundation.
--
-- SaaS subscriptions paid by an organization are intentionally independent
-- from tuition receivables paid by athlete families. Provider identifiers and
-- hashes are stored for reconciliation; credentials are never persisted here.

create table if not exists public.plan_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
    check (code ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  name text not null check (char_length(name) between 2 and 120),
  description text check (description is null or char_length(description) <= 500),
  price_cents bigint not null check (price_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  billing_interval text not null
    check (billing_interval in ('month', 'year')),
  trial_days integer not null default 0 check (trial_days between 0 and 90),
  max_staff integer check (max_staff is null or max_staff > 0),
  max_students integer check (max_students is null or max_students > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  plan_id uuid not null references public.plan_catalog(id) on delete restrict,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'paused', 'canceled', 'expired')),
  provider text,
  external_customer_id text,
  external_subscription_id text,
  idempotency_key text,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_subscriptions_provider_check
    check (provider is null or provider ~ '^[a-z0-9_-]{2,40}$'),
  constraint organization_subscriptions_period_check
    check (
      current_period_starts_at is null
      or current_period_ends_at is null
      or current_period_ends_at > current_period_starts_at
    ),
  constraint organization_subscriptions_canceled_check
    check (status <> 'canceled' or canceled_at is not null),
  constraint organization_subscriptions_id_workspace_unique
    unique (id, organization_id)
);

create unique index if not exists organization_subscriptions_external_unique
  on public.organization_subscriptions (provider, external_subscription_id)
  where provider is not null and external_subscription_id is not null;

create unique index if not exists organization_subscriptions_idempotency_unique
  on public.organization_subscriptions (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists organization_subscriptions_org_status_idx
  on public.organization_subscriptions (organization_id, status, current_period_ends_at);

create table if not exists public.merchant_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider text not null check (provider ~ '^[a-z0-9_-]{2,40}$'),
  external_account_id text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'restricted', 'disconnected')),
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merchant_accounts_id_workspace_unique
    unique (id, organization_id),
  constraint merchant_accounts_org_provider_unique
    unique (organization_id, provider)
);

create unique index if not exists merchant_accounts_external_unique
  on public.merchant_accounts (provider, external_account_id)
  where external_account_id is not null;

create table if not exists public.tuition_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(name) between 2 and 120),
  description text check (description is null or char_length(description) <= 500),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  billing_day integer not null check (billing_day between 1 and 28),
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint tuition_plans_id_workspace_unique
    unique (id, organization_id)
);

create unique index if not exists tuition_plans_idempotency_unique
  on public.tuition_plans (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists tuition_plans_org_status_idx
  on public.tuition_plans (organization_id, status, name);

create table if not exists public.tuition_agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_id text not null,
  plan_id uuid not null,
  payer_relationship_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  billing_day integer not null check (billing_day between 1 and 28),
  starts_on date not null,
  ends_on date,
  status text not null default 'active'
    check (status in ('active', 'paused', 'canceled', 'completed')),
  idempotency_key text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  canceled_at timestamptz,
  constraint tuition_agreements_student_workspace_fkey
    foreign key (student_id, organization_id)
    references public.students(id, organization_id)
    on delete restrict,
  constraint tuition_agreements_plan_workspace_fkey
    foreign key (plan_id, organization_id)
    references public.tuition_plans(id, organization_id)
    on delete restrict,
  constraint tuition_agreements_payer_workspace_fkey
    foreign key (payer_relationship_id, organization_id)
    references public.student_relationships(id, organization_id)
    on delete restrict,
  constraint tuition_agreements_date_check
    check (ends_on is null or ends_on >= starts_on),
  constraint tuition_agreements_canceled_check
    check (status <> 'canceled' or canceled_at is not null),
  constraint tuition_agreements_id_workspace_unique
    unique (id, organization_id)
);

create unique index if not exists tuition_agreements_active_student_unique
  on public.tuition_agreements (organization_id, student_id)
  where status = 'active';

create unique index if not exists tuition_agreements_idempotency_unique
  on public.tuition_agreements (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists tuition_agreements_payer_status_idx
  on public.tuition_agreements (payer_relationship_id, status, organization_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  agreement_id uuid not null,
  student_id text not null,
  payer_relationship_id uuid not null,
  competence_month date not null,
  due_date date not null,
  amount_cents bigint not null check (amount_cents > 0),
  paid_cents bigint not null default 0 check (paid_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  status text not null default 'open'
    check (status in ('draft', 'open', 'pending', 'paid', 'overdue', 'void', 'refunded')),
  description text check (description is null or char_length(description) <= 500),
  provider text,
  external_invoice_id text,
  idempotency_key text not null,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint invoices_agreement_workspace_fkey
    foreign key (agreement_id, organization_id)
    references public.tuition_agreements(id, organization_id)
    on delete restrict,
  constraint invoices_student_workspace_fkey
    foreign key (student_id, organization_id)
    references public.students(id, organization_id)
    on delete restrict,
  constraint invoices_payer_workspace_fkey
    foreign key (payer_relationship_id, organization_id)
    references public.student_relationships(id, organization_id)
    on delete restrict,
  constraint invoices_competence_first_day_check
    check (extract(day from competence_month) = 1),
  constraint invoices_paid_amount_check
    check (paid_cents <= amount_cents),
  constraint invoices_provider_check
    check (provider is null or provider ~ '^[a-z0-9_-]{2,40}$'),
  constraint invoices_paid_state_check
    check (
      (status = 'paid' and paid_cents = amount_cents and paid_at is not null)
      or status <> 'paid'
    ),
  constraint invoices_void_state_check
    check ((status = 'void' and voided_at is not null) or status <> 'void'),
  constraint invoices_id_workspace_unique
    unique (id, organization_id),
  constraint invoices_agreement_competence_unique
    unique (organization_id, agreement_id, competence_month),
  constraint invoices_idempotency_unique
    unique (organization_id, idempotency_key)
);

create unique index if not exists invoices_external_unique
  on public.invoices (provider, external_invoice_id)
  where provider is not null and external_invoice_id is not null;

create index if not exists invoices_org_status_due_idx
  on public.invoices (organization_id, status, due_date);

create index if not exists invoices_student_competence_idx
  on public.invoices (organization_id, student_id, competence_month desc);

create index if not exists invoices_payer_due_idx
  on public.invoices (payer_relationship_id, due_date desc);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  invoice_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  method text not null
    check (method in ('pix', 'boleto', 'card', 'cash', 'bank_transfer', 'other')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'failed', 'refunded', 'partially_refunded')),
  provider text,
  external_payment_id text,
  idempotency_key text not null,
  paid_at timestamptz,
  recorded_by uuid references auth.users(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_invoice_workspace_fkey
    foreign key (invoice_id, organization_id)
    references public.invoices(id, organization_id)
    on delete restrict,
  constraint payments_provider_check
    check (provider is null or provider ~ '^[a-z0-9_-]{2,40}$'),
  constraint payments_confirmed_at_check
    check ((status = 'confirmed' and paid_at is not null) or status <> 'confirmed'),
  constraint payments_id_workspace_unique
    unique (id, organization_id),
  constraint payments_idempotency_unique
    unique (organization_id, idempotency_key)
);

create unique index if not exists payments_external_unique
  on public.payments (provider, external_payment_id)
  where provider is not null and external_payment_id is not null;

create index if not exists payments_invoice_status_idx
  on public.payments (organization_id, invoice_id, status, paid_at desc);

create table if not exists public.provider_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  provider text not null check (provider ~ '^[a-z0-9_-]{2,40}$'),
  external_event_id text not null,
  event_type text not null check (char_length(event_type) between 1 and 120),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  processing_error_code text
    check (processing_error_code is null or char_length(processing_error_code) <= 120),
  constraint provider_events_external_unique
    unique (provider, external_event_id)
);

create index if not exists provider_events_org_status_received_idx
  on public.provider_events (organization_id, processing_status, received_at desc);

create table if not exists public.finance_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  entity_type text not null
    check (entity_type in ('plan', 'agreement', 'invoice', 'payment', 'subscription', 'merchant_account')),
  entity_id uuid not null,
  action text not null check (char_length(action) between 2 and 80),
  actor_user_id uuid references auth.users(id) on delete set null,
  idempotency_key text,
  before_state jsonb,
  after_state jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists finance_audit_events_org_entity_idx
  on public.finance_audit_events (organization_id, entity_type, entity_id, occurred_at desc);

create index if not exists finance_audit_events_actor_idx
  on public.finance_audit_events (actor_user_id, occurred_at desc)
  where actor_user_id is not null;

create or replace function private.set_finance_updated_at_v1()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_finance_updated_at_v1() from public;

create trigger plan_catalog_set_updated_at_v1
before update on public.plan_catalog
for each row execute function private.set_finance_updated_at_v1();

create trigger organization_subscriptions_set_updated_at_v1
before update on public.organization_subscriptions
for each row execute function private.set_finance_updated_at_v1();

create trigger merchant_accounts_set_updated_at_v1
before update on public.merchant_accounts
for each row execute function private.set_finance_updated_at_v1();

create trigger tuition_plans_set_updated_at_v1
before update on public.tuition_plans
for each row execute function private.set_finance_updated_at_v1();

create trigger tuition_agreements_set_updated_at_v1
before update on public.tuition_agreements
for each row execute function private.set_finance_updated_at_v1();

create trigger invoices_set_updated_at_v1
before update on public.invoices
for each row execute function private.set_finance_updated_at_v1();

create trigger payments_set_updated_at_v1
before update on public.payments
for each row execute function private.set_finance_updated_at_v1();

alter table public.plan_catalog enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.merchant_accounts enable row level security;
alter table public.tuition_plans enable row level security;
alter table public.tuition_agreements enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.provider_events enable row level security;
alter table public.finance_audit_events enable row level security;

revoke all on table public.plan_catalog from public, anon, authenticated;
revoke all on table public.organization_subscriptions from public, anon, authenticated;
revoke all on table public.merchant_accounts from public, anon, authenticated;
revoke all on table public.tuition_plans from public, anon, authenticated;
revoke all on table public.tuition_agreements from public, anon, authenticated;
revoke all on table public.invoices from public, anon, authenticated;
revoke all on table public.payments from public, anon, authenticated;
revoke all on table public.provider_events from public, anon, authenticated;
revoke all on table public.finance_audit_events from public, anon, authenticated;

grant select on table public.plan_catalog to authenticated;

grant all on table public.plan_catalog to service_role;
grant all on table public.organization_subscriptions to service_role;
grant all on table public.merchant_accounts to service_role;
grant all on table public.tuition_plans to service_role;
grant all on table public.tuition_agreements to service_role;
grant all on table public.invoices to service_role;
grant all on table public.payments to service_role;
grant all on table public.provider_events to service_role;
grant all on table public.finance_audit_events to service_role;

create policy "active plans readable by authenticated users"
  on public.plan_catalog
  for select
  to authenticated
  using (is_active);

create policy "organization subscriptions select financial staff"
  on public.organization_subscriptions
  for select
  to authenticated
  using (public.has_org_member_permission(organization_id, 'financial'));

create policy "merchant accounts select financial staff"
  on public.merchant_accounts
  for select
  to authenticated
  using (public.has_org_member_permission(organization_id, 'financial'));

create policy "tuition plans select financial staff"
  on public.tuition_plans
  for select
  to authenticated
  using (public.has_org_member_permission(organization_id, 'financial'));

create policy "tuition agreements select staff or family"
  on public.tuition_agreements
  for select
  to authenticated
  using (
    public.has_org_member_permission(organization_id, 'financial')
    or public.has_student_relationship(organization_id, student_id, 'financial')
  );

create policy "invoices select staff or family"
  on public.invoices
  for select
  to authenticated
  using (
    public.has_org_member_permission(organization_id, 'financial')
    or public.has_student_relationship(organization_id, student_id, 'financial')
  );

create policy "payments select staff or family"
  on public.payments
  for select
  to authenticated
  using (
    public.has_org_member_permission(organization_id, 'financial')
    or exists (
      select 1
      from public.invoices invoice
      where invoice.id = payments.invoice_id
        and invoice.organization_id = payments.organization_id
        and public.has_student_relationship(
          invoice.organization_id,
          invoice.student_id,
          'financial'
        )
    )
  );

create policy "provider events select financial staff"
  on public.provider_events
  for select
  to authenticated
  using (public.has_org_member_permission(organization_id, 'financial'));

create policy "finance audit events select financial staff"
  on public.finance_audit_events
  for select
  to authenticated
  using (public.has_org_member_permission(organization_id, 'financial'));

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
        where invoice.status in ('open', 'pending', 'overdue')
      ), 0)::bigint as open_cents,
      count(*) filter (
        where invoice.status = 'overdue'
           or (invoice.status in ('open', 'pending') and invoice.due_date < current_date)
      )::bigint as overdue_count,
      count(*) filter (
        where invoice.status in ('open', 'pending', 'overdue')
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

create or replace function public.list_organization_invoices_v1(
  p_org_id uuid,
  p_status text default null
)
returns table (
  invoice_id uuid,
  student_id text,
  student_name text,
  competence_month date,
  due_date date,
  amount_cents bigint,
  paid_cents bigint,
  status text,
  description text,
  created_at timestamptz,
  paid_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_status text := nullif(lower(trim(coalesce(p_status, ''))), '');
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_org_member_permission(p_org_id, 'financial') then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_status is not null
    and v_status not in ('draft', 'open', 'pending', 'paid', 'overdue', 'void', 'refunded') then
    raise exception 'INVOICE_STATUS_INVALID';
  end if;

  return query
  select
    invoice.id,
    invoice.student_id,
    student.name,
    invoice.competence_month,
    invoice.due_date,
    invoice.amount_cents,
    invoice.paid_cents,
    case
      when invoice.status in ('open', 'pending') and invoice.due_date < current_date
        then 'overdue'
      else invoice.status
    end,
    invoice.description,
    invoice.created_at,
    invoice.paid_at
  from public.invoices invoice
  join public.students student
    on student.id = invoice.student_id
   and student.organization_id = invoice.organization_id
  where invoice.organization_id = p_org_id
    and (
      v_status is null
      or case
        when invoice.status in ('open', 'pending') and invoice.due_date < current_date
          then 'overdue'
        else invoice.status
      end = v_status
    )
  order by invoice.due_date desc, student.name;
end;
$$;

revoke all on function public.list_organization_invoices_v1(uuid, text)
  from public, anon;
grant execute on function public.list_organization_invoices_v1(uuid, text)
  to authenticated;

create or replace function public.get_my_family_finance_v1()
returns table (
  organization_id uuid,
  organization_name text,
  relationship_id uuid,
  relationship_kind text,
  student_id text,
  student_name text,
  invoice_id uuid,
  competence_month date,
  due_date date,
  amount_cents bigint,
  paid_cents bigint,
  status text,
  description text,
  created_at timestamptz,
  paid_at timestamptz,
  can_pay boolean
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
    relationship.organization_id,
    organization.name,
    relationship.id,
    relationship.relationship_kind,
    relationship.student_id,
    student.name,
    invoice.id,
    invoice.competence_month,
    invoice.due_date,
    invoice.amount_cents,
    invoice.paid_cents,
    case
      when invoice.status in ('open', 'pending') and invoice.due_date < current_date
        then 'overdue'
      else invoice.status
    end,
    invoice.description,
    invoice.created_at,
    invoice.paid_at,
    relationship.can_pay
  from public.student_relationships relationship
  join public.organizations organization
    on organization.id = relationship.organization_id
  join public.students student
    on student.id = relationship.student_id
   and student.organization_id = relationship.organization_id
  left join public.invoices invoice
    on invoice.organization_id = relationship.organization_id
   and invoice.student_id = relationship.student_id
   and invoice.status <> 'draft'
  where relationship.user_id = (select auth.uid())
    and relationship.status = 'active'
    and relationship.can_view_financial
  order by organization.name, student.name, invoice.due_date desc nulls last;
end;
$$;

revoke all on function public.get_my_family_finance_v1()
  from public, anon;
grant execute on function public.get_my_family_finance_v1()
  to authenticated;

create or replace function public.list_tuition_plans_v1(
  p_org_id uuid
)
returns table (
  plan_id uuid,
  name text,
  description text,
  amount_cents bigint,
  currency text,
  due_day integer,
  active boolean,
  created_at timestamptz
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
  select
    plan.id,
    plan.name,
    plan.description,
    plan.amount_cents,
    plan.currency,
    plan.billing_day,
    plan.status = 'active',
    plan.created_at
  from public.tuition_plans plan
  where plan.organization_id = p_org_id
  order by (plan.status = 'active') desc, plan.name;
end;
$$;

revoke all on function public.list_tuition_plans_v1(uuid)
  from public, anon;
grant execute on function public.list_tuition_plans_v1(uuid)
  to authenticated;

create or replace function public.list_tuition_agreements_v1(
  p_org_id uuid
)
returns table (
  agreement_id uuid,
  student_id text,
  student_name text,
  plan_id uuid,
  plan_name text,
  payer_user_id uuid,
  status text,
  start_date date,
  end_date date,
  amount_cents bigint,
  due_day integer
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
  select
    agreement.id,
    agreement.student_id,
    student.name,
    agreement.plan_id,
    plan.name,
    relationship.user_id,
    agreement.status,
    agreement.starts_on,
    agreement.ends_on,
    agreement.amount_cents,
    agreement.billing_day
  from public.tuition_agreements agreement
  join public.students student
    on student.id = agreement.student_id
   and student.organization_id = agreement.organization_id
  join public.tuition_plans plan
    on plan.id = agreement.plan_id
   and plan.organization_id = agreement.organization_id
  join public.student_relationships relationship
    on relationship.id = agreement.payer_relationship_id
   and relationship.organization_id = agreement.organization_id
  where agreement.organization_id = p_org_id
  order by student.name, agreement.created_at desc;
end;
$$;

revoke all on function public.list_tuition_agreements_v1(uuid)
  from public, anon;
grant execute on function public.list_tuition_agreements_v1(uuid)
  to authenticated;

create or replace function public.create_tuition_plan_v1(
  p_org_id uuid,
  p_name text,
  p_amount_cents bigint,
  p_billing_day integer,
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
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_existing public.tuition_plans%rowtype;
  v_plan_id uuid;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_org_member_permission(p_org_id, 'financial') then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_name is null or char_length(v_name) > 120 then
    raise exception 'PLAN_NAME_INVALID';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'AMOUNT_INVALID';
  end if;
  if p_billing_day is null or p_billing_day not between 1 and 28 then
    raise exception 'BILLING_DAY_INVALID';
  end if;
  if v_key is null or char_length(v_key) > 160 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tuition_plan:' || p_org_id::text || ':' || v_key, 0));

  select plan.*
    into v_existing
  from public.tuition_plans plan
  where plan.organization_id = p_org_id
    and plan.idempotency_key = v_key
  for update;

  if found then
    if v_existing.name is distinct from v_name
      or v_existing.amount_cents is distinct from p_amount_cents
      or v_existing.billing_day is distinct from p_billing_day
      or v_existing.description is distinct from nullif(trim(p_description), '') then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_existing.id;
  end if;

  insert into public.tuition_plans (
    organization_id,
    name,
    description,
    amount_cents,
    billing_day,
    idempotency_key,
    created_by
  ) values (
    p_org_id,
    v_name,
    nullif(trim(p_description), ''),
    p_amount_cents,
    p_billing_day,
    v_key,
    v_actor
  ) returning id into v_plan_id;

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
    'plan',
    v_plan_id,
    'created',
    v_actor,
    v_key,
    jsonb_build_object(
      'name', v_name,
      'amount_cents', p_amount_cents,
      'billing_day', p_billing_day,
      'currency', 'BRL'
    )
  );

  return v_plan_id;
end;
$$;

revoke all on function public.create_tuition_plan_v1(
  uuid, text, bigint, integer, text, text
) from public, anon;
grant execute on function public.create_tuition_plan_v1(
  uuid, text, bigint, integer, text, text
) to authenticated;

create or replace function public.create_tuition_agreement_v1(
  p_org_id uuid,
  p_student_id text,
  p_plan_id uuid,
  p_payer_relationship_id uuid,
  p_starts_on date,
  p_idempotency_key text,
  p_ends_on date default null,
  p_amount_cents bigint default null,
  p_billing_day integer default null
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
  v_plan public.tuition_plans%rowtype;
  v_relationship public.student_relationships%rowtype;
  v_existing public.tuition_agreements%rowtype;
  v_amount bigint;
  v_day integer;
  v_agreement_id uuid;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.has_org_member_permission(p_org_id, 'financial') then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if p_starts_on is null or (p_ends_on is not null and p_ends_on < p_starts_on) then
    raise exception 'AGREEMENT_DATES_INVALID';
  end if;
  if v_key is null or char_length(v_key) > 160 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tuition_agreement:' || p_org_id::text || ':' || v_key, 0));

  select agreement.*
    into v_existing
  from public.tuition_agreements agreement
  where agreement.organization_id = p_org_id
    and agreement.idempotency_key = v_key
  for update;

  if found then
    if v_existing.student_id is distinct from p_student_id
      or v_existing.plan_id is distinct from p_plan_id
      or v_existing.payer_relationship_id is distinct from p_payer_relationship_id
      or v_existing.starts_on is distinct from p_starts_on
      or v_existing.ends_on is distinct from p_ends_on
      or (p_amount_cents is not null and v_existing.amount_cents is distinct from p_amount_cents)
      or (p_billing_day is not null and v_existing.billing_day is distinct from p_billing_day) then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_existing.id;
  end if;

  perform 1
  from public.students student
  where student.id = p_student_id
    and student.organization_id = p_org_id
  for update;
  if not found then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  select plan.*
    into v_plan
  from public.tuition_plans plan
  where plan.id = p_plan_id
    and plan.organization_id = p_org_id
    and plan.status = 'active'
  for update;
  if not found then
    raise exception 'TUITION_PLAN_NOT_FOUND';
  end if;

  select relationship.*
    into v_relationship
  from public.student_relationships relationship
  where relationship.id = p_payer_relationship_id
    and relationship.organization_id = p_org_id
    and relationship.student_id = p_student_id
    and relationship.status = 'active'
    and relationship.can_pay
  for update;
  if not found then
    raise exception 'PAYER_RELATIONSHIP_INVALID';
  end if;

  v_amount := coalesce(p_amount_cents, v_plan.amount_cents);
  v_day := coalesce(p_billing_day, v_plan.billing_day);
  if v_amount <= 0 then
    raise exception 'AMOUNT_INVALID';
  end if;
  if v_day not between 1 and 28 then
    raise exception 'BILLING_DAY_INVALID';
  end if;

  insert into public.tuition_agreements (
    organization_id,
    student_id,
    plan_id,
    payer_relationship_id,
    amount_cents,
    billing_day,
    starts_on,
    ends_on,
    idempotency_key,
    created_by
  ) values (
    p_org_id,
    p_student_id,
    p_plan_id,
    p_payer_relationship_id,
    v_amount,
    v_day,
    p_starts_on,
    p_ends_on,
    v_key,
    v_actor
  ) returning id into v_agreement_id;

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
    'agreement',
    v_agreement_id,
    'created',
    v_actor,
    v_key,
    jsonb_build_object(
      'student_id', p_student_id,
      'plan_id', p_plan_id,
      'payer_relationship_id', p_payer_relationship_id,
      'amount_cents', v_amount,
      'billing_day', v_day,
      'starts_on', p_starts_on,
      'ends_on', p_ends_on,
      'currency', 'BRL'
    )
  );

  return v_agreement_id;
end;
$$;

revoke all on function public.create_tuition_agreement_v1(
  uuid, text, uuid, uuid, date, text, date, bigint, integer
) from public, anon;
grant execute on function public.create_tuition_agreement_v1(
  uuid, text, uuid, uuid, date, text, date, bigint, integer
) to authenticated;

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
    and agreement.status = 'active'
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

comment on table public.organization_subscriptions is
  'SaaS entitlement purchased by the organization; independent from athlete tuition.';
comment on table public.invoices is
  'Organization receivables in integer cents. Family access is relationship-scoped.';
comment on table public.provider_events is
  'Idempotent provider event envelope containing identifiers and a payload digest only.';
