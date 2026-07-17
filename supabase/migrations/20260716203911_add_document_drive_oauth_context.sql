-- Completes the Google Drive connection contract that was introduced with the
-- document-intelligence foundation. OAuth state remains server-only and
-- refresh tokens stay encrypted in google_drive_connections.

alter table public.google_drive_connections
  add column if not exists auth_strategy text not null default 'api_key',
  add column if not exists token_updated_at timestamptz;

alter table public.google_drive_connections
  drop constraint if exists google_drive_connections_auth_strategy_check,
  add constraint google_drive_connections_auth_strategy_check
    check (auth_strategy in ('api_key', 'oauth_user', 'service_account'));

alter table public.google_drive_oauth_states
  add column if not exists connection_scope text not null default 'user_academic',
  add column if not exists sync_root_folder_id text,
  add column if not exists source_profile text not null default 'academic',
  add column if not exists academic_scope text,
  add column if not exists bound_class_id text references public.classes(id) on delete restrict,
  add column if not exists class_binding_confirmed boolean not null default false;

alter table public.google_drive_oauth_states
  drop constraint if exists google_drive_oauth_states_connection_scope_check,
  add constraint google_drive_oauth_states_connection_scope_check
    check (connection_scope in ('workspace', 'workspace_academic', 'user_academic')),
  drop constraint if exists google_drive_oauth_states_source_profile_check,
  add constraint google_drive_oauth_states_source_profile_check
    check (
      source_profile in (
        'academic',
        'institutional_actions',
        'monthly_plan',
        'report',
        'lesson_plan',
        'unknown'
      )
    ),
  drop constraint if exists google_drive_oauth_states_academic_scope_check,
  add constraint google_drive_oauth_states_academic_scope_check
    check (academic_scope is null or academic_scope in ('user', 'workspace')),
  drop constraint if exists google_drive_oauth_states_class_binding_check,
  add constraint google_drive_oauth_states_class_binding_check
    check (
      (
        bound_class_id is null
        and class_binding_confirmed = false
      )
      or (
        bound_class_id is not null
        and class_binding_confirmed = true
        and source_profile <> 'academic'
      )
    );

create index if not exists google_drive_oauth_states_expiry
  on public.google_drive_oauth_states(expires_at);

comment on column public.google_drive_connections.auth_strategy is
  'Credential strategy used by the last successful Drive connection without exposing credential material.';
comment on column public.google_drive_connections.token_updated_at is
  'Last time an encrypted OAuth refresh token was stored or rotated.';
comment on column public.google_drive_oauth_states.redirect_to is
  'Validated GoAtleta return URL. Never accepts arbitrary external origins.';
