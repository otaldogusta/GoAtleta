alter table public.notifications
  add column if not exists inbox_scope text not null default 'all';

alter table public.notifications
  drop constraint if exists notifications_inbox_scope_check;

alter table public.notifications
  add constraint notifications_inbox_scope_check
  check (inbox_scope in ('prof', 'coord', 'student', 'all'));

create index if not exists notifications_recipient_inbox_created_idx
  on public.notifications (
    organization_id,
    recipient_user_id,
    inbox_scope,
    created_at desc
  );

comment on column public.notifications.inbox_scope is
  'Caixa de destino do aviso: prof, coord, student ou all para comunicados compartilhados explicitamente.';
