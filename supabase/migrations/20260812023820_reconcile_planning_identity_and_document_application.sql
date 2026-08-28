-- Reconcile the periodization identity before enforcing the canonical contract.
-- A class has one cycle per year and one weekly plan per cycle/week.

create table if not exists private.planning_reconciliation_audit (
  id uuid primary key default gen_random_uuid(),
  migration_tag text not null,
  organization_id uuid not null,
  class_id text not null,
  cycle_id text,
  week_number integer not null,
  kept_plan_id text not null,
  removed_plan_id text not null,
  removed_snapshot jsonb not null,
  reconciled_at timestamptz not null default now(),
  unique (migration_tag, removed_plan_id)
);

revoke all on table private.planning_reconciliation_audit from public, anon, authenticated;
grant select on table private.planning_reconciliation_audit to service_role;

-- Make a fresh replay self-contained. The hosted database already had these
-- canonical columns when this migration was first applied, while the historical
-- migration chain still exposes the legacy compact names.
alter table public.planning_cycles
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.planning_cycles
set start_date = coalesce(start_date, nullif(btrim(startdate), '')::date, make_date(year, 1, 1)),
    end_date = coalesce(end_date, nullif(btrim(enddate), '')::date, make_date(year, 12, 31)),
    created_at = coalesce(created_at, createdat, now()),
    updated_at = coalesce(updated_at, updatedat, created_at, createdat, now());

alter table public.planning_cycles
  alter column start_date set not null,
  alter column end_date set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.class_plans
  add column if not exists cycle_id text,
  add column if not exists created_at timestamptz;

update public.class_plans
set created_at = coalesce(created_at, createdat, now());

alter table public.class_plans
  alter column created_at set default now(),
  alter column created_at set not null;

-- ON CONFLICT must have a matching arbiter. Refuse ambiguous historical data
-- instead of silently merging or deleting cycle records.
do $$
begin
  if exists (
    select 1
    from public.planning_cycles
    group by organization_id, classid, year
    having count(*) > 1
  ) then
    raise exception 'planning_cycles contains duplicate organization/class/year identities';
  end if;
end $$;

create unique index if not exists planning_cycles_org_class_year_uidx
  on public.planning_cycles (organization_id, classid, year);

-- Some historical class plans predate planning_cycles. Create only the missing
-- class/year containers; existing cycles always remain the source of truth.
insert into public.planning_cycles (
  id,
  classid,
  year,
  title,
  start_date,
  end_date,
  status,
  organization_id,
  created_at,
  updated_at
)
select
  'pc_' || cp.classid || '_' || extract(year from cp.startdate)::integer,
  cp.classid,
  extract(year from cp.startdate)::integer,
  extract(year from cp.startdate)::integer::text,
  make_date(extract(year from cp.startdate)::integer, 1, 1),
  make_date(extract(year from cp.startdate)::integer, 12, 31),
  case
    when extract(year from cp.startdate)::integer = extract(year from current_date)::integer
      then 'active'
    else 'archived'
  end,
  cp.organization_id,
  min(coalesce(cp.created_at, cp.createdat, now())),
  max(coalesce(cp.updated_at, cp.updatedat, cp.created_at, cp.createdat, now()))
from public.class_plans cp
group by cp.organization_id, cp.classid, extract(year from cp.startdate)::integer
on conflict (organization_id, classid, year) do nothing;

