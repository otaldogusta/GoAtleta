alter table public.user_profiles
  add column if not exists birth_date date null,
  add column if not exists cpf_masked text null,
  add column if not exists cpf_encrypted bytea null,
  add column if not exists cpf_encryption_version smallint null,
  add column if not exists rg text null,
  add column if not exists address text null,
  add column if not exists gender_identity text null;

create or replace function public.get_my_professional_profile()
returns table (
  birth_date date,
  cpf_masked text,
  rg text,
  address text,
  gender_identity text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  return query
  select
    profile.birth_date,
    profile.cpf_masked,
    profile.rg,
    profile.address,
    profile.gender_identity
  from public.user_profiles profile
  where profile.user_id = (select auth.uid())
  limit 1;
end;
$$;

create or replace function public.save_my_professional_profile(
  p_birth_date date,
  p_cpf_input text default null,
  p_rg text default null,
  p_address text default null,
  p_gender_identity text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  cpf_digits text;
  cpf_masked_value text;
  cpf_encrypted_value bytea;
  cpf_encryption_version_value smallint;
  encryption_secret text;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_birth_date is null or p_birth_date > current_date then
    raise exception 'INVALID_BIRTH_DATE' using errcode = '22023';
  end if;

  if p_cpf_input is not null then
    cpf_digits := regexp_replace(coalesce(p_cpf_input, ''), '\D', '', 'g');
    if cpf_digits = '' then
      cpf_masked_value := null;
      cpf_encrypted_value := null;
      cpf_encryption_version_value := null;
    else
      if length(cpf_digits) <> 11 then
        raise exception 'INVALID_CPF_FORMAT' using errcode = '22023';
      end if;
      encryption_secret := nullif(public.get_student_cpf_enc_secret(), '');
      if encryption_secret is null then
        raise exception 'MISSING_CPF_ENC_SECRET' using errcode = '55000';
      end if;
      cpf_masked_value := format('***.***.***-%s', right(cpf_digits, 2));
      cpf_encrypted_value := extensions.pgp_sym_encrypt(cpf_digits, encryption_secret);
      cpf_encryption_version_value := 1;
    end if;
  end if;

  insert into public.user_profiles (
    user_id,
    birth_date,
    cpf_masked,
    cpf_encrypted,
    cpf_encryption_version,
    rg,
    address,
    gender_identity,
    updated_at
  ) values (
    actor_id,
    p_birth_date,
    cpf_masked_value,
    cpf_encrypted_value,
    cpf_encryption_version_value,
    nullif(trim(coalesce(p_rg, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_gender_identity, '')), ''),
    now()
  )
  on conflict (user_id) do update set
    birth_date = excluded.birth_date,
    cpf_masked = case when p_cpf_input is null then public.user_profiles.cpf_masked else excluded.cpf_masked end,
    cpf_encrypted = case when p_cpf_input is null then public.user_profiles.cpf_encrypted else excluded.cpf_encrypted end,
    cpf_encryption_version = case when p_cpf_input is null then public.user_profiles.cpf_encryption_version else excluded.cpf_encryption_version end,
    rg = excluded.rg,
    address = excluded.address,
    gender_identity = excluded.gender_identity,
    updated_at = now();
end;
$$;

revoke all on function public.get_my_professional_profile() from public, anon, authenticated;
revoke all on function public.save_my_professional_profile(date, text, text, text, text) from public, anon, authenticated;
grant execute on function public.get_my_professional_profile() to authenticated;
grant execute on function public.save_my_professional_profile(date, text, text, text, text) to authenticated;
