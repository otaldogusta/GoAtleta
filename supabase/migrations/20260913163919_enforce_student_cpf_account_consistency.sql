-- CPF identifies the athlete, not their institution or guardian.
-- Timestamp matches the applied Supabase migration history.
-- Same athlete account may have records in multiple organizations.
-- Different athlete accounts must not share a non-null CPF fingerprint.
-- This exclusion constraint also protects concurrent inserts/updates and invite claims.
create extension if not exists btree_gist with schema extensions;

alter table public.students
  add constraint students_cpf_athlete_account_excl
  exclude using gist (cpf_hmac with =, student_user_id with <>)
  where (cpf_hmac is not null and student_user_id is not null);
