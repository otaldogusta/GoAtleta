-- Layer 3/4: structured clause engine + ruleset compare + institutional history support

create table if not exists public.regulation_clauses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_set_id uuid not null references public.regulation_rule_sets(id) on delete cascade,
  clause_key text not null,
  clause_label text not null default '',
  clause_type text not null default 'json'
    check (clause_type in ('number', 'boolean', 'text', 'json')),
  base_value jsonb not null default 'null'::jsonb,
  overrides jsonb not null default '[]'::jsonb,
  source_reference text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, rule_set_id, clause_key),
  check (jsonb_typeof(overrides) = 'array')
);

create index if not exists regulation_clauses_org_ruleset_idx
  on public.regulation_clauses (organization_id, rule_set_id, clause_key);

create or replace function public.set_regulation_clauses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_regulation_clauses_updated_at on public.regulation_clauses;
create trigger trg_regulation_clauses_updated_at
before update on public.regulation_clauses
for each row
execute function public.set_regulation_clauses_updated_at();

alter table public.regulation_clauses enable row level security;

drop policy if exists "regulation_clauses_select_member" on public.regulation_clauses;
create policy "regulation_clauses_select_member"
  on public.regulation_clauses
  for select
  using (public.is_org_member(organization_id));

drop policy if exists "regulation_clauses_insert_admin" on public.regulation_clauses;
create policy "regulation_clauses_insert_admin"
  on public.regulation_clauses
  for insert
  with check (
    public.is_org_admin(organization_id)
    and exists (
      select 1
      from public.regulation_rule_sets rs
      where rs.id = regulation_clauses.rule_set_id
        and rs.organization_id = regulation_clauses.organization_id
    )
  );

drop policy if exists "regulation_clauses_update_admin" on public.regulation_clauses;
create policy "regulation_clauses_update_admin"
  on public.regulation_clauses
  for update
  using (public.is_org_admin(organization_id))
  with check (
    public.is_org_admin(organization_id)
    and exists (
      select 1
      from public.regulation_rule_sets rs
      where rs.id = regulation_clauses.rule_set_id
        and rs.organization_id = regulation_clauses.organization_id
    )
  );

drop policy if exists "regulation_clauses_delete_admin" on public.regulation_clauses;
create policy "regulation_clauses_delete_admin"
  on public.regulation_clauses
  for delete
  using (public.is_org_admin(organization_id));

grant select, insert, update, delete on table public.regulation_clauses to authenticated;

-- Preview resolver: same priority as cycle resolver but no mutation/promotion.
drop function if exists public.peek_rule_set_for_new_cycle(uuid, text);
create function public.peek_rule_set_for_new_cycle(
  p_organization_id uuid,
  p_event_sport text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_rule_sport text;
  v_selected uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_org_member(p_organization_id) then
    raise exception 'Not authorized';
  end if;

  v_rule_sport := public.event_sport_to_regulation_sport(p_event_sport);
  if v_rule_sport is null then
    return null;
  end if;

  select rs.id
    into v_selected
  from public.regulation_rule_sets rs
  where rs.organization_id = p_organization_id
    and rs.sport = v_rule_sport
    and rs.status in ('pending_next_cycle', 'active')
  order by
    case rs.status
      when 'pending_next_cycle' then 0
      when 'active' then 1
      else 9
    end,
    rs.updated_at desc
  limit 1;

  return v_selected;
end;
$$;

revoke all on function public.peek_rule_set_for_new_cycle(uuid, text) from anon, public;
grant execute on function public.peek_rule_set_for_new_cycle(uuid, text) to authenticated;

drop function if exists public.list_regulation_rule_sets(uuid, text, int);
create function public.list_regulation_rule_sets(
  p_organization_id uuid,
  p_sport text default null,
  p_limit int default 50
)
returns table (
  id uuid,
  organization_id uuid,
  sport text,
  version_label text,
  status text,
  activation_policy text,
  effective_from date,
  source_authority text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  clauses_count int,
  updates_count int
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_limit int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_org_member(p_organization_id) then
    raise exception 'Not authorized';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 50), 200));

  return query
  select
    rs.id,
    rs.organization_id,
    rs.sport,
    rs.version_label,
    rs.status,
    rs.activation_policy,
    rs.effective_from,
    rs.source_authority,
    rs.published_at,
    rs.created_at,
    rs.updated_at,
    (
      select count(*)::int
      from public.regulation_clauses rc
      where rc.organization_id = rs.organization_id
        and rc.rule_set_id = rs.id
    ) as clauses_count,
    (
      select count(*)::int
      from public.regulation_updates ru
      where ru.organization_id = rs.organization_id
        and ru.rule_set_id = rs.id
    ) as updates_count
  from public.regulation_rule_sets rs
  where rs.organization_id = p_organization_id
    and (p_sport is null or rs.sport = p_sport)
  order by rs.updated_at desc
  limit v_limit;
