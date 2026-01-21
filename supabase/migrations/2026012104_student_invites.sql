create table if not exists public.student_invites (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) default auth.uid(),
  expires_at timestamptz,
  used_at timestamptz,
  claimed_by uuid references auth.users(id),
  invited_via text not null default 'whatsapp',
  invited_to text,
  revoked boolean not null default false
);

alter table public.student_invites
  add constraint student_invites_invited_via_check
  check (invited_via in ('whatsapp', 'email', 'link'));

create index if not exists student_invites_student_id_idx
  on public.student_invites (student_id);

create index if not exists student_invites_expires_at_idx
  on public.student_invites (expires_at);

alter table public.student_invites enable row level security;

drop policy if exists "student_invites select own" on public.student_invites;
create policy "student_invites select own" on public.student_invites
  for select
  using (is_trainer() and created_by = auth.uid());

drop policy if exists "student_invites insert trainer" on public.student_invites;
create policy "student_invites insert trainer" on public.student_invites
  for insert
  with check (is_trainer() and created_by = auth.uid());

drop policy if exists "student_invites update trainer" on public.student_invites;
create policy "student_invites update trainer" on public.student_invites
  for update
  using (is_trainer() and created_by = auth.uid())
  with check (is_trainer() and created_by = auth.uid());

revoke all on table public.student_invites from anon;
grant select, insert, update on table public.student_invites to authenticated;
