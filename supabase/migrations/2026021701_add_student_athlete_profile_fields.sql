alter table public.students
  add column if not exists position_primary text not null default 'indefinido',
  add column if not exists position_secondary text not null default 'indefinido',
  add column if not exists athlete_objective text not null default 'base',
  add column if not exists learning_style text not null default 'misto';

create index if not exists idx_students_position_primary
  on public.students (position_primary);

create index if not exists idx_students_athlete_objective
  on public.students (athlete_objective);
