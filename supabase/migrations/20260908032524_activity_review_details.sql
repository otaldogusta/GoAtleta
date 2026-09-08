-- Additive extension; existing reviews and five-argument RPC remain compatible.
alter table public.organization_activity_reviews
  drop constraint organization_activity_reviews_reason_check,
  add constraint organization_activity_reviews_reason_check check (reason in ('recess','suspended','held','holiday','tournament','other')),
  add column note text not null default '' check (length(note) <= 240),
  add column resolution text check (resolution in ('replaced','rescheduled')),
  add column new_date date,
  add column event_id uuid references public.events(id) on delete set null;

create function public.review_organization_activity_details(
  p_organization_id uuid,p_class_ids text[],p_start date,p_end date,p_reason text,
  p_note text,p_resolution text,p_new_date date
) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare ids text[]; result uuid; existing public.organization_activity_reviews; event uuid; label text;
begin
  if auth.uid() is null or not coalesce(public.is_org_admin(p_organization_id),false) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_start is null or p_end is null or p_end < p_start or p_end-p_start > 92
    or p_start < (now() at time zone 'America/Sao_Paulo')::date-366
    or p_end > (now() at time zone 'America/Sao_Paulo')::date+366
    or p_reason is null or p_reason not in ('holiday','tournament','other')
    or length(coalesce(p_note,'')) > 240 then raise exception 'Invalid review period'; end if;
  if p_reason='other' and length(trim(coalesce(p_note,''))) < 3 then raise exception 'Describe the reason'; end if;
  if p_reason='tournament' then
    if p_resolution is null or p_resolution not in ('replaced','rescheduled') then raise exception 'Choose event resolution'; end if;
  elsif p_resolution is not null then raise exception 'Unexpected resolution'; end if;
  if p_resolution='rescheduled' then
    if p_start<>p_end or p_new_date is null or p_new_date<=p_end
      or p_new_date>(now() at time zone 'America/Sao_Paulo')::date+366 then raise exception 'Invalid reschedule date'; end if;
  elsif p_new_date is not null then raise exception 'Unexpected reschedule date'; end if;
  select array_agg(distinct id order by id) into ids from unnest(p_class_ids) t(id);
  if coalesce(cardinality(ids),0)=0 or cardinality(ids)>100 or exists (
    select 1 from unnest(ids) t(id) where not exists (select 1 from public.classes c where c.id=t.id and c.organization_id=p_organization_id)
  ) then raise exception 'Invalid class selection'; end if;
  if p_resolution='rescheduled' and exists (select 1 from public.classes c where c.id=any(ids)
    and not (c.days @> jsonb_build_array(extract(dow from p_start)::integer))) then raise exception 'Original date must be scheduled for every selected class'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text,0));
  select * into existing from public.organization_activity_reviews where organization_id=p_organization_id
    and class_ids=ids and start_date=p_start and end_date=p_end and reason=p_reason;
  if found then
    if existing.note is distinct from trim(coalesce(p_note,'')) or existing.resolution is distinct from p_resolution or existing.new_date is distinct from p_new_date then
      raise exception 'This period already has a different review';
    end if;
    return existing.id;
  end if;
  if p_resolution='rescheduled' and exists (select 1 from public.class_calendar_exceptions where organization_id=p_organization_id and class_id=any(ids) and date=p_new_date and kind='no_training') then
    raise exception 'New date has a confirmed pause';
  end if;
  insert into public.organization_activity_reviews(organization_id,class_ids,start_date,end_date,reason,note,resolution,new_date,reviewed_by)
    values(p_organization_id,ids,p_start,p_end,p_reason,trim(coalesce(p_note,'')),p_resolution,p_new_date,auth.uid()) returning id into result;
  label := case p_reason when 'holiday' then 'Feriado' when 'other' then 'Outro motivo: '||trim(p_note)
    else case when p_resolution='rescheduled' then 'Campeonato/torneio; reposição em '||to_char(p_new_date,'DD/MM/YYYY') else 'Aula substituída por campeonato/torneio' end end;
  insert into public.class_calendar_exceptions(id,class_id,organization_id,date,reason,kind)
    select gen_random_uuid()::text,c.id,p_organization_id,d::date,label,'no_training'
    from public.classes c cross join generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d
    where c.organization_id=p_organization_id and c.id=any(ids) and c.days @> jsonb_build_array(extract(dow from d)::integer)
    on conflict(class_id,date,kind) do nothing;
  if p_resolution='rescheduled' then
    insert into public.events(organization_id,title,description,event_type,sport,starts_at,ends_at,all_day,created_by)
      values(p_organization_id,'Reposição de aula', 'Reposição de '||to_char(p_start,'DD/MM/YYYY')||' por campeonato/torneio. Horário a definir.',
        'treino','geral',p_new_date::timestamp at time zone 'America/Sao_Paulo',(p_new_date+1)::timestamp at time zone 'America/Sao_Paulo',true,auth.uid()) returning id into event;
    insert into public.event_classes(event_id,organization_id,class_id) select event,p_organization_id,id from unnest(ids) t(id);
    update public.organization_activity_reviews set event_id=event where id=result;
  end if;
  return result;
end; $$;
revoke all on function public.review_organization_activity_details(uuid,text[],date,date,text,text,text,date) from public,anon;
grant execute on function public.review_organization_activity_details(uuid,text[],date,date,text,text,text,date) to authenticated;
