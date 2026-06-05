create table if not exists public.scouting_sessions (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  classid text not null,
  type text not null default 'treino' check (type in ('treino', 'amistoso', 'jogo')),
  date date not null,
  title text not null default '',
  opponent text,
  initial_note text,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluido')),
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.scouting_actions (
  id text primary key,
  session_id text not null references public.scouting_sessions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  classid text not null,
  student_id text,
  athlete_name text,
  fundamental text not null check (
    fundamental in (
      'saque',
      'recepcao',
      'levantamento',
      'ataque',
      'bloqueio',
      'defesa',
      'cobertura',
      'transicao',
      'comunicacao'
    )
  ),
  phase text not null check (phase in ('saque', 'side_out', 'transicao', 'pressao', 'freeball')),
  result_key text not null,
  result_label text not null,
  result_level int not null check (result_level between 0 and 3),
  createdat timestamptz not null default now()
);

create index if not exists scouting_sessions_org_class_date_idx
  on public.scouting_sessions (organization_id, classid, date desc);
create index if not exists scouting_sessions_org_class_status_idx
  on public.scouting_sessions (organization_id, classid, status);
create index if not exists scouting_actions_session_created_idx
  on public.scouting_actions (session_id, createdat desc);
create index if not exists scouting_actions_org_class_created_idx
  on public.scouting_actions (organization_id, classid, createdat desc);

alter table public.scouting_sessions enable row level security;
drop policy if exists "scouting_sessions select trainer" on public.scouting_sessions;
create policy "scouting_sessions select trainer" on public.scouting_sessions
  for select
  using (
    public.is_org_admin(scouting_sessions.organization_id)
    or public.is_class_staff(scouting_sessions.classid)
  );
drop policy if exists "scouting_sessions insert trainer" on public.scouting_sessions;
create policy "scouting_sessions insert trainer" on public.scouting_sessions
  for insert
  with check (
    public.is_org_admin(scouting_sessions.organization_id)
    or public.is_class_staff(scouting_sessions.classid)
  );
drop policy if exists "scouting_sessions update trainer" on public.scouting_sessions;
create policy "scouting_sessions update trainer" on public.scouting_sessions
  for update
  using (
    public.is_org_admin(scouting_sessions.organization_id)
    or public.is_class_staff(scouting_sessions.classid)
  )
  with check (
    public.is_org_admin(scouting_sessions.organization_id)
    or public.is_class_staff(scouting_sessions.classid)
  );
drop policy if exists "scouting_sessions delete trainer" on public.scouting_sessions;
create policy "scouting_sessions delete trainer" on public.scouting_sessions
  for delete
  using (public.is_org_admin(scouting_sessions.organization_id));

alter table public.scouting_actions enable row level security;
drop policy if exists "scouting_actions select trainer" on public.scouting_actions;
create policy "scouting_actions select trainer" on public.scouting_actions
  for select
  using (
    public.is_org_admin(scouting_actions.organization_id)
    or public.is_class_staff(scouting_actions.classid)
  );
drop policy if exists "scouting_actions insert trainer" on public.scouting_actions;
create policy "scouting_actions insert trainer" on public.scouting_actions
  for insert
  with check (
    public.is_org_admin(scouting_actions.organization_id)
    or public.is_class_staff(scouting_actions.classid)
  );
drop policy if exists "scouting_actions update trainer" on public.scouting_actions;
create policy "scouting_actions update trainer" on public.scouting_actions
  for update
  using (
    public.is_org_admin(scouting_actions.organization_id)
    or public.is_class_staff(scouting_actions.classid)
  )
  with check (
    public.is_org_admin(scouting_actions.organization_id)
    or public.is_class_staff(scouting_actions.classid)
  );
drop policy if exists "scouting_actions delete trainer" on public.scouting_actions;
create policy "scouting_actions delete trainer" on public.scouting_actions
  for delete
  using (
    public.is_org_admin(scouting_actions.organization_id)
    or public.is_class_staff(scouting_actions.classid)
  );

revoke all on table public.scouting_sessions from anon;
revoke all on table public.scouting_actions from anon;
grant select, insert, update, delete on table public.scouting_sessions to authenticated;
grant select, insert, update, delete on table public.scouting_actions to authenticated;
