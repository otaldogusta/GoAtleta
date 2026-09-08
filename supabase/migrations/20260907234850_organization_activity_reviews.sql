create table public.organization_activity_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_ids text[] not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date and end_date - start_date <= 92),
  reason text not null check (reason in ('recess','suspended','held')),
  reviewed_by uuid not null references auth.users(id),
  reviewed_at timestamptz not null default now(),
  unique (organization_id,class_ids,start_date,end_date,reason)
);
alter table public.organization_activity_reviews enable row level security;
create policy activity_review_admin_read on public.organization_activity_reviews for select to authenticated
  using (public.is_org_admin(organization_id));
revoke all on public.organization_activity_reviews from public, anon, authenticated;
grant select on public.organization_activity_reviews to authenticated;
create index activity_review_org_date on public.organization_activity_reviews(organization_id,end_date);

create or replace function public.review_organization_activity(p_organization_id uuid,p_class_ids text[],p_start date,p_end date,p_reason text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare ids text[]; result uuid;
begin
  if auth.uid() is null or not coalesce(public.is_org_admin(p_organization_id),false) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_start is null or p_end is null or p_end < p_start or p_end - p_start > 92
    or p_start < (now() at time zone 'America/Sao_Paulo')::date - 366
    or p_end > (now() at time zone 'America/Sao_Paulo')::date + 366
    or p_reason is null or p_reason not in ('recess','suspended','held') then raise exception 'Invalid review period'; end if;
  select array_agg(distinct id order by id) into ids from unnest(p_class_ids) t(id);
  if coalesce(cardinality(ids),0)=0 or cardinality(ids)>100 or exists (
    select 1 from unnest(ids) t(id) where not exists (select 1 from public.classes c where c.id=t.id and c.organization_id=p_organization_id)
  ) then raise exception 'Invalid class selection'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text,0));
  insert into public.organization_activity_reviews(organization_id,class_ids,start_date,end_date,reason,reviewed_by)
    values(p_organization_id,ids,p_start,p_end,p_reason,auth.uid())
    on conflict (organization_id,class_ids,start_date,end_date,reason) do nothing returning id into result;
  if result is null then select id into result from public.organization_activity_reviews
    where organization_id=p_organization_id and class_ids=ids and start_date=p_start and end_date=p_end and reason=p_reason;
    return result;
  end if;
  if p_reason <> 'held' then
    insert into public.class_calendar_exceptions(id,class_id,organization_id,date,reason,kind)
    select gen_random_uuid()::text,c.id,p_organization_id,d::date,
      case p_reason when 'recess' then 'Férias/recesso: confirmado pela coordenação' else 'Aulas suspensas: confirmado pela coordenação' end,'no_training'
    from public.classes c cross join generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d
    where c.organization_id=p_organization_id and c.id=any(ids)
      and c.days @> jsonb_build_array(extract(dow from d)::integer)
    on conflict(class_id,date,kind) do nothing;
  end if;
  return result;
end; $$;
revoke all on function public.review_organization_activity(uuid,text[],date,date,text) from public,anon;
grant execute on function public.review_organization_activity(uuid,text[],date,date,text) to authenticated;
