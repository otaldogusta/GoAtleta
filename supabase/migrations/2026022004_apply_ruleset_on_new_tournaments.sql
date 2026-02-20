-- Auto-apply regulation ruleset on new tournament cycles.
-- In this codebase, championships are represented by events with event_type = 'torneio'.

alter table if exists public.events
  add column if not exists rule_set_id uuid
  references public.regulation_rule_sets(id)
  on delete set null;

create index if not exists events_org_rule_set_idx
  on public.events (organization_id, rule_set_id);

create or replace function public.event_sport_to_regulation_sport(
  p_event_sport text
)
returns text
language sql
immutable
as $$
  select case
    when p_event_sport in ('volei_quadra', 'volei_praia', 'geral') then 'volleyball'
    when p_event_sport = 'futebol' then 'soccer'
    else null
  end;
$$;

create or replace function public.resolve_active_rule_set_for_new_cycle(
  p_organization_id uuid,
  p_sport text
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_selected_id uuid;
  v_selected_status text;
begin
  if p_organization_id is null or coalesce(trim(p_sport), '') = '' then
    return null;
  end if;

  select rs.id, rs.status
    into v_selected_id, v_selected_status
  from public.regulation_rule_sets rs
  where rs.organization_id = p_organization_id
    and rs.sport = p_sport
    and rs.status in ('pending_next_cycle', 'active')
  order by
    case rs.status
      when 'pending_next_cycle' then 0
      when 'active' then 1
      else 9
    end,
    rs.updated_at desc
  limit 1
  for update;

  if v_selected_id is null then
    return null;
  end if;

  if v_selected_status = 'pending_next_cycle' then
    update public.regulation_rule_sets
    set status = 'archived',
        updated_at = now()
    where organization_id = p_organization_id
      and sport = p_sport
      and status = 'active'
      and id <> v_selected_id;

    update public.regulation_rule_sets
    set status = 'active',
        updated_at = now()
    where id = v_selected_id
      and status = 'pending_next_cycle';
  end if;

  return v_selected_id;
end;
$$;

revoke all on function public.resolve_active_rule_set_for_new_cycle(uuid, text) from anon, public;
grant execute on function public.resolve_active_rule_set_for_new_cycle(uuid, text) to authenticated;

create or replace function public.events_set_ruleset_for_tournament()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_rule_set_org_id uuid;
  v_regulation_sport text;
begin
  if new.rule_set_id is not null then
    select rs.organization_id
      into v_rule_set_org_id
    from public.regulation_rule_sets rs
    where rs.id = new.rule_set_id;

    if v_rule_set_org_id is null then
      raise exception 'Invalid rule_set_id';
    end if;

    if v_rule_set_org_id <> new.organization_id then
      raise exception 'rule_set_id organization mismatch';
    end if;

    return new;
  end if;

  if new.event_type <> 'torneio' then
    return new;
  end if;

  v_regulation_sport := public.event_sport_to_regulation_sport(new.sport);
  if v_regulation_sport is null then
    return new;
  end if;

  new.rule_set_id := public.resolve_active_rule_set_for_new_cycle(
    new.organization_id,
    v_regulation_sport
  );

  return new;
end;
$$;

drop trigger if exists trg_events_set_ruleset_for_tournament on public.events;
create trigger trg_events_set_ruleset_for_tournament
before insert on public.events
for each row
execute function public.events_set_ruleset_for_tournament();
