create or replace function public.schedule_holiday_makeup(
  p_organization_id uuid, p_class_id text, p_original_date date, p_date date, p_start_time text
) returns void language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  regular_days jsonb;
  existing public.class_holiday_makeups;
  pause_reason text;
  has_pause boolean;
  day_to_check date;
  -- Match legacy ISO text and typed timestamps using the existing class/date index.
  report_start public.session_logs.createdat%type;
  report_end public.session_logs.createdat%type;
begin
  if auth.uid() is null or not coalesce(public.is_org_admin(p_organization_id), false) then
    raise exception 'Somente a coordenação pode agendar reposições.' using errcode = '42501';
  end if;
  select c.days into regular_days from public.classes c
    where c.id = p_class_id and c.organization_id = p_organization_id for share;
  if not found then raise exception 'Turma indisponível nesta organização.'; end if;

  if not coalesce(isfinite(p_date) and isfinite(p_original_date) and p_date > p_original_date, false)
    or p_start_time is null or p_start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Confira as datas e o horário da reposição.';
  end if;

  -- Serialize with review/holiday decisions and both calendar occurrences in chronological order.
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || p_original_date::text, 0));
  foreach day_to_check in array array[p_original_date, p_date] loop
    perform pg_advisory_xact_lock(hashtextextended(
      'attendance:' || p_organization_id::text || ':' || p_class_id || ':' || day_to_check::text, 0));
  end loop;

  select * into existing from public.class_holiday_makeups
    where organization_id = p_organization_id and class_id = p_class_id and original_date = p_original_date;
  if found then
    if existing.date = p_date and existing.start_time = p_start_time then return; end if;
    raise exception 'Esta aula já tem reposição agendada.';
  end if;
  if not coalesce(regular_days @> jsonb_build_array(extract(dow from p_original_date)::int), false) then
    raise exception 'A data de origem precisa ser dia de aula da turma.';
  end if;

  select reason into pause_reason from public.class_calendar_exceptions
    where class_id = p_class_id and organization_id = p_organization_id and date = p_original_date and kind = 'no_training';
  has_pause := found;
  if has_pause and coalesce(trim(pause_reason), '') !~* '^feriado(:|$)' then
    raise exception 'A pausa da aula original tem outro motivo.';
  elsif not has_pause and to_char(p_original_date, 'MM-DD') not in
    ('01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25') then
    raise exception 'A data de origem precisa ser um feriado reconhecido ou registrado.';
  end if;
  if exists (select from public.organization_holiday_decisions h where h.organization_id = p_organization_id
      and h.date = p_original_date and not (p_class_id = any(h.suspended_class_ids)))
    or exists (select from public.organization_activity_reviews r where r.organization_id = p_organization_id
      and p_class_id = any(r.class_ids) and r.reason = 'held' and p_original_date between r.start_date and r.end_date) then
    raise exception 'A aula de origem já foi confirmada com aula.';
  end if;
  if regular_days @> jsonb_build_array(extract(dow from p_date)::int)
    or exists (select from public.class_calendar_exceptions e where e.organization_id = p_organization_id
      and e.class_id = p_class_id and e.date = p_date and e.kind = 'no_training')
    or exists (select from public.class_holiday_makeups m where m.organization_id = p_organization_id
      and m.class_id = p_class_id and m.date = p_date)
    or exists (select from public.organization_activity_reviews r where r.organization_id = p_organization_id
      and p_class_id = any(r.class_ids) and r.resolution = 'rescheduled' and r.new_date = p_date) then
    raise exception 'Escolha um dia livre na agenda da turma.';
  end if;
  foreach day_to_check in array array[p_original_date, p_date] loop
    report_start := to_char(day_to_check, 'YYYY-MM-DD');
    report_end := to_char(day_to_check + 1, 'YYYY-MM-DD');
    if exists (select from public.attendance_logs a where a.organization_id = p_organization_id
        and a.classid = p_class_id and a.date = day_to_check)
      or exists (select from public.attendance_checkins a where a.organization_id = p_organization_id
        and a.class_id = p_class_id and a.checked_in_at >= (day_to_check::timestamp at time zone 'America/Sao_Paulo')
        and a.checked_in_at < ((day_to_check + 1)::timestamp at time zone 'America/Sao_Paulo'))
      or exists (select from public.session_logs l where l.organization_id = p_organization_id
        and l.classid = p_class_id and l.createdat >= report_start and l.createdat < report_end)
      or exists (select from public.training_session_classes sc join public.training_sessions s on s.id = sc.session_id
        where sc.organization_id = p_organization_id and s.organization_id = p_organization_id and sc.class_id = p_class_id
        and (s.status = 'completed' or (day_to_check = p_date and s.status = 'scheduled'))
        and s.start_at >= (day_to_check::timestamp at time zone 'America/Sao_Paulo')
        and s.start_at < ((day_to_check + 1)::timestamp at time zone 'America/Sao_Paulo')) then
      raise exception 'Já existe chamada ou aula registrada em uma das datas.';
    end if;
  end loop;

  if not has_pause then
    insert into public.class_calendar_exceptions(id, organization_id, class_id, date, kind, reason)
      values(gen_random_uuid()::text, p_organization_id, p_class_id, p_original_date, 'no_training', 'Feriado');
  end if;
  insert into public.class_holiday_makeups(organization_id, class_id, original_date, date, start_time, created_by)
    values(p_organization_id, p_class_id, p_original_date, p_date, p_start_time, auth.uid());
end;
$$;
