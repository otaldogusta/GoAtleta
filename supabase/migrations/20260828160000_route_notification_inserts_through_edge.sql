-- Notification content is created only by the authenticated Edge Function.
-- Clients retain caller-owned read/archive/delete access, but cannot forge rows.

drop policy if exists "notifications_insert_own" on public.notifications;

revoke insert on table public.notifications from anon, authenticated;

revoke all on table public.push_tokens from anon;
