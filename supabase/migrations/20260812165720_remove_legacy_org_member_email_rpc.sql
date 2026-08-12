-- The unified coordination workspace is now the only supported member-access
-- flow. Remove the legacy e-mail RPC after the compatible frontend release.
drop function if exists public.admin_add_org_member_by_email(uuid, text, int);
