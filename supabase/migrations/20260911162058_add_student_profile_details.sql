alter table public.students
  add column if not exists address text,
  add column if not exists gender_identity text;

comment on column public.students.address is
  'Self-reported postal address for the athlete profile.';

comment on column public.students.gender_identity is
  'Optional self-reported gender identity displayed in the athlete profile.';
