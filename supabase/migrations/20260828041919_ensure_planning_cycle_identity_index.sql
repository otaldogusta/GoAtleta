-- Keep planning cycle identity compatible with the canonical upsert path.
-- Abort instead of silently choosing one cycle if legacy duplicates exist.
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
end
$$;

create unique index if not exists planning_cycles_org_class_year_uidx
  on public.planning_cycles (organization_id, classid, year);