-- Preserve the losing version before removing real duplicates. Manual plans
-- outrank generated plans; within the same source, the newest edit wins.
with ranked as (
  select
    cp.*,
    pc.id as resolved_cycle_id,
    row_number() over (
      partition by cp.organization_id, cp.classid, pc.id, cp.weeknumber
      order by
        case when cp.source = 'MANUAL' then 0 else 1 end,
        coalesce(cp.updated_at, cp.updatedat, cp.created_at, cp.createdat) desc nulls last,
        cp.id desc
    ) as priority,
    first_value(cp.id) over (
      partition by cp.organization_id, cp.classid, pc.id, cp.weeknumber
      order by
        case when cp.source = 'MANUAL' then 0 else 1 end,
        coalesce(cp.updated_at, cp.updatedat, cp.created_at, cp.createdat) desc nulls last,
        cp.id desc
    ) as kept_plan_id
  from public.class_plans cp
  join public.planning_cycles pc
    on pc.organization_id = cp.organization_id
   and pc.classid = cp.classid
   and pc.year = extract(year from cp.startdate)::integer
), losers as (
  select * from ranked where priority > 1
)
insert into private.planning_reconciliation_audit (
  migration_tag,
  organization_id,
  class_id,
  cycle_id,
  week_number,
  kept_plan_id,
  removed_plan_id,
  removed_snapshot
)
select
  '20260812023820_reconcile_planning_identity',
  organization_id,
  classid,
  resolved_cycle_id,
  weeknumber,
  kept_plan_id,
  id,
  to_jsonb(losers) - 'priority' - 'kept_plan_id' - 'resolved_cycle_id'
from losers
on conflict (migration_tag, removed_plan_id) do nothing;

with ranked as (
  select
    cp.id,
    row_number() over (
      partition by cp.organization_id, cp.classid, pc.id, cp.weeknumber
      order by
        case when cp.source = 'MANUAL' then 0 else 1 end,
        coalesce(cp.updated_at, cp.updatedat, cp.created_at, cp.createdat) desc nulls last,
        cp.id desc
    ) as priority
  from public.class_plans cp
  join public.planning_cycles pc
    on pc.organization_id = cp.organization_id
   and pc.classid = cp.classid
   and pc.year = extract(year from cp.startdate)::integer
)
delete from public.class_plans cp
using ranked
where cp.id = ranked.id
  and ranked.priority > 1;

-- Repair null and stale cycle references only after conflicts for the target
-- cycle identity have been resolved.
update public.class_plans cp
set cycle_id = pc.id,
    updated_at = coalesce(cp.updated_at, now()),
    updatedat = coalesce(cp.updatedat, now())
from public.planning_cycles pc
where pc.organization_id = cp.organization_id
  and pc.classid = cp.classid
  and pc.year = extract(year from cp.startdate)::integer
  and cp.cycle_id is distinct from pc.id;

do $$
begin
  if exists (
    select 1
    from public.class_plans cp
    left join public.planning_cycles pc
      on pc.id = cp.cycle_id
     and pc.classid = cp.classid
     and pc.organization_id = cp.organization_id
    where cp.cycle_id is null or pc.id is null
  ) then
    raise exception 'class_plans still contains unresolved cycle references';
  end if;

  if exists (
    select 1
    from public.class_plans
    group by organization_id, classid, cycle_id, weeknumber
    having count(*) > 1
  ) then
    raise exception 'class_plans still contains duplicate cycle weeks';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'planning_cycles_identity_workspace_unique'
      and conrelid = 'public.planning_cycles'::regclass
  ) then
    alter table public.planning_cycles
      add constraint planning_cycles_identity_workspace_unique
      unique (id, classid, organization_id);
  end if;
end $$;

alter table public.class_plans
  alter column cycle_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'class_plans_cycle_workspace_fk'
      and conrelid = 'public.class_plans'::regclass
  ) then
    alter table public.class_plans
      add constraint class_plans_cycle_workspace_fk
      foreign key (cycle_id, classid, organization_id)
      references public.planning_cycles (id, classid, organization_id)
      on delete cascade;
  end if;
end $$;

drop index if exists public.class_plans_unique_cycle_week;
create unique index class_plans_unique_cycle_week
  on public.class_plans (organization_id, classid, cycle_id, weeknumber);

create unique index if not exists class_plans_unique_cycle_startdate
  on public.class_plans (organization_id, classid, cycle_id, startdate);

