-- Service-only ownership verification. No login or recovery identity changes.
create table private.security_contact_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text, verified_at timestamptz,
  pending_email text, code_hash text, expires_at timestamptz,
  sent_at timestamptz, attempts integer not null default 0,
  window_start timestamptz not null default now(), sends integer not null default 0
);
alter table private.security_contact_verifications enable row level security;
revoke all on private.security_contact_verifications from public, anon, authenticated;
grant all on private.security_contact_verifications to service_role;

create function public.security_contact_verification_service(
  p_user_id uuid, p_action text, p_email text default null, p_hash text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r private.security_contact_verifications%rowtype;
begin
  insert into private.security_contact_verifications(user_id) values (p_user_id) on conflict do nothing;
  select * into r from private.security_contact_verifications where user_id = p_user_id for update;
  if p_action = 'request' then
    if r.sent_at > now() - interval '60 seconds' or
       (r.window_start > now() - interval '1 hour' and r.sends >= 5) then
      return jsonb_build_object('error', 'Aguarde antes de solicitar outro código.');
    end if;
    if p_email is null or length(p_email) > 254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_hash !~ '^[a-f0-9]{64}$' or p_hash is null then
      return jsonb_build_object('error', 'Informe um e-mail válido.');
    end if;
    update private.security_contact_verifications set pending_email=p_email, code_hash=p_hash,
      expires_at=now()+interval '10 minutes', sent_at=now(), attempts=0,
      sends=case when window_start <= now()-interval '1 hour' then 1 else sends+1 end,
      window_start=case when window_start <= now()-interval '1 hour' then now() else window_start end
      where user_id=p_user_id;
  elsif p_action = 'verify' then
    if r.code_hash is null or r.expires_at <= now() or r.attempts >= 5 or r.pending_email is distinct from p_email then
      return jsonb_build_object('error', 'Código inválido ou expirado. Solicite outro código.');
    end if;
    if r.code_hash is distinct from p_hash then
      update private.security_contact_verifications set attempts=attempts+1 where user_id=p_user_id;
      return jsonb_build_object('error', 'Código inválido ou expirado.');
    end if;
    update private.security_contact_verifications set email=pending_email, verified_at=now(),
      pending_email=null, code_hash=null, expires_at=null where user_id=p_user_id;
  elsif p_action = 'delivery_failed' then
    update private.security_contact_verifications set code_hash=null, pending_email=null, expires_at=null
      where user_id=p_user_id and code_hash=p_hash;
  elsif p_action = 'remove' then
    update private.security_contact_verifications set email=null, verified_at=null,
      pending_email=null, code_hash=null, expires_at=null where user_id=p_user_id;
  elsif p_action <> 'status' then
    raise exception 'Invalid action';
  end if;
  select * into r from private.security_contact_verifications where user_id=p_user_id;
  return jsonb_build_object('email',r.email,'verifiedAt',r.verified_at,
    'pendingEmail',case when r.expires_at > now() then r.pending_email end,
    'retryAt',r.sent_at+interval '60 seconds');
end $$;
revoke all on function public.security_contact_verification_service(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.security_contact_verification_service(uuid,text,text,text) to service_role;
