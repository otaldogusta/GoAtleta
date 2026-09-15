-- Retain legacy user-entered contacts, but never mark them verified.
insert into private.security_contact_verifications(user_id,email)
select id, lower(trim(raw_user_meta_data->>'security_contact_email')) from auth.users
where nullif(trim(raw_user_meta_data->>'security_contact_email'),'') is not null
on conflict (user_id) do nothing;

-- Explicit service-only policy; no client table privileges or policies.
create policy security_contact_service_only on private.security_contact_verifications
for all to service_role using (true) with check (true);
