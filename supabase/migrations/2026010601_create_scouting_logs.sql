create table if not exists public.units (
  id text primary key,
  name text not null,
  address text,
  notes text,
  createdat timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.classes (
  id text primary key,
  name text not null,
  unit text not null default '',
  unit_id text,
  color_key text,
  modality text not null default 'fitness',
  ageband text not null,
  gender text not null default 'misto',
  starttime text,
  end_time text,
  duration int,
  days jsonb not null default '[]'::jsonb,
  daysperweek int not null default 0,
  goal text not null default '',
  equipment text not null default '',
  level int not null default 1,
  mv_level text,
  cycle_start_date date,
  cycle_length_weeks int,
  acwr_low numeric not null default 0.8,
  acwr_high numeric not null default 1.3,
  createdat timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.students (
  id text primary key,
  name text not null,
  classid text not null,
  age int not null default 0,
  phone text not null default '',
  birthdate date,
  createdat timestamptz not null default now()
);

create table if not exists public.training_plans (
  id text primary key,
  classid text not null,
  title text not null default '',
  tags jsonb not null default '[]'::jsonb,
  warmup jsonb not null default '[]'::jsonb,
  main jsonb not null default '[]'::jsonb,
  cooldown jsonb not null default '[]'::jsonb,
  warmuptime text not null default '',
  maintime text not null default '',
  cooldowntime text not null default '',
  applydays int[] not null default '{}',
  applydate date,
  createdat timestamptz not null default now()
);

create table if not exists public.training_templates (
  id text primary key,
  title text not null default '',
  ageband text not null default '',
  tags text[] not null default '{}',
  warmup text[] not null default '{}',
  main text[] not null default '{}',
  cooldown text[] not null default '{}',
  warmuptime text not null default '',
  maintime text not null default '',
  cooldowntime text not null default '',
  createdat timestamptz not null default now()
);

create table if not exists public.training_template_hides (
  id text primary key,
  templateid text not null,
  createdat timestamptz not null default now()
);

create table if not exists public.class_plans (
  id text primary key,
  classid text not null,
  startdate date not null,
  weeknumber int not null,
  phase text not null default '',
  theme text not null default '',
  technical_focus text not null default '',
  physical_focus text not null default '',
  constraints text not null default '',
  mv_format text not null default '',
  warmupprofile text not null default '',
  source text not null default '',
  createdat timestamptz not null default now(),
  updatedat timestamptz
);

create table if not exists public.attendance_logs (
  id text primary key,
  classid text not null,
  studentid text not null,
  date date not null,
  status text not null default 'presente',
  note text not null default '',
  pain_score int,
  createdat timestamptz not null default now()
);

create table if not exists public.exercises (
  id text primary key,
  title text not null default '',
  tags text[] not null default '{}',
  videourl text,
  source text,
  description text,
  publishedat text,
  notes text,
  createdat timestamptz not null default now()
);

create table if not exists public.session_logs (
  id text primary key,
  classid text not null,
  rpe int not null default 0,
  technique text not null default 'nenhum',
  attendance int not null default 0,
  activity text,
  conclusion text,
  participants_count int,
  photos text,
  pain_score int,
  createdat timestamptz not null default now()
);

create table if not exists public.student_scouting_logs (
  id text primary key,
  studentid text not null,
  classid text not null,
  date date not null,
  serve_0 int not null default 0,
  serve_1 int not null default 0,
  serve_2 int not null default 0,
  receive_0 int not null default 0,
  receive_1 int not null default 0,
  receive_2 int not null default 0,
  set_0 int not null default 0,
  set_1 int not null default 0,
  set_2 int not null default 0,
  attack_send_0 int not null default 0,
  attack_send_1 int not null default 0,
  attack_send_2 int not null default 0,
  createdat timestamptz not null default now(),
  updatedat timestamptz
);

create table if not exists public.scouting_logs (
  id text primary key,
  classid text not null,
  unit text,
  date date not null,
  serve_0 int not null default 0,
  serve_1 int not null default 0,
  serve_2 int not null default 0,
  receive_0 int not null default 0,
  receive_1 int not null default 0,
  receive_2 int not null default 0,
  set_0 int not null default 0,
  set_1 int not null default 0,
  set_2 int not null default 0,
  attack_send_0 int not null default 0,
  attack_send_1 int not null default 0,
  attack_send_2 int not null default 0,
  createdat timestamptz not null default now(),
  updatedat timestamptz
);

create index if not exists scouting_logs_classid_idx on public.scouting_logs (classid);
create index if not exists scouting_logs_date_idx on public.scouting_logs (date);
