-- One audited decision per organization/date. Existing manual pauses are preserved.
create table public.organization_holiday_decisions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  date date not null,
  suspended_class_ids text[] not null default '{}',
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  primary key (organization_id, date)
);
alter table public.organization_holiday_decisions enable row level security;
create policy holiday_admin_read on public.organization_holiday_decisions for select to authenticated
  using (public.is_org_admin(organization_id));
revoke all on public.organization_holiday_decisions from public, anon, authenticated;
grant select on public.organization_holiday_decisions to authenticated;

create or replace function public.decide_organization_holiday(
  p_organization_id uuid, p_date date, p_suspended_class_ids text[]
) returns public.organization_holiday_decisions
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  result public.organization_holiday_decisions;
  selected_ids text[];
begin
  if auth.uid() is null or not coalesce(public.is_org_admin(p_organization_id), false) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_date is null or p_date <> (now() at time zone 'America/Sao_Paulo')::date
     or to_char(p_date, 'MM-DD') not in ('01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25') then
    raise exception 'Invalid holiday date';
  end if;
  select coalesce(array_agg(distinct id order by id), '{}') into selected_ids
    from unnest(coalesce(p_suspended_class_ids, '{}')) as t(id);
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || p_date::text, 0));
  select * into result from public.organization_holiday_decisions
    where organization_id = p_organization_id and date = p_date;
  if found then
    if result.suspended_class_ids = selected_ids then return result; end if;
    raise exception 'Holiday already decided; reload the calendar';
  end if;
  if exists (select 1 from unnest(selected_ids) as t(id) where not exists (
    select 1 from public.classes c where c.id = t.id and c.organization_id = p_organization_id
      and c.days @> jsonb_build_array(extract(dow from p_date)::integer)
  )) then raise exception 'Invalid class selection'; end if;
  insert into public.organization_holiday_decisions (organization_id,date,suspended_class_ids,decided_by)
    values (p_organization_id,p_date,selected_ids,auth.uid()) returning * into result;
  insert into public.class_calendar_exceptions(id,class_id,organization_id,date,reason,kind)
    select gen_random_uuid()::text, id, p_organization_id, p_date, 'Feriado: decisão da coordenação', 'no_training'
    from unnest(selected_ids) as t(id)
    on conflict (class_id,date,kind) do nothing;
  return result;
end;
$$;
revoke all on function public.decide_organization_holiday(uuid,date,text[]) from public, anon;
grant execute on function public.decide_organization_holiday(uuid,date,text[]) to authenticated;
