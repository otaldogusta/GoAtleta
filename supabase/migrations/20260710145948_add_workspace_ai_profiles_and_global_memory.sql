-- Workspace-aware AI profiles and explicit user-global preference memory.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.workspace_scope_quarantine (
  source_table text not null,
  record_id text not null,
  payload jsonb not null,
  reason text not null,
  quarantined_at timestamptz not null default now(),
  primary key (source_table, record_id)
);

alter table private.workspace_scope_quarantine enable row level security;

with orphaned_cycles as (
  delete from public.planning_cycles pc
  where not exists (
    select 1
    from public.classes c
    where c.id = pc.classid
  )
  returning pc.*
)
insert into private.workspace_scope_quarantine (
  source_table,
  record_id,
  payload,
  reason
)
select
  'planning_cycles',
  orphan.id,
  to_jsonb(orphan),
  'classid sem turma correspondente durante migracao de workspace'
from orphaned_cycles orphan
on conflict (source_table, record_id) do nothing;

create table if not exists public.organization_ai_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  organization_type text not null default 'club'
    check (organization_type in ('social_project', 'sports_school', 'club', 'personal')),
  city text,
  state text,
  priorities text[] not null default '{}'::text[],
  pedagogical_bias text[] not null default '{}'::text[],
  pillar_weights jsonb not null default '{}'::jsonb
    check (jsonb_typeof(pillar_weights) = 'object'),
  philosophy text not null default '',
  constraints text[] not null default '{}'::text[],
  goals text[] not null default '{}'::text[],
  equipment_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_ai_profiles enable row level security;

drop policy if exists organization_ai_profiles_select_member
  on public.organization_ai_profiles;
create policy organization_ai_profiles_select_member
  on public.organization_ai_profiles
  for select
  to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists organization_ai_profiles_insert_admin
  on public.organization_ai_profiles;
create policy organization_ai_profiles_insert_admin
  on public.organization_ai_profiles
  for insert
  to authenticated
  with check (public.is_org_admin(organization_id));

drop policy if exists organization_ai_profiles_update_admin
  on public.organization_ai_profiles;
create policy organization_ai_profiles_update_admin
  on public.organization_ai_profiles
  for update
  to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists organization_ai_profiles_delete_admin
  on public.organization_ai_profiles;
create policy organization_ai_profiles_delete_admin
  on public.organization_ai_profiles
  for delete
  to authenticated
  using (public.is_org_admin(organization_id));

revoke all on table public.organization_ai_profiles from anon;
grant select, insert, update, delete on table public.organization_ai_profiles to authenticated;

create table if not exists public.ai_user_global_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fact_type text not null
    check (fact_type in ('coach_preference', 'interface_preference', 'general')),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  confidence real not null default 0.5
    check (confidence >= 0.0 and confidence <= 1.0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists ai_user_global_facts_user_created_idx
  on public.ai_user_global_facts (user_id, created_at desc);
create index if not exists ai_user_global_facts_expires_idx
  on public.ai_user_global_facts (expires_at)
  where expires_at is not null;

alter table public.ai_user_global_facts enable row level security;

drop policy if exists ai_user_global_facts_select_own
  on public.ai_user_global_facts;
create policy ai_user_global_facts_select_own
  on public.ai_user_global_facts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists ai_user_global_facts_insert_own
  on public.ai_user_global_facts;
create policy ai_user_global_facts_insert_own
  on public.ai_user_global_facts
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists ai_user_global_facts_update_own
  on public.ai_user_global_facts;
create policy ai_user_global_facts_update_own
  on public.ai_user_global_facts
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists ai_user_global_facts_delete_own
  on public.ai_user_global_facts;
create policy ai_user_global_facts_delete_own
  on public.ai_user_global_facts
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.ai_user_global_facts from anon;
grant select, insert, update, delete on table public.ai_user_global_facts to authenticated;

-- Make the workspace boundary explicit on planning cycles instead of inferring it
-- only through classid.
alter table public.planning_cycles
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

update public.planning_cycles pc
set organization_id = c.organization_id
from public.classes c
where c.id = pc.classid
  and pc.organization_id is null;

do $$
begin
  if exists (select 1 from public.planning_cycles where organization_id is null) then
    raise exception 'planning_cycles contains rows without a resolvable organization_id';
  end if;
end $$;

alter table public.planning_cycles
  alter column organization_id set not null;

create index if not exists planning_cycles_org_class_status_idx
  on public.planning_cycles (organization_id, classid, status);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'classes_id_organization_unique'
      and conrelid = 'public.classes'::regclass
  ) then
    alter table public.classes
      add constraint classes_id_organization_unique unique (id, organization_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'planning_cycles_class_workspace_fk'
      and conrelid = 'public.planning_cycles'::regclass
  ) then
    alter table public.planning_cycles
      add constraint planning_cycles_class_workspace_fk
      foreign key (classid, organization_id)
      references public.classes (id, organization_id)
      on delete cascade;
  end if;
