-- Remove broad default privileges inherited by this older project.
revoke all on table public.institutional_profiles from anon, authenticated;
grant select, insert, update, delete on table public.institutional_profiles
  to authenticated;
