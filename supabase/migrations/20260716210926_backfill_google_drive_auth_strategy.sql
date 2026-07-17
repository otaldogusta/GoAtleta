-- Rows created before auth_strategy existed may already contain an encrypted
-- OAuth refresh token. Preserve that connection by classifying it explicitly.

update public.google_drive_connections
set
  auth_strategy = 'oauth_user',
  token_updated_at = coalesce(token_updated_at, updated_at, created_at)
where
  refresh_token_ciphertext is not null
  and refresh_token_iv is not null
  and auth_strategy <> 'oauth_user';
