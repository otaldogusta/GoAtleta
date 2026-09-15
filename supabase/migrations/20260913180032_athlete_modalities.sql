-- Optional for legacy plans: never infer a sport from a commercial name.
alter table public.tuition_plans add column modality text
  check (modality in ('voleibol','futsal','futebol','basquete','fitness'));

create table public.athlete_modality_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  modalities text[] not null default '{}',
  check (modalities <@ array['voleibol','futsal','futebol','basquete','fitness']::text[]),
  check (cardinality(modalities) <= 5 and array_position(modalities, null) is null)
);
alter table public.athlete_modality_preferences enable row level security;
revoke all on public.athlete_modality_preferences from public, anon, authenticated;
grant select, insert, update on public.athlete_modality_preferences to authenticated;
create policy "athlete reads own modalities" on public.athlete_modality_preferences
 for select to authenticated using (user_id = (select auth.uid()));
create policy "athlete inserts own modalities" on public.athlete_modality_preferences
 for insert to authenticated with check (user_id = (select auth.uid()));
create policy "athlete updates own modalities" on public.athlete_modality_preferences
 for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Privileged lookups are private: the public entrypoints cannot accept an athlete id.
create schema if not exists private;
create function private.my_plan_modalities() returns text[]
language sql stable security definer set search_path = '' as $$
 select coalesce(array_agg(distinct p.modality order by p.modality), '{}'::text[])
 from public.tuition_agreements a
 join public.students s on s.id = a.student_id and s.organization_id = a.organization_id
 join public.tuition_plans p on p.id = a.plan_id and p.organization_id = a.organization_id
 where auth.uid() is not null and s.student_user_id = auth.uid()
   and a.status = 'active' and a.starts_on <= current_date
   and (a.ends_on is null or a.ends_on >= current_date)
   and p.modality is not null;
$$;
revoke all on function private.my_plan_modalities() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.my_plan_modalities() to authenticated;
create function public.get_my_athlete_modalities() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('automatic', private.my_plan_modalities(),
 'personal', coalesce((select modalities from public.athlete_modality_preferences where user_id = auth.uid()), '{}'::text[]));
$$;
revoke all on function public.get_my_athlete_modalities() from public, anon;
grant execute on function public.get_my_athlete_modalities() to authenticated;
create function public.save_my_athlete_modalities(p_modalities text[]) returns void
language sql security invoker set search_path = '' as $$
 insert into public.athlete_modality_preferences(user_id, modalities)
 values (auth.uid(), array(select distinct x from unnest(p_modalities) x order by x))
 on conflict (user_id) do update set modalities = excluded.modalities;
$$;
revoke all on function public.save_my_athlete_modalities(text[]) from public, anon;
grant execute on function public.save_my_athlete_modalities(text[]) to authenticated;

create function private.set_tuition_plan_modality(p_org_id uuid, p_plan_id uuid, p_modality text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
 if auth.uid() is null or not public.has_org_member_permission(p_org_id, 'financial') then
   raise exception 'NOT_AUTHORIZED';
 end if;
 select modality into v_old from public.tuition_plans where id = p_plan_id and organization_id = p_org_id for update;
 if not found then raise exception 'PLAN_NOT_FOUND'; end if;
 if v_old is not distinct from p_modality then return; end if;
 update public.tuition_plans set modality = p_modality where id = p_plan_id and organization_id = p_org_id;
 insert into public.finance_audit_events(organization_id, entity_type, entity_id, action, actor_user_id, before_state, after_state)
 values(p_org_id, 'plan', p_plan_id, 'modality_updated', auth.uid(), jsonb_build_object('modality',v_old), jsonb_build_object('modality',p_modality));
end;
$$;
revoke all on function private.set_tuition_plan_modality(uuid,uuid,text) from public, anon;
grant execute on function private.set_tuition_plan_modality(uuid,uuid,text) to authenticated;
create function public.set_tuition_plan_modality(p_org_id uuid, p_plan_id uuid, p_modality text) returns void
language sql security invoker set search_path = '' as $$
 select private.set_tuition_plan_modality(p_org_id, p_plan_id, p_modality);
$$;
revoke all on function public.set_tuition_plan_modality(uuid,uuid,text) from public, anon;
grant execute on function public.set_tuition_plan_modality(uuid,uuid,text) to authenticated;
create function public.create_tuition_plan_v2(p_org_id uuid, p_name text, p_amount_cents bigint, p_billing_day integer, p_idempotency_key text, p_description text default null, p_modality text default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_modality text;
begin
 -- v1 preserves permission checks, locking, idempotency and the financial audit.
 perform pg_advisory_xact_lock(hashtextextended('tuition_plan:' || p_org_id::text || ':' || trim(p_idempotency_key), 0));
 select modality into v_modality from public.tuition_plans where organization_id = p_org_id and idempotency_key = trim(p_idempotency_key);
 if found and v_modality is distinct from p_modality then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
 v_id := public.create_tuition_plan_v1(p_org_id,p_name,p_amount_cents,p_billing_day,p_idempotency_key,p_description);
 select modality into v_modality from public.tuition_plans where id = v_id and organization_id = p_org_id;
 if v_modality is not null and v_modality is distinct from p_modality then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
 perform private.set_tuition_plan_modality(p_org_id,v_id,p_modality);
 return v_id;
end;
$$;
revoke all on function public.create_tuition_plan_v2(uuid,text,bigint,integer,text,text,text) from public, anon;
grant execute on function public.create_tuition_plan_v2(uuid,text,bigint,integer,text,text,text) to authenticated;
