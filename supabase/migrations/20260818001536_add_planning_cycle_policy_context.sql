-- Persist the confirmed cycle policy in the same workspace-scoped source of
-- truth consumed by planning and contextual assistance.
alter table public.planning_cycles
  add column if not exists periodization_policy_json jsonb not null default '{}'::jsonb,
  add column if not exists policy_version integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'planning_cycles_policy_version_positive'
      and conrelid = 'public.planning_cycles'::regclass
  ) then
    alter table public.planning_cycles
      add constraint planning_cycles_policy_version_positive
      check (policy_version >= 1);
  end if;
end $$;

comment on column public.planning_cycles.periodization_policy_json is
  'Versioned, professor-confirmed load and recovery policy for this cycle.';
comment on column public.planning_cycles.policy_version is
  'Monotonic version of periodization_policy_json used in planning lineage.';
