create or replace function public.students_apply_documents_fields()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
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

revoke execute on function public.students_apply_documents_fields() from public;
revoke execute on function public.students_apply_documents_fields() from anon;
revoke execute on function public.students_apply_documents_fields() from authenticated;

revoke execute on function public.get_student_cpf_hmac_secret() from public;
revoke execute on function public.get_student_cpf_hmac_secret() from anon;
revoke execute on function public.get_student_cpf_hmac_secret() from authenticated;

revoke execute on function public.get_student_cpf_enc_secret() from public;
revoke execute on function public.get_student_cpf_enc_secret() from anon;
revoke execute on function public.get_student_cpf_enc_secret() from authenticated;

grant execute on function public.get_student_cpf_hmac_secret() to service_role;
grant execute on function public.get_student_cpf_enc_secret() to service_role;
