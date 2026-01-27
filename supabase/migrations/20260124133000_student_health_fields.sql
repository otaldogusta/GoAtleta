alter table if exists public.students
  add column if not exists health_issue boolean,
  add column if not exists health_issue_notes text,
  add column if not exists medication_use boolean,
  add column if not exists medication_notes text,
  add column if not exists health_observations text;
