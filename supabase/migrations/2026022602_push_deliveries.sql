-- Delivery audit for remote push sends.

create table if not exists public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb null,
  status text not null check (status in ('ok', 'partial', 'error')),
  provider_response jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists push_deliveries_org_created_idx
  on public.push_deliveries (organization_id, created_at desc);

create index if not exists push_deliveries_to_user_idx
  on public.push_deliveries (to_user_id, created_at desc);

alter table public.push_deliveries enable row level security;

drop policy if exists "push_deliveries_select_member" on public.push_deliveries;
create policy "push_deliveries_select_member"
  on public.push_deliveries
  for select
  using (public.is_org_member(organization_id));

grant select on table public.push_deliveries to authenticated;

