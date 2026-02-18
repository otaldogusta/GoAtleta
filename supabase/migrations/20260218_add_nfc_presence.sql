-- PR-NFC1: UID-based NFC presence

create table if not exists public.nfc_tag_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  tag_uid text not null,
  binding_type text not null check (binding_type in ('student')),
  student_id uuid not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id, tag_uid)
);

create index if not exists nfc_tag_bindings_org_idx
  on public.nfc_tag_bindings (organization_id);

create table if not exists public.attendance_checkins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  class_id uuid,
  student_id uuid not null,
  tag_uid text not null,
  source text not null default 'nfc',
  checked_in_at timestamptz not null default now()
);

create index if not exists attendance_checkins_org_class_time_idx
  on public.attendance_checkins (organization_id, class_id, checked_in_at desc);

alter table public.nfc_tag_bindings enable row level security;
alter table public.attendance_checkins enable row level security;

drop policy if exists nfc_bindings_select on public.nfc_tag_bindings;
create policy nfc_bindings_select
on public.nfc_tag_bindings
for select
using (public.is_org_member(organization_id));

drop policy if exists nfc_bindings_insert on public.nfc_tag_bindings;
create policy nfc_bindings_insert
on public.nfc_tag_bindings
for insert
with check (public.is_org_admin(organization_id));

drop policy if exists nfc_checkins_select on public.attendance_checkins;
create policy nfc_checkins_select
on public.attendance_checkins
for select
using (public.is_org_member(organization_id));

drop policy if exists nfc_checkins_insert on public.attendance_checkins;
create policy nfc_checkins_insert
on public.attendance_checkins
for insert
with check (public.is_org_member(organization_id));

revoke all on table public.nfc_tag_bindings from anon;
revoke all on table public.attendance_checkins from anon;
grant select, insert on table public.nfc_tag_bindings to authenticated;
grant select, insert on table public.attendance_checkins to authenticated;
