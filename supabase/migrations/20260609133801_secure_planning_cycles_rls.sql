create table if not exists public.planning_cycles (
  id text primary key,
  classid text not null references public.classes(id) on delete cascade,
  year integer not null,
  title text not null default '',
  startdate text not null default '',
  enddate text not null default '',
  status text not null default 'active',
  createdat timestamptz not null default now(),
  updatedat timestamptz not null default now()
);

create index if not exists planning_cycles_class_status_idx
  on public.planning_cycles(classid, status);

alter table public.planning_cycles enable row level security;

drop policy if exists "planning_cycles select staff" on public.planning_cycles;
create policy "planning_cycles select staff" on public.planning_cycles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.classes c
      where c.id = planning_cycles.classid
        and (
          public.is_org_admin(c.organization_id)
          or public.is_class_staff(c.id)
        )
    )
  );

drop policy if exists "planning_cycles insert staff" on public.planning_cycles;
create policy "planning_cycles insert staff" on public.planning_cycles
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.classes c
      where c.id = planning_cycles.classid
        and (
          public.is_org_admin(c.organization_id)
          or public.is_class_staff(c.id)
        )
    )
  );

drop policy if exists "planning_cycles update staff" on public.planning_cycles;
create policy "planning_cycles update staff" on public.planning_cycles
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.classes c
      where c.id = planning_cycles.classid
        and (
          public.is_org_admin(c.organization_id)
          or public.is_class_staff(c.id)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.classes c
      where c.id = planning_cycles.classid
        and (
          public.is_org_admin(c.organization_id)
          or public.is_class_staff(c.id)
        )
    )
  );

drop policy if exists "planning_cycles delete admin" on public.planning_cycles;
create policy "planning_cycles delete admin" on public.planning_cycles
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.classes c
      where c.id = planning_cycles.classid
        and public.is_org_admin(c.organization_id)
    )
  );

revoke all on table public.planning_cycles from anon;
revoke all on table public.planning_cycles from authenticated;
grant select, insert, update, delete on table public.planning_cycles to authenticated;
