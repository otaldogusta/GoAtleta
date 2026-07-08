create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  action_url text null,
  source_type text null,
  source_id text null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (
    type in (
      'training_created',
      'training_saved',
      'birthday',
      'consultation_event',
      'absence_notice_created',
      'absence_notice_status_changed',
      'regulation_updated',
      'generic'
    )
  ),
  constraint notifications_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create index if not exists notifications_recipient_unread_created_idx
  on public.notifications (recipient_user_id, read_at, created_at desc);

create index if not exists notifications_org_created_idx
  on public.notifications (organization_id, created_at desc);

create index if not exists notifications_source_idx
  on public.notifications (source_type, source_id);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications
  for select
  to authenticated
  using (
    recipient_user_id = (select auth.uid())
    and public.is_org_member(organization_id)
  );

drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own"
  on public.notifications
  for insert
  to authenticated
  with check (
    recipient_user_id = (select auth.uid())
    and public.is_org_member(organization_id)
  );

drop policy if exists "notifications_update_read_own" on public.notifications;
create policy "notifications_update_read_own"
  on public.notifications
  for update
  to authenticated
  using (
    recipient_user_id = (select auth.uid())
    and public.is_org_member(organization_id)
  )
  with check (
    recipient_user_id = (select auth.uid())
    and public.is_org_member(organization_id)
  );

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications
  for delete
  to authenticated
  using (
    recipient_user_id = (select auth.uid())
    and public.is_org_member(organization_id)
  );

revoke all on table public.notifications from anon;
revoke all on table public.notifications from authenticated;
grant select, insert, delete on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
