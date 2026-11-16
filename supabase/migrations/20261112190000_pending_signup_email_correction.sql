create table public.signup_email_correction_limits (
  signup_id uuid primary key references auth.users (id) on delete cascade,
  window_started_at timestamptz not null,
  attempts integer not null check (attempts between 1 and 5)
);

alter table public.signup_email_correction_limits enable row level security;
revoke all on table public.signup_email_correction_limits from public, anon, authenticated;

create function public.prepare_pending_signup_email_correction(
  p_user_id uuid,
  p_current_email text,
  p_new_email text,
  p_request_code boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source auth.users%rowtype;
  v_target auth.users%rowtype;
  v_signup_id uuid;
  v_attempts integer;
  v_now timestamptz := statement_timestamp();
begin
  if p_new_email is null or length(p_new_email) > 320
    or p_new_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_new_email <> lower(p_new_email) or p_new_email = p_current_email then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_source from auth.users where id = p_user_id for share;
  if not found or v_source.email is distinct from p_current_email
    or v_source.is_anonymous or v_source.is_sso_user
    or v_source.deleted_at is not null or v_source.banned_until > v_now
    or v_source.raw_app_meta_data ->> 'provider' is distinct from 'email'
    or v_source.raw_app_meta_data -> 'providers' is distinct from '["email"]'::jsonb
    or v_source.raw_app_meta_data ->> 'staff_invite_setup_required' = 'true'
    or nullif(btrim(v_source.raw_app_meta_data ->> 'email_verified_hybrid_at'), '') is not null
    or v_source.encrypted_password is null or v_source.encrypted_password = '' then
    return jsonb_build_object('status', 'denied');
  end if;

  if p_request_code then
    v_signup_id := coalesce((v_source.raw_app_meta_data ->> 'signup_email_correction_origin')::uuid, v_source.id);
    -- If the original pending account was removed, use the current pending identity.
    perform 1 from auth.users where id = v_signup_id for key share;
    if not found then v_signup_id := v_source.id; end if;

    insert into public.signup_email_correction_limits as limits (signup_id, window_started_at, attempts)
      values (v_signup_id, v_now, 1)
    on conflict (signup_id) do update
      set attempts = case when limits.window_started_at <= v_now - interval '10 minutes' then 1 else limits.attempts + 1 end,
          window_started_at = case when limits.window_started_at <= v_now - interval '10 minutes' then v_now else limits.window_started_at end
      where limits.attempts < 5 or limits.window_started_at <= v_now - interval '10 minutes'
    returning attempts into v_attempts;
    if v_attempts is null then return jsonb_build_object('status', 'limited'); end if;

  end if;

  select * into v_target from auth.users
    where email = p_new_email and deleted_at is null
    order by is_sso_user nulls last limit 1;
  if v_target.id is not null then
    if v_target.raw_app_meta_data ->> 'signup_email_correction_source' is distinct from p_user_id::text
      or v_target.raw_app_meta_data ->> 'provider' is distinct from 'email'
      or v_target.raw_app_meta_data -> 'providers' is distinct from '["email"]'::jsonb
      or v_target.raw_app_meta_data ->> 'staff_invite_setup_required' = 'true'
      or coalesce(v_target.encrypted_password, '') <> ''
      or v_target.is_anonymous or v_target.is_sso_user or v_target.banned_until > v_now
      or nullif(btrim(v_target.raw_app_meta_data ->> 'email_verified_hybrid_at'), '') is not null then
      return jsonb_build_object('status', 'conflict');
    end if;
    return jsonb_build_object('status', 'ready', 'candidate_id', v_target.id);
  end if;
  if not p_request_code then return jsonb_build_object('status', 'denied'); end if;
  return jsonb_build_object(
    'status', 'ready', 'origin_id', v_signup_id,
    'full_name', left(v_source.raw_user_meta_data ->> 'full_name', 160)
  );
end;
$$;

revoke all on function public.prepare_pending_signup_email_correction(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.prepare_pending_signup_email_correction(uuid, text, text, boolean) to service_role;

-- Auth may generate a random password when admin.createUser omits it.
-- Clear it only on the freshly created, still unconfirmed candidate.
create function public.clear_signup_email_candidate_password(
  p_candidate_id uuid, p_source_id uuid, p_email text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
    set encrypted_password = null, updated_at = statement_timestamp()
  where id = p_candidate_id and id <> p_source_id and email = p_email
    and email_confirmed_at is null and last_sign_in_at is null
    and deleted_at is null and not is_anonymous and not is_sso_user
    and raw_app_meta_data ->> 'provider' = 'email'
    and raw_app_meta_data -> 'providers' = '["email"]'::jsonb
    and raw_app_meta_data ->> 'signup_email_correction_source' = p_source_id::text
    and nullif(btrim(raw_app_meta_data ->> 'email_verified_hybrid_at'), '') is null;

  return found;
end;
$$;

revoke all on function public.clear_signup_email_candidate_password(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.clear_signup_email_candidate_password(uuid, uuid, text) to service_role;

-- Called only after the Edge has verified the mailbox code with Auth.
-- Update the password and trusted proof in one statement, conditional on the
-- source still being pending and the target still being an email-only candidate.
create function public.finish_pending_signup_email_correction(
  p_source_id uuid, p_source_email text, p_target_id uuid, p_target_email text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_password text;
begin
  select encrypted_password into v_password
  from auth.users where id = p_source_id and email = p_source_email
    and deleted_at is null and not is_anonymous and not is_sso_user
    and (banned_until is null or banned_until <= statement_timestamp())
    and raw_app_meta_data ->> 'provider' = 'email'
    and raw_app_meta_data -> 'providers' = '["email"]'::jsonb
    and raw_app_meta_data ->> 'staff_invite_setup_required' is distinct from 'true'
    and nullif(btrim(raw_app_meta_data ->> 'email_verified_hybrid_at'), '') is null
  for share;

  if coalesce(v_password, '') = '' then return false; end if;

  update auth.users
    set encrypted_password = v_password,
        raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
          'email_verified_hybrid_at', statement_timestamp(), 'email_verification_source', 'otp'
        ),
        updated_at = statement_timestamp()
  where id = p_target_id and id <> p_source_id and email = p_target_email
    and email_confirmed_at is not null and coalesce(encrypted_password, '') = ''
    and deleted_at is null and not is_anonymous and not is_sso_user
    and (banned_until is null or banned_until <= statement_timestamp())
    and raw_app_meta_data ->> 'provider' = 'email'
    and raw_app_meta_data -> 'providers' = '["email"]'::jsonb
    and raw_app_meta_data ->> 'signup_email_correction_source' = p_source_id::text
    and raw_app_meta_data ->> 'staff_invite_setup_required' is distinct from 'true'
    and nullif(btrim(raw_app_meta_data ->> 'email_verified_hybrid_at'), '') is null;

  return found;
end;
$$;

revoke all on function public.finish_pending_signup_email_correction(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.finish_pending_signup_email_correction(uuid, text, uuid, text) to service_role;
