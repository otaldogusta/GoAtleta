-- Repair the platform institution RPCs after production lint exposed two
-- PostgreSQL type/name-resolution errors in the initial lifecycle migration.

create or replace function public.platform_list_institutions()
returns table (
  organization_id uuid,
  organization_name text,
  responsible_user_id uuid,
  responsible_name text,
  responsible_email text,
  product text,
  lifecycle_status text,
  commercial_status text,
  evaluation_ends_at date,
  activated_at date,
  renews_at date,
  commercial_note text,
  users_count bigint,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    organization.id,
    organization.name,
    coalesce(account.responsible_user_id, organization.created_by),
    coalesce(
      nullif(trim(responsible.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(responsible.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(responsible.email, ''), '@', 1),
      'Responsável não informado'
    ),
    coalesce(responsible.email, '')::text,
    coalesce(account.product, 'goatleta'),
    coalesce(account.lifecycle_status, 'evaluation'),
    coalesce(account.commercial_status, 'ok'),
    account.evaluation_ends_at,
    account.activated_at,
    account.renews_at,
    coalesce(account.commercial_note, ''),
    (select count(*) from public.organization_members member where member.organization_id = organization.id),
    coalesce(account.updated_at, organization.created_at)
  from public.organizations organization
  left join public.platform_institution_accounts account
    on account.organization_id = organization.id
  left join auth.users responsible
    on responsible.id = coalesce(account.responsible_user_id, organization.created_by)
  order by
    case coalesce(account.lifecycle_status, 'evaluation') when 'evaluation' then 0 when 'active' then 1 else 2 end,
    organization.name;
end;
$$;

create or replace function public.platform_update_institution_account(
  p_organization_id uuid,
  p_product text,
  p_lifecycle_status text,
  p_commercial_status text,
  p_evaluation_ends_at date,
  p_activated_at date,
  p_renews_at date,
  p_commercial_note text,
  p_idempotency_key uuid
)
returns table (organization_id uuid, changed boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, pg_temp
set row_security = off
as $$
declare
  v_before public.platform_institution_accounts%rowtype;
  v_after public.platform_institution_accounts%rowtype;
  v_action text;
begin
  if auth.uid() is null or not public.is_platform_admin() then raise exception 'Not authorized'; end if;
  if p_idempotency_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_product not in ('goatleta', 'goatleta_pro') then raise exception 'INVALID_PRODUCT'; end if;
  if p_lifecycle_status not in ('evaluation', 'active', 'paused', 'cancelled') then raise exception 'INVALID_LIFECYCLE_STATUS'; end if;
  if p_commercial_status not in ('ok', 'attention') then raise exception 'INVALID_COMMERCIAL_STATUS'; end if;
  if char_length(coalesce(p_commercial_note, '')) > 1000 then raise exception 'COMMERCIAL_NOTE_TOO_LONG'; end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then raise exception 'ORGANIZATION_NOT_FOUND'; end if;

  if exists (select 1 from public.platform_institution_account_audit where actor_user_id = auth.uid() and idempotency_key = p_idempotency_key) then
    return query select p_organization_id, false, coalesce((select account.updated_at from public.platform_institution_accounts account where account.organization_id = p_organization_id), now());
    return;
  end if;

  select * into v_before
  from public.platform_institution_accounts account
  where account.organization_id = p_organization_id
  for update;
  v_action := case when found then 'updated' else 'created' end;

  insert into public.platform_institution_accounts (
    organization_id, product, lifecycle_status, commercial_status,
    evaluation_ends_at, activated_at, renews_at, commercial_note, updated_at, updated_by
  ) values (
    p_organization_id, p_product, p_lifecycle_status, p_commercial_status,
    p_evaluation_ends_at, p_activated_at, p_renews_at, trim(coalesce(p_commercial_note, '')), now(), auth.uid()
  )
  on conflict on constraint platform_institution_accounts_pkey do update set
    product = excluded.product,
    lifecycle_status = excluded.lifecycle_status,
    commercial_status = excluded.commercial_status,
    evaluation_ends_at = excluded.evaluation_ends_at,
    activated_at = excluded.activated_at,
    renews_at = excluded.renews_at,
    commercial_note = excluded.commercial_note,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
  returning * into v_after;

  insert into public.platform_institution_account_audit (
    organization_id, actor_user_id, action, before_state, after_state, idempotency_key
  ) values (
    p_organization_id, auth.uid(), v_action,
    case when v_action = 'created' then null else to_jsonb(v_before) end,
    to_jsonb(v_after), p_idempotency_key
  );

  return query select p_organization_id, true, v_after.updated_at;
end;
$$;

revoke all on function public.platform_list_institutions() from public, anon;
revoke all on function public.platform_update_institution_account(uuid, text, text, text, date, date, date, text, uuid) from public, anon;
grant execute on function public.platform_list_institutions() to authenticated;
grant execute on function public.platform_update_institution_account(uuid, text, text, text, date, date, date, text, uuid) to authenticated;
