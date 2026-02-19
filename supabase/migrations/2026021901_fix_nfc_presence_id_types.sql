-- Hotfix: align NFC IDs with existing app schema (students/classes use text IDs like s_* and c_*)

alter table if exists public.nfc_tag_bindings
  alter column student_id type text using student_id::text;

alter table if exists public.attendance_checkins
  alter column student_id type text using student_id::text;

alter table if exists public.attendance_checkins
  alter column class_id type text using class_id::text;

alter table if exists public.nfc_tag_bindings
  drop constraint if exists nfc_tag_bindings_student_id_fkey;

alter table if exists public.nfc_tag_bindings
  add constraint nfc_tag_bindings_student_id_fkey
  foreign key (student_id)
  references public.students(id)
  on delete cascade
  not valid;

alter table if exists public.attendance_checkins
  drop constraint if exists attendance_checkins_student_id_fkey;

alter table if exists public.attendance_checkins
  add constraint attendance_checkins_student_id_fkey
  foreign key (student_id)
  references public.students(id)
  on delete cascade
  not valid;

alter table if exists public.attendance_checkins
  drop constraint if exists attendance_checkins_class_id_fkey;

alter table if exists public.attendance_checkins
  add constraint attendance_checkins_class_id_fkey
  foreign key (class_id)
  references public.classes(id)
  on delete set null
  not valid;

create index if not exists nfc_tag_bindings_org_student_idx
  on public.nfc_tag_bindings (organization_id, student_id);

create index if not exists attendance_checkins_org_student_time_idx
  on public.attendance_checkins (organization_id, student_id, checked_in_at desc);
