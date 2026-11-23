-- Existing review RPCs share their transaction locks with schedule_holiday_makeup.
create function public.guard_holiday_makeup_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'organization_holiday_decisions' then
    perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text || new.date::text, 0));
    if exists (
      select from public.class_holiday_makeups m where m.organization_id = new.organization_id
        and m.original_date = new.date and not (m.class_id = any(new.suspended_class_ids))
    ) then raise exception 'Há uma reposição agendada para uma das aulas marcadas com aula.'; end if;
  else
    perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 0));
    if exists (
      select from public.class_holiday_makeups m where m.organization_id = new.organization_id
        and m.class_id = any(new.class_ids)
        and ((new.resolution = 'rescheduled' and m.date = new.new_date)
          or (new.reason <> 'holiday' and m.original_date between new.start_date and new.end_date))
    ) then raise exception 'A revisão entra em conflito com uma reposição de feriado.'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_holiday_makeup_review() from public, anon, authenticated;
create trigger check_holiday_makeup_activity_review before insert or update of
  organization_id, class_ids, resolution, new_date, reason, start_date, end_date
  on public.organization_activity_reviews for each row execute function public.guard_holiday_makeup_review();
create trigger check_holiday_makeup_decision before insert or update of organization_id, date, suspended_class_ids
  on public.organization_holiday_decisions for each row execute function public.guard_holiday_makeup_review();
