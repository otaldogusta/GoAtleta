create extension if not exists pgcrypto;

alter table if exists public.students
  add column if not exists cpf_input text null,
  add column if not exists cpf_masked text null,
  add column if not exists cpf_hmac text null,
  add column if not exists rg text null,
  add column if not exists is_experimental boolean not null default false,
  add column if not exists source_pre_registration_id text null;

create or replace function public.students_apply_documents_fields()
returns trigger
language plpgsql
as $$
declare
  digits text;
  secret text;
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
    else
      if length(digits) <> 11 then
        raise exception 'INVALID_CPF_FORMAT' using errcode = '22000';
      end if;
      secret := nullif(public.get_student_cpf_hmac_secret(), '');
      if secret is null then
        raise exception 'MISSING_CPF_HMAC_SECRET' using errcode = '22000';
      end if;
      new.cpf_masked := format('***.***.***-%s', right(digits, 2));
      new.cpf_hmac := encode(hmac(digits, secret, 'sha256'), 'hex');
    end if;
    new.cpf_input := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_students_apply_documents_fields on public.students;
create trigger trg_students_apply_documents_fields
before insert or update on public.students
for each row
execute function public.students_apply_documents_fields();

create unique index if not exists students_org_cpf_hmac_uidx
  on public.students (organization_id, cpf_hmac)
  where cpf_hmac is not null;

create index if not exists students_org_rg_normalized_idx
  on public.students (organization_id, rg_normalized)
  where rg_normalized is not null;
