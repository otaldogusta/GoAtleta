-- Prevent one persisted inbox notification from being delivered repeatedly and
-- bound the number of Expo devices that one user can register in an organization.

alter table public.push_deliveries
  add column if not exists notification_id uuid null
  references public.notifications(id) on delete set null;

create unique index if not exists push_deliveries_notification_once_idx
  on public.push_deliveries (notification_id)
  where notification_id is not null;

create index if not exists push_deliveries_sender_rate_idx
  on public.push_deliveries (organization_id, from_user_id, created_at desc);

create or replace function public.claim_push_delivery(
  p_organization_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_notification_id uuid,
  p_title text,
  p_body text,
  p_data jsonb
)
returns table (
  delivery_id uuid,
  claim_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent_deliveries integer;
  v_delivery_id uuid;
begin
  if p_organization_id is null
    or p_from_user_id is null
    or p_to_user_id is null
    or nullif(trim(p_title), '') is null
    or nullif(trim(p_body), '') is null
  then
    raise exception 'Invalid push delivery claim.'
      using errcode = '22023';
  end if;

  if p_notification_id is not null and not exists (
    select 1
    from public.notifications notification
    where notification.id = p_notification_id
      and notification.organization_id = p_organization_id
      and notification.actor_user_id = p_from_user_id
      and notification.recipient_user_id = p_to_user_id
  ) then
    raise exception 'Notification does not match push delivery claim.'
      using errcode = '22023';
  end if;

  -- A transaction-scoped lock makes the 30/minute check strict even when one
  -- sender starts several Edge requests concurrently.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'push-delivery:' || p_organization_id::text || ':' || p_from_user_id::text,
      0
    )
  );

  select count(*)
  into v_recent_deliveries
  from public.push_deliveries delivery
  where delivery.organization_id = p_organization_id
    and delivery.from_user_id = p_from_user_id
    and delivery.created_at >= clock_timestamp() - interval '1 minute';

  if v_recent_deliveries >= 30 then
    return query select null::uuid, 'rate_limited'::text;
    return;
  end if;

  begin
    insert into public.push_deliveries (
      organization_id,
      from_user_id,
      to_user_id,
      notification_id,
      title,
      body,
      data,
      status,
      provider_response
    ) values (
      p_organization_id,
      p_from_user_id,
      p_to_user_id,
      p_notification_id,
      p_title,
      p_body,
      p_data,
      'error',
      jsonb_build_object('reason', 'processing')
    )
    returning id into v_delivery_id;
  exception
    when unique_violation then
      return query select null::uuid, 'duplicate'::text;
      return;
  end;

  return query select v_delivery_id, 'claimed'::text;
end;
$$;

revoke all on function public.claim_push_delivery(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.claim_push_delivery(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  jsonb
) to service_role;

alter table public.push_tokens
  drop constraint if exists push_tokens_expo_token_format_check;

-- NOT VALID preserves any legacy rows until the sender can prune them while
-- still enforcing the contract for every new or updated token.
alter table public.push_tokens
  add constraint push_tokens_expo_token_format_check
  check (
    char_length(expo_push_token) between 1 and 200
    and expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
  ) not valid;

create or replace function public.enforce_push_token_registration_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_registered_tokens integer;
begin
  -- Serialize registrations for the same organization/user so concurrent
  -- inserts cannot race past the limit.
  perform pg_advisory_xact_lock(
    hashtextextended(
      new.organization_id::text || ':' || new.user_id::text,
      0
    )
  );

  -- An upsert of an already registered device must remain possible at the cap.
  if exists (
    select 1
    from public.push_tokens token
    where token.organization_id = new.organization_id
      and token.user_id = new.user_id
      and token.expo_push_token = new.expo_push_token
  ) then
    return new;
  end if;

  select count(*)
  into v_registered_tokens
  from public.push_tokens token
  where token.organization_id = new.organization_id
    and token.user_id = new.user_id;

  if v_registered_tokens >= 8 then
    raise exception 'Push token registration limit reached.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_push_token_registration_limit()
  from public, anon, authenticated;

drop trigger if exists trg_push_tokens_registration_limit
  on public.push_tokens;
create trigger trg_push_tokens_registration_limit
before insert on public.push_tokens
for each row
execute function public.enforce_push_token_registration_limit();
