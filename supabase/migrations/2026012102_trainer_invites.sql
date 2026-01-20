create table if not exists public.trainer_invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  expires_at timestamptz,
  max_uses integer not null default 1,
  uses integer not null default 0,
  revoked boolean not null default false
);

alter table public.trainer_invites enable row level security;

drop policy if exists "trainer_invites select own" on public.trainer_invites;
create policy "trainer_invites select own" on public.trainer_invites
  for select
  using (created_by = auth.uid());

drop policy if exists "trainer_invites insert trainer" on public.trainer_invites;
create policy "trainer_invites insert trainer" on public.trainer_invites
  for insert
  with check (is_trainer() and created_by = auth.uid());

drop policy if exists "trainer_invites update trainer" on public.trainer_invites;
create policy "trainer_invites update trainer" on public.trainer_invites
  for update
  using (is_trainer() and created_by = auth.uid())
  with check (is_trainer() and created_by = auth.uid());

revoke all on table public.trainer_invites from anon;
grant select, insert, update on table public.trainer_invites to authenticated;
