-- Rotate an institution's Asaas credential without disconnecting the account
-- or losing the imported receivables history. The Edge Function validates the
-- new key first; this RPC then replaces the encrypted secret atomically.

create or replace function public.rotate_asaas_receivables_key_v1(
  p_org_id uuid,
  p_environment text,
  p_external_account_id text,
  p_account_status text,
  p_key_hint text,
  p_secret_ciphertext text,
  p_secret_iv text,
  p_secret_fingerprint text,
  p_rotated_by uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_merchant_id uuid;
  v_external_account_id text;
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

  select merchant.id, merchant.external_account_id
    into v_merchant_id, v_external_account_id
  from public.merchant_accounts merchant
  where merchant.organization_id = p_org_id
    and merchant.provider = 'asaas'
  for update;

  if v_merchant_id is null then
    raise exception 'ASAAS_NOT_CONNECTED';
  end if;
  if coalesce(trim(v_external_account_id), '') <> trim(p_external_account_id) then
    raise exception 'ASAAS_ACCOUNT_MISMATCH';
  end if;

  update public.payment_provider_credentials credential
  set
    environment = p_environment,
    secret_ciphertext = p_secret_ciphertext,
    secret_iv = p_secret_iv,
    secret_fingerprint = p_secret_fingerprint,
    key_hint = p_key_hint,
    created_by = p_rotated_by,
    rotated_at = now(),
    updated_at = now()
  where credential.organization_id = p_org_id
    and credential.provider = 'asaas';

  if not found then
    raise exception 'ASAAS_NOT_CONNECTED';
  end if;

  update public.merchant_accounts merchant
  set
    status = case when upper(coalesce(p_account_status, '')) = 'APPROVED'
      then 'active' else 'restricted' end,
    environment = p_environment,
    key_hint = p_key_hint,
    account_status = upper(nullif(trim(p_account_status), '')),
    last_verified_at = now(),
    sync_error_code = null,
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
    'provider_credential_rotated',
    p_rotated_by,
    jsonb_build_object(
      'provider', 'asaas',
      'environment', p_environment,
      'connection_mode', 'read_only',
      'account_status', upper(nullif(trim(p_account_status), '')),
      'history_preserved', true
    )
  );

  return v_merchant_id;
end;
$$;

revoke all on function public.rotate_asaas_receivables_key_v1(
  uuid, text, text, text, text, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.rotate_asaas_receivables_key_v1(
  uuid, text, text, text, text, text, text, text, uuid
) to service_role;

comment on function public.rotate_asaas_receivables_key_v1(
  uuid, text, text, text, text, text, text, text, uuid
) is 'Atomically rotates an encrypted Asaas key after server-side validation while preserving imported history.';
