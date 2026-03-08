create extension if not exists pgcrypto;

create schema if not exists private;

create table if not exists private.app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create or replace function public.get_student_cpf_hmac_secret()
returns text
language sql
security definer
set search_path = public, private, extensions
stable
as $$
  select value
  from private.app_secrets
  where key = 'student_cpf_hmac_secret'
  limit 1;
$$;

create or replace function public.get_student_cpf_enc_secret()
returns text
language sql
security definer
set search_path = public, private, extensions
stable
as $$
  select value
  from private.app_secrets
  where key = 'student_cpf_enc_secret'
  limit 1;
$$;

revoke all on function public.get_student_cpf_hmac_secret() from public;
revoke all on function public.get_student_cpf_enc_secret() from public;
grant execute on function public.get_student_cpf_hmac_secret() to authenticated, service_role;
grant execute on function public.get_student_cpf_enc_secret() to authenticated, service_role;

alter table if exists public.students
  add column if not exists cpf_encrypted bytea null,
  add column if not exists cpf_encryption_version smallint null;

create table if not exists public.sensitive_data_access_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource_type text not null,
  resource_id text not null,
  field_name text not null,
  reason text not null,
  legal_basis text null,
  created_at timestamptz not null default now()
);

create index if not exists sensitive_access_org_created_idx
  on public.sensitive_data_access_logs (organization_id, created_at desc);

create index if not exists sensitive_access_actor_created_idx
  on public.sensitive_data_access_logs (actor_user_id, created_at desc);

alter table public.sensitive_data_access_logs enable row level security;

drop policy if exists "sensitive_data_access_logs_select_admin" on public.sensitive_data_access_logs;
create policy "sensitive_data_access_logs_select_admin"
  on public.sensitive_data_access_logs
  for select
  using (public.is_org_admin(organization_id));

create or replace function public.students_apply_documents_fields()
returns trigger
language plpgsql
as $$
declare
  digits text;
  hmac_secret text;
  enc_secret text;
begin
  if new.rg is not null then
    new.rg := nullif(trim(new.rg), '');
  end if;

  if new.rg is not null then
    new.rg_normalized := nullif(upper(regexp_replace(new.rg, '[^A-Za-z0-9]', '', 'g')), '');
  elsif new.rg_normalized is not null then
    new.rg_normalized := nullif(upper(regexp_replace(new.rg_normalized, '[^A-Za-z0-9]', '', 'g')), '');
  end if;

  if new.cpf_input is not null then
    digits := regexp_replace(coalesce(new.cpf_input, ''), '\D', '', 'g');
    if digits = '' then
      new.cpf_masked := null;
      new.cpf_hmac := null;
      new.cpf_encrypted := null;
      new.cpf_encryption_version := null;
    else
      if length(digits) <> 11 then
        raise exception 'INVALID_CPF_FORMAT' using errcode = '22000';
      end if;
      hmac_secret := nullif(public.get_student_cpf_hmac_secret(), '');
      if hmac_secret is null then
        raise exception 'MISSING_CPF_HMAC_SECRET' using errcode = '22000';
      end if;
      new.cpf_masked := format('***.***.***-%s', right(digits, 2));
      new.cpf_hmac := encode(hmac(digits, hmac_secret, 'sha256'), 'hex');

      enc_secret := nullif(public.get_student_cpf_enc_secret(), '');
      if enc_secret is not null then
        new.cpf_encrypted := pgp_sym_encrypt(digits, enc_secret);
        new.cpf_encryption_version := 1;
      else
        new.cpf_encrypted := null;
        new.cpf_encryption_version := null;
      end if;
    end if;
    new.cpf_input := null;
  end if;

  return new;
end;
$$;

create or replace function public.reveal_student_cpf(
  p_student_id text,
  p_reason text,
  p_legal_basis text default null
)
returns table (cpf text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  actor_id uuid;
  student_org_id uuid;
  encrypted_value bytea;
  secret text;
  reason_clean text;
begin
  actor_id := auth.uid();
  reason_clean := nullif(trim(coalesce(p_reason, '')), '');

  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if reason_clean is null then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;

  select s.organization_id, s.cpf_encrypted
    into student_org_id, encrypted_value
  from public.students s
  where s.id = p_student_id
  limit 1;

  if student_org_id is null then
    raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not public.is_org_admin(student_org_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if encrypted_value is null then
    raise exception 'CPF_NOT_AVAILABLE' using errcode = '22023';
  end if;

  secret := nullif(public.get_student_cpf_enc_secret(), '');
  if secret is null then
    raise exception 'MISSING_CPF_ENC_SECRET' using errcode = '22000';
  end if;

  insert into public.sensitive_data_access_logs (
    actor_user_id,
    organization_id,
    resource_type,
    resource_id,
    field_name,
    reason,
    legal_basis
  ) values (
    actor_id,
    student_org_id,
    'student',
    p_student_id,
    'cpf',
    reason_clean,
    nullif(trim(coalesce(p_legal_basis, '')), '')
  );

  return query
  select pgp_sym_decrypt(encrypted_value, secret) as cpf;
end;
$$;

revoke all on function public.reveal_student_cpf(text, text, text) from public;
grant execute on function public.reveal_student_cpf(text, text, text) to authenticated, service_role;
