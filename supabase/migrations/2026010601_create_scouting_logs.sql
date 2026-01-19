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