end $$;

drop policy if exists "planning_cycles select staff" on public.planning_cycles;
create policy "planning_cycles select staff"
  on public.planning_cycles
  for select
  to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      public.is_org_admin(organization_id)
      or public.is_class_staff(classid)
    )
  );

drop policy if exists "planning_cycles insert staff" on public.planning_cycles;
create policy "planning_cycles insert staff"
  on public.planning_cycles
  for insert
  to authenticated
  with check (
    public.is_org_member(organization_id)
    and (
      public.is_org_admin(organization_id)
      or public.is_class_staff(classid)
    )
  );

drop policy if exists "planning_cycles update staff" on public.planning_cycles;
create policy "planning_cycles update staff"
  on public.planning_cycles
  for update
  to authenticated
  using (
    public.is_org_member(organization_id)
    and (
      public.is_org_admin(organization_id)
      or public.is_class_staff(classid)
    )
  )
  with check (
    public.is_org_member(organization_id)
    and (
      public.is_org_admin(organization_id)
      or public.is_class_staff(classid)
    )
  );

drop policy if exists "planning_cycles delete admin" on public.planning_cycles;
create policy "planning_cycles delete admin"
  on public.planning_cycles
  for delete
  to authenticated
  using (public.is_org_admin(organization_id));

-- Known institutional profiles. Other organizations receive neutral defaults in
-- the application until an administrator configures a profile.
insert into public.organization_ai_profiles (
  organization_id,
  organization_type,
  city,
  state,
  priorities,
  pedagogical_bias,
  pillar_weights,
  philosophy,
  goals
)
select
  o.id,
  'social_project',
  'Curitiba',
  'PR',
  array['convivencia_social', 'direitos_humanos', 'saude', 'territorio', 'participacao', 'cooperacao'],
  array['sociocultural', 'cognitivist'],
  '{"reports":1.15,"attendance":1.2,"periodization":1.0,"preferences":1.0,"calendar":1.1,"physical_load":1.0,"feedback_history":1.1,"individual_context":1.25}'::jsonb,
  'Formacao esportiva orientada por participacao, cooperacao, saude e contexto social.',
  array['ampliar_participacao', 'fortalecer_cooperacao', 'desenvolver_autonomia']
from public.organizations o
where lower(o.name) like '%rede esperan%'
   or exists (
     select 1
     from public.classes c
     where c.organization_id = o.id
       and lower(coalesce(c.unit, '')) like '%rede esperan%'
   )
on conflict (organization_id) do nothing;

insert into public.organization_ai_profiles (
  organization_id,
  organization_type,
  city,
  state,
  priorities,
  pedagogical_bias,
  pillar_weights,
  philosophy,
  goals
)
select
  o.id,
  'sports_school',
  'Pinhais',
  'PR',
  array['aprendizagem_tecnica', 'progressao_esportiva', 'frequencia', 'desempenho', 'competicao', 'desenvolvimento_motor'],
  array['cognitivist'],
  '{"reports":1.1,"attendance":1.1,"periodization":1.2,"preferences":1.0,"calendar":1.15,"physical_load":1.2,"feedback_history":1.05,"individual_context":1.1}'::jsonb,
  'Desenvolvimento esportivo progressivo com estabilidade tecnica e tomada de decisao.',
  array['consolidar_tecnica', 'progredir_complexidade', 'preparar_competicao']
from public.organizations o
where lower(o.name) like '%rede esportes%'
on conflict (organization_id) do nothing;
