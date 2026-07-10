-- organization_ai_profiles is a temporary compatibility fallback.
-- Keep reads for the authenticated Edge Function client and service tooling,
-- but prevent every Data API role from changing legacy rows.
alter table public.organization_ai_profiles enable row level security;

drop policy if exists organization_ai_profiles_insert_admin
  on public.organization_ai_profiles;
drop policy if exists organization_ai_profiles_update_admin
  on public.organization_ai_profiles;
drop policy if exists organization_ai_profiles_delete_admin
  on public.organization_ai_profiles;

revoke all privileges on table public.organization_ai_profiles
  from anon, authenticated, service_role;
grant select on table public.organization_ai_profiles
  to authenticated, service_role;
