with target_classes as (
  select
    c.id as class_id,
    c.organization_id,
    c.name
  from public.classes c
  where c.name ilike 'ElCartel Masculino%'
     or c.name ilike 'ElCartel Feminino%'
),
upsert_profiles as (
  insert into public.class_competitive_profiles (
    class_id,
    organization_id,
    planning_mode,
    cycle_start_date,
    target_competition,
    target_date,
    tactical_system,
    current_phase,
    notes,
    created_at,
    updated_at
  )
  select
    tc.class_id,
    tc.organization_id,
    'adulto-competitivo',
    date '2026-03-10',
    'Supertaca Unificada da Saude',
    date '2026-06-20',
    '5x1',
    'Base',
    'Seed inicial ElCartel por turma. Ajustes de carga podem divergir entre masculino e feminino.',
    now(),
    now()
  from target_classes tc
  on conflict (class_id) do update
    set planning_mode = excluded.planning_mode,
        cycle_start_date = excluded.cycle_start_date,
        target_competition = excluded.target_competition,
        target_date = excluded.target_date,
        tactical_system = excluded.tactical_system,
        current_phase = excluded.current_phase,
        notes = excluded.notes,
        updated_at = now()
  returning class_id, organization_id
)
insert into public.class_calendar_exceptions (
  id,
  class_id,
  organization_id,
  date,
  reason,
  kind,
  created_at
)
select
  'cce_' || replace(up.class_id, '-', '_') || '_' || replace(exc.date::text, '-', ''),
  up.class_id,
  up.organization_id,
  exc.date,
  exc.reason,
  'no_training',
  now()
from upsert_profiles up
cross join (
  values
    (date '2026-04-21', 'Feriado / pausa competitiva'),
    (date '2026-06-04', 'Feriado / pausa competitiva')
) as exc(date, reason)
on conflict (class_id, date, kind) do nothing;
