-- Ensure client upserts can rely on auth context for user_id.

alter table if exists public.push_tokens
  alter column user_id set default auth.uid();

