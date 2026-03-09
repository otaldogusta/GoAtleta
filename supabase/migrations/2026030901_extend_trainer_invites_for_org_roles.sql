alter table public.trainer_invites
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists target_role_level int not null default 10,
  add column if not exists invited_via text not null default 'link',
  add column if not exists invited_to text,
  add column if not exists claimed_by uuid references auth.users(id),
  add column if not exists claimed_at timestamptz;

alter table public.trainer_invites
  drop constraint if exists trainer_invites_target_role_level_check;

alter table public.trainer_invites
  add constraint trainer_invites_target_role_level_check
  check (target_role_level in (10, 50));

alter table public.trainer_invites
  drop constraint if exists trainer_invites_invited_via_check;

alter table public.trainer_invites
  add constraint trainer_invites_invited_via_check
  check (invited_via in ('whatsapp', 'email', 'link'));

create index if not exists trainer_invites_org_id_idx
  on public.trainer_invites (organization_id, created_at desc);

create index if not exists trainer_invites_status_idx
  on public.trainer_invites (revoked, expires_at, uses, max_uses);
