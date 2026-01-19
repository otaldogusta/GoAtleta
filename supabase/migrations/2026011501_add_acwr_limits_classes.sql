alter table if exists public.classes
add column if not exists acwr_low numeric not null default 0.8;

alter table if exists public.classes
add column if not exists acwr_high numeric not null default 1.3;
