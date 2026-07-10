-- Separate workspace data isolation from hierarchical institutional interpretation.

create table public.institutional_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope_type text not null
    check (scope_type in ('workspace', 'program', 'modality', 'class')),
  scope_id text not null check (length(trim(scope_id)) > 0),
  scope_label text not null check (length(trim(scope_label)) > 0),
  organization_type text
    check (
      organization_type is null
      or organization_type in (
        'multi_context',
        'social_project',
        'sports_program',
        'sports_school',
        'club',
        'personal'
      )
    ),
  city text,
  state text,
  priorities text[],
  pedagogical_bias text[],
  pillar_weights jsonb
    check (pillar_weights is null or jsonb_typeof(pillar_weights) = 'object'),
  philosophy text,
  constraints text[],
  goals text[],
  equipment_notes text,
  communication_preferences jsonb
    check (
      communication_preferences is null
      or jsonb_typeof(communication_preferences) = 'object'
    ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index institutional_profiles_one_active_scope_idx
  on public.institutional_profiles (organization_id, scope_type, scope_id)
  where active;

create or replace function private.validate_institutional_profile_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scope_type = 'workspace' then
    if new.scope_id <> 'workspace:' || new.organization_id::text then
      raise exception 'workspace scope must match organization_id';
    end if;
  elsif new.scope_type = 'program' then
    if new.scope_id like 'unit:%' then
      if not exists (
        select 1
        from public.classes c
        where c.organization_id = new.organization_id
          and c.unit_id = substring(new.scope_id from 6)
      ) then
        raise exception 'program scope must reference a unit in the same organization';
      end if;
    elsif new.scope_id !~ '^unit_label:[a-z0-9_]+$' then
      raise exception 'program scope must use unit:<id> or unit_label:<normalized_label>';
    end if;
  elsif new.scope_type = 'modality' then
    if new.scope_id !~ '^modality:[a-z0-9_]+$' then
      raise exception 'modality scope must use modality:<normalized_modality>';
    end if;
  elsif new.scope_type = 'class' then
    if new.scope_id not like 'class:%' or not exists (
      select 1
      from public.classes c
      where c.organization_id = new.organization_id
        and c.id = substring(new.scope_id from 7)
    ) then
      raise exception 'class scope must reference a class in the same organization';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_institutional_profile_scope()
  from public, anon, authenticated, service_role;

create trigger institutional_profiles_validate_scope
before insert or update of organization_id, scope_type, scope_id
on public.institutional_profiles
for each row execute function private.validate_institutional_profile_scope();

create or replace function private.set_institutional_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_institutional_profile_updated_at()
  from public, anon, authenticated, service_role;

create trigger institutional_profiles_set_updated_at
before update on public.institutional_profiles
for each row execute function private.set_institutional_profile_updated_at();

alter table public.institutional_profiles enable row level security;

create policy institutional_profiles_select_member
  on public.institutional_profiles
  for select
  to authenticated
  using ((select public.is_org_member(organization_id)));

create policy institutional_profiles_insert_admin
  on public.institutional_profiles
  for insert
  to authenticated
  with check ((select public.is_org_admin(organization_id)));

create policy institutional_profiles_update_admin
  on public.institutional_profiles
  for update
  to authenticated
  using ((select public.is_org_admin(organization_id)))
  with check ((select public.is_org_admin(organization_id)));

create policy institutional_profiles_delete_admin
  on public.institutional_profiles
  for delete
  to authenticated
  using ((select public.is_org_admin(organization_id)));

revoke all on table public.institutional_profiles from anon, authenticated;
grant select, insert, update, delete on table public.institutional_profiles
  to authenticated;
grant all on table public.institutional_profiles to service_role;

-- Preserve existing workspace-level profiles as the initial base layer.
insert into public.institutional_profiles (
  organization_id,
  scope_type,
  scope_id,
  scope_label,
  organization_type,
  city,
  state,
  priorities,
  pedagogical_bias,
  pillar_weights,
  philosophy,
  constraints,
  goals,
  equipment_notes
)
select
  p.organization_id,
  'workspace',
  'workspace:' || p.organization_id::text,
  trim(o.name),
  p.organization_type,
  p.city,
  p.state,
  p.priorities,
  p.pedagogical_bias,
  p.pillar_weights,
  p.philosophy,
  p.constraints,
  p.goals,
  p.equipment_notes
from public.organization_ai_profiles p
join public.organizations o on o.id = p.organization_id;

-- A multi-unit personal workspace is neutral at its security boundary.
update public.institutional_profiles p
set
  organization_type = 'multi_context',
  city = null,
  state = null,
  priorities = '{}'::text[],
  pedagogical_bias = '{}'::text[],
  pillar_weights = '{
    "reports": 1,
    "attendance": 1,
    "periodization": 1,
    "preferences": 1,
    "calendar": 1,
    "physical_load": 1,
    "feedback_history": 1,
    "individual_context": 1
  }'::jsonb,
  philosophy = 'Workspace multiunidade; o contexto institucional e resolvido abaixo deste nivel.',
  constraints = '{}'::text[],
  goals = '{}'::text[],
  equipment_notes = ''
