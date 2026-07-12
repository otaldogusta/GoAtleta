alter table public.google_drive_oauth_states
  alter column expires_at set default (now() + interval '30 minutes');

delete from public.google_drive_oauth_states where expires_at <= now();