-- Transitional document/application contract. The lesson-plan document remains
-- versioned in training_plans; assigning it to a class/date is recorded here as
-- an explicit, independently queryable application.
create table if not exists public.training_plan_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id text not null references public.training_plans(id) on delete cascade,
  class_id text not null,
  scheduled_date date not null,
  weekdays integer[] not null default '{}',
  status text not null default 'scheduled'
    check (status in ('scheduled', 'applied', 'completed', 'cancelled')),
  source text not null default 'explicit_apply'
    check (source in ('explicit_apply', 'legacy_plan_fields')),
  applied_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_plan_applications_class_workspace_fk
    foreign key (class_id, organization_id)
    references public.classes (id, organization_id)
    on delete cascade,
  unique (organization_id, plan_id, class_id, scheduled_date)
);

create index if not exists training_plan_applications_class_date_idx
  on public.training_plan_applications (organization_id, class_id, scheduled_date desc);

alter table public.training_plan_applications enable row level security;

drop policy if exists training_plan_applications_select_staff
  on public.training_plan_applications;
create policy training_plan_applications_select_staff
  on public.training_plan_applications
  for select
  to authenticated
  using (
    public.is_org_member(organization_id)
    and (public.is_org_admin(organization_id) or public.is_class_staff(class_id))
  );

drop policy if exists training_plan_applications_insert_staff
  on public.training_plan_applications;
create policy training_plan_applications_insert_staff
  on public.training_plan_applications
  for insert
  to authenticated
  with check (
    public.is_org_member(organization_id)
    and (public.is_org_admin(organization_id) or public.is_class_staff(class_id))
    and applied_by = auth.uid()
  );

drop policy if exists training_plan_applications_update_staff
  on public.training_plan_applications;
create policy training_plan_applications_update_staff
  on public.training_plan_applications
  for update
  to authenticated
  using (
    public.is_org_member(organization_id)
    and (public.is_org_admin(organization_id) or public.is_class_staff(class_id))
  )
  with check (
    public.is_org_member(organization_id)
    and (public.is_org_admin(organization_id) or public.is_class_staff(class_id))
  );

drop policy if exists training_plan_applications_delete_staff
  on public.training_plan_applications;
create policy training_plan_applications_delete_staff
  on public.training_plan_applications
  for delete
  to authenticated
  using (
    public.is_org_member(organization_id)
    and (public.is_org_admin(organization_id) or public.is_class_staff(class_id))
  );

revoke all on table public.training_plan_applications from anon;
grant select, insert, update, delete on table public.training_plan_applications to authenticated;

create or replace function public.capture_training_plan_application()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.applydate is null or nullif(btrim(new.classid), '') is null then
    return new;
  end if;

  insert into public.training_plan_applications (
    organization_id,
    plan_id,
    class_id,
    scheduled_date,
    weekdays,
    status,
    source,
    applied_by
  ) values (
    new.organization_id,
    new.id,
    new.classid,
    new.applydate,
    coalesce(new.applydays, '{}'),
    'scheduled',
    'legacy_plan_fields',
    auth.uid()
  )
  on conflict (organization_id, plan_id, class_id, scheduled_date)
  do update set
    weekdays = excluded.weekdays,
    status = case
      when training_plan_applications.status = 'cancelled' then 'scheduled'
      else training_plan_applications.status
    end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists training_plans_capture_application
  on public.training_plans;
create trigger training_plans_capture_application
after insert or update of classid, applydate, applydays
on public.training_plans
for each row
execute function public.capture_training_plan_application();

-- Backfill the explicit application ledger for any compatible legacy rows.
insert into public.training_plan_applications (
  organization_id,
  plan_id,
  class_id,
  scheduled_date,
  weekdays,
  status,
  source,
  applied_by,
  created_at,
  updated_at
)
select
  tp.organization_id,
  tp.id,
  tp.classid,
  tp.applydate,
  coalesce(tp.applydays, '{}'),
  'scheduled',
  'legacy_plan_fields',
  tp.owner_id,
  coalesce(tp.generatedat, tp.finalizedat, now()),
  coalesce(tp.finalizedat, tp.generatedat, now())
from public.training_plans tp
join public.classes c
  on c.id = tp.classid
 and c.organization_id = tp.organization_id
where tp.applydate is not null
on conflict (organization_id, plan_id, class_id, scheduled_date) do nothing;