from public.organizations o
where p.organization_id = o.id
  and p.scope_type = 'workspace'
  and lower(trim(o.name)) = 'gustavo workspace';

-- Rede Esperanca is a program/unit inside Gustavo Workspace, not a workspace.
insert into public.institutional_profiles (
  organization_id,
  scope_type,
  scope_id,
  scope_label,
  organization_type,
  city,
  state,
  priorities,
  pedagogical_bias,
  pillar_weights,
  philosophy,
  goals,
  communication_preferences
)
select distinct on (c.organization_id, c.unit_id)
  c.organization_id,
  'program',
  'unit:' || c.unit_id,
  'Rede Esperança',
  'social_project',
  'Curitiba',
  'PR',
  array['convivencia_social', 'direitos_humanos', 'saude', 'territorio', 'participacao', 'cooperacao'],
  array['sociocultural', 'cognitivist'],
  '{
    "reports": 1.2,
    "attendance": 1.2,
    "periodization": 0.9,
    "preferences": 1,
    "calendar": 1,
    "physical_load": 0.8,
    "feedback_history": 1.2,
    "individual_context": 1.3
  }'::jsonb,
  'Formacao esportiva orientada por participacao, cooperacao, saude e contexto social.',
  array['ampliar_participacao', 'fortalecer_cooperacao', 'desenvolver_autonomia'],
  '{"tone":"acolhedor_direto","emphasize_collective_progress":true}'::jsonb
from public.classes c
join public.organizations o on o.id = c.organization_id
where lower(trim(o.name)) = 'gustavo workspace'
  and c.unit_id is not null
  and lower(trim(c.unit)) in ('rede esperança', 'rede esperanca')
order by c.organization_id, c.unit_id, c.created_at;

-- Natação is a modality profile prepared for future classes in the same workspace.
insert into public.institutional_profiles (
  organization_id,
  scope_type,
  scope_id,
  scope_label,
  organization_type,
  priorities,
  pedagogical_bias,
  pillar_weights,
  philosophy,
  goals
)
select
  o.id,
  'modality',
  'modality:natacao',
  'Natação',
  'sports_program',
  array['aprendizagem_tecnica', 'seguranca_aquatica', 'progressao_esportiva', 'desenvolvimento_motor'],
  array['cognitivist'],
  '{
    "reports": 1,
    "attendance": 1,
    "periodization": 1.2,
    "preferences": 1,
    "calendar": 1,
    "physical_load": 1.2,
    "feedback_history": 1,
    "individual_context": 1.2
  }'::jsonb,
  'Progressao aquatica orientada por seguranca, dominio tecnico e carga adequada.',
  array['consolidar_tecnica', 'progredir_complexidade', 'preservar_seguranca_aquatica']
from public.organizations o
where lower(trim(o.name)) = 'gustavo workspace';

-- Keep the legacy fallback neutral during the Edge Function rollout window.
update public.organization_ai_profiles p
set
  organization_type = 'club',
  city = null,
  state = null,
  priorities = '{}'::text[],
  pedagogical_bias = '{}'::text[],
  pillar_weights = '{
    "reports": 1,
    "attendance": 1,
    "periodization": 1,
    "preferences": 1,
    "calendar": 1,
    "physical_load": 1,
    "feedback_history": 1,
    "individual_context": 1
  }'::jsonb,
  philosophy = 'Perfil legado neutro; use institutional_profiles para interpretacao hierarquica.',
  constraints = '{}'::text[],
  goals = '{}'::text[],
  equipment_notes = '',
  updated_at = now()
from public.organizations o
where p.organization_id = o.id
  and lower(trim(o.name)) = 'gustavo workspace';
