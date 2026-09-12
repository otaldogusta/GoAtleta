create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  user_agent text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_push_subscriptions_endpoint_length_check
    check (char_length(endpoint) between 20 and 2048),
  constraint web_push_subscriptions_p256dh_length_check
    check (char_length(p256dh) between 40 and 256),
  constraint web_push_subscriptions_auth_length_check
    check (char_length(auth_key) between 8 and 128),
  constraint web_push_subscriptions_endpoint_unique unique (endpoint)
);

create index if not exists web_push_subscriptions_org_user_idx
  on public.web_push_subscriptions (organization_id, user_id, updated_at desc);

alter table public.web_push_subscriptions enable row level security;

-- Subscription endpoints are capability URLs. Clients register them through
-- the authenticated Edge Function; only service_role can read or mutate them.
revoke all on table public.web_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.web_push_subscriptions to service_role;

create or replace function private.set_web_push_subscription_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_web_push_subscription_updated_at()
  from public, anon, authenticated;

drop trigger if exists trg_web_push_subscriptions_updated_at
  on public.web_push_subscriptions;
create trigger trg_web_push_subscriptions_updated_at
before update on public.web_push_subscriptions
for each row
execute function private.set_web_push_subscription_updated_at();

comment on table public.web_push_subscriptions is
  'Private browser Push API subscriptions registered through the authenticated web-push Edge Function.';
