-- NFC1.4: server-side idempotency for attendance_checkins

alter table if exists public.attendance_checkins
  add column if not exists idempotency_key text;

update public.attendance_checkins
set idempotency_key =
  organization_id::text ||
  ':' ||
  coalesce(class_id, '__none__') ||
  ':' ||
  student_id ||
  ':' ||
  ((checked_in_at at time zone 'utc')::date)::text
where coalesce(idempotency_key, '') = '';

with ranked as (
  select
    id,
    row_number() over (
      partition by
        organization_id,
        coalesce(class_id, '__none__'),
        student_id,
        (checked_in_at at time zone 'utc')::date
      order by checked_in_at desc, id desc
    ) as rn
  from public.attendance_checkins
)
delete from public.attendance_checkins target
using ranked source
where target.id = source.id
  and source.rn > 1;

alter table if exists public.attendance_checkins
  alter column idempotency_key set not null;

create unique index if not exists attendance_checkins_idempotency_key_uidx
  on public.attendance_checkins (idempotency_key);