end;
$$;

revoke all on function public.list_regulation_rule_sets(uuid, text, int) from anon, public;
grant execute on function public.list_regulation_rule_sets(uuid, text, int) to authenticated;

drop function if exists public.compare_regulation_rule_sets(uuid, uuid, uuid);
create function public.compare_regulation_rule_sets(
  p_organization_id uuid,
  p_left_rule_set_id uuid,
  p_right_rule_set_id uuid
)
returns table (
  clause_key text,
  clause_label text,
  left_clause_type text,
  right_clause_type text,
  left_value jsonb,
  right_value jsonb,
  left_overrides jsonb,
  right_overrides jsonb,
  diff_kind text
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_org_member(p_organization_id) then
    raise exception 'Not authorized';
  end if;

  if not exists (
    select 1
    from public.regulation_rule_sets rs
    where rs.id = p_left_rule_set_id
      and rs.organization_id = p_organization_id
  ) then
    raise exception 'Left rule set not found';
  end if;

  if not exists (
    select 1
    from public.regulation_rule_sets rs
    where rs.id = p_right_rule_set_id
      and rs.organization_id = p_organization_id
  ) then
    raise exception 'Right rule set not found';
  end if;

  return query
  with left_clauses as (
    select
      rc.clause_key,
      rc.clause_label,
      rc.clause_type,
      rc.base_value,
      rc.overrides
    from public.regulation_clauses rc
    where rc.organization_id = p_organization_id
      and rc.rule_set_id = p_left_rule_set_id
  ),
  right_clauses as (
    select
      rc.clause_key,
      rc.clause_label,
      rc.clause_type,
      rc.base_value,
      rc.overrides
    from public.regulation_clauses rc
    where rc.organization_id = p_organization_id
      and rc.rule_set_id = p_right_rule_set_id
  )
  select
    coalesce(l.clause_key, r.clause_key) as clause_key,
    coalesce(nullif(l.clause_label, ''), nullif(r.clause_label, ''), coalesce(l.clause_key, r.clause_key)) as clause_label,
    l.clause_type as left_clause_type,
    r.clause_type as right_clause_type,
    l.base_value as left_value,
    r.base_value as right_value,
    coalesce(l.overrides, '[]'::jsonb) as left_overrides,
    coalesce(r.overrides, '[]'::jsonb) as right_overrides,
    case
      when l.clause_key is null then 'added'
      when r.clause_key is null then 'removed'
      when l.clause_type is distinct from r.clause_type
        or l.base_value is distinct from r.base_value
        or coalesce(l.overrides, '[]'::jsonb) is distinct from coalesce(r.overrides, '[]'::jsonb)
      then 'changed'
      else 'equal'
    end as diff_kind
  from left_clauses l
  full outer join right_clauses r
    on r.clause_key = l.clause_key
  order by coalesce(l.clause_key, r.clause_key);
end;
$$;

revoke all on function public.compare_regulation_rule_sets(uuid, uuid, uuid) from anon, public;
grant execute on function public.compare_regulation_rule_sets(uuid, uuid, uuid) to authenticated;

-- Seed deterministic default clauses for existing volleyball rule sets without clauses.
insert into public.regulation_clauses (
  organization_id,
  rule_set_id,
  clause_key,
  clause_label,
  clause_type,
  base_value,
  overrides,
  source_reference
)
select
  rs.organization_id,
  rs.id,
  seed.clause_key,
  seed.clause_label,
  seed.clause_type,
  seed.base_value,
  seed.overrides,
  'default_v1'
from public.regulation_rule_sets rs
cross join (
  values
    ('tournament.min_duration_minutes', 'Duração mínima do torneio (minutos)', 'number', to_jsonb(60), '[]'::jsonb),
    ('tournament.require_location', 'Exigir local no torneio', 'boolean', to_jsonb(true), '[]'::jsonb),
    ('tournament.min_linked_classes', 'Quantidade mínima de turmas vinculadas', 'number', to_jsonb(1), '[]'::jsonb)
) as seed(clause_key, clause_label, clause_type, base_value, overrides)
where rs.sport = 'volleyball'
  and not exists (
    select 1
    from public.regulation_clauses rc
    where rc.organization_id = rs.organization_id
      and rc.rule_set_id = rs.id
      and rc.clause_key = seed.clause_key
  );
