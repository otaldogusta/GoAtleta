alter table public.students
  add column if not exists ra text null,
  add column if not exists ra_start_year integer null;

create unique index if not exists students_org_ra_uidx
  on public.students (organization_id, ra)
  where ra is not null and btrim(ra) <> '';

create index if not exists students_org_ra_start_year_idx
  on public.students (organization_id, ra_start_year)
  where ra_start_year is not null;
