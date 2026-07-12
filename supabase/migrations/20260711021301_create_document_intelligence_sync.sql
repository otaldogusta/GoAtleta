create extension if not exists pgcrypto;

create table public.google_drive_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  refresh_token_secret_id uuid,
  refresh_token_ciphertext text,
  refresh_token_iv text,
  scopes text[] not null default array['https://www.googleapis.com/auth/drive.readonly'],
  google_account_email text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.google_drive_oauth_states (
  state text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null,
  redirect_to text not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

create table public.document_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.google_drive_connections(id) on delete cascade,
  provider text not null check (provider = 'google_drive'),
  folder_id text,
  external_id text not null,
  source_url text not null,
  filename text not null,
  mime_type text not null,
  unit_id text,
  modality_id text,
  class_id text references public.classes(id) on delete restrict,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, external_id)
);

create table public.document_source_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.document_sources(id) on delete cascade,
  external_revision_id text,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  modified_at timestamptz,
  byte_size bigint check (byte_size is null or byte_size between 0 and 26214400),
  extraction_status text not null check (extraction_status in ('pending','ready','review_required','failed')),
  normalized_content text,
  error_code text,
  created_at timestamptz not null default now(),
  unique (organization_id, source_id, content_hash)
);

create table public.document_interpretations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  revision_id uuid not null references public.document_source_revisions(id) on delete cascade,
  document_type text not null check (document_type in ('monthly_plan','monthly_report','unknown')),
  extraction_confidence numeric not null check (extraction_confidence between 0 and 1),
  interpretation jsonb not null,
  warnings jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.document_context_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  interpretation_id uuid not null references public.document_interpretations(id) on delete cascade,
  unit_id text,
  modality_id text,
  class_id text references public.classes(id) on delete restrict,
  period text,
  confidence numeric not null check (confidence between 0 and 1),
  status text not null check (status in ('confirmed','ambiguous','unresolved')),
  confirmed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.document_app_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null references public.classes(id) on delete restrict,
  period text not null,
  state_version text not null check (state_version ~ '^[a-f0-9]{64}$'),
  state jsonb not null,
  captured_by uuid not null references auth.users(id),
  captured_at timestamptz not null default now()
);

create table public.document_merge_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  class_id text not null references public.classes(id) on delete restrict,
  binding_id uuid not null references public.document_context_bindings(id) on delete cascade,
  snapshot_id uuid not null references public.document_app_state_snapshots(id) on delete restrict,
  snapshot_version text not null,
  status text not null check (status in ('draft','approved','partially_approved','rejected','applied','expired')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table public.document_merge_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null references public.document_merge_proposals(id) on delete cascade,
  kind text not null,
  target_type text not null,
  target_id text,
  target_field text,
  category text not null check (category in ('keep','complement','adjust','ignore')),
  current_value jsonb,
  proposed_value jsonb,
  recommendation text not null check (recommendation in ('apply','review','keep_current','ignore')),
  reason text not null,
  recommendation_confidence numeric not null check (recommendation_confidence between 0 and 1),
  source_evidence jsonb not null default '[]'
);

create table public.document_change_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  proposal_id uuid not null references public.document_merge_proposals(id) on delete restrict,
  idempotency_key text not null,
  expected_state_version text not null,
  previous_version text not null,
  resulting_version text not null,
  approved_by uuid not null references auth.users(id),
  applied_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid references auth.users(id),
  unique (organization_id, idempotency_key)
);

create table public.document_change_application_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  application_id uuid not null references public.document_change_applications(id) on delete cascade,
  merge_item_id uuid not null references public.document_merge_items(id) on delete restrict,
  target_type text not null,
  target_id text not null,
  target_field text not null,
  previous_value jsonb,
  applied_value jsonb not null,
  unique (application_id, merge_item_id)
);

create index document_sources_org_class on public.document_sources(organization_id, class_id);
create index document_revisions_source_created on public.document_source_revisions(source_id, created_at desc);
create index document_proposals_org_class on public.document_merge_proposals(organization_id, class_id, created_at desc);
create index document_snapshots_org_class on public.document_app_state_snapshots(organization_id, class_id, captured_at desc);
create index document_items_proposal on public.document_merge_items(proposal_id);
create index document_applications_proposal on public.document_change_applications(proposal_id, applied_at desc);

create or replace function public.validate_document_context_scope()
returns trigger language plpgsql security invoker set search_path = public as $$
declare c public.classes%rowtype;
begin
  if new.class_id is null then return new; end if;
  select * into c from public.classes where id = new.class_id;
  if c.id is null or c.organization_id <> new.organization_id then
    raise exception 'class does not belong to organization';
  end if;
  if new.unit_id is not null and c.unit_id is distinct from new.unit_id then
    raise exception 'unit does not match class organization context';
  end if;
  if new.modality_id is not null and lower(c.modality) is distinct from lower(new.modality_id) then
    raise exception 'modality does not match class organization context';
  end if;
  return new;
end $$;

create trigger document_sources_validate_scope before insert or update on public.document_sources
for each row execute function public.validate_document_context_scope();
create trigger document_bindings_validate_scope before insert or update on public.document_context_bindings
for each row execute function public.validate_document_context_scope();
create or replace function public.validate_document_snapshot_scope()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.classes c where c.id = new.class_id and c.organization_id = new.organization_id) then
    raise exception 'class does not belong to organization';
  end if;
  return new;
end $$;
create trigger document_snapshots_validate_scope before insert or update on public.document_app_state_snapshots
for each row execute function public.validate_document_snapshot_scope();

alter table public.google_drive_connections enable row level security;
alter table public.google_drive_oauth_states enable row level security;
alter table public.document_sources enable row level security;
alter table public.document_source_revisions enable row level security;
alter table public.document_interpretations enable row level security;
alter table public.document_context_bindings enable row level security;
alter table public.document_app_state_snapshots enable row level security;
alter table public.document_merge_proposals enable row level security;
alter table public.document_merge_items enable row level security;
alter table public.document_change_applications enable row level security;
alter table public.document_change_application_items enable row level security;

create policy google_drive_oauth_states_server_only on public.google_drive_oauth_states
for all to authenticated using (false) with check (false);

create or replace function public.can_manage_document_org(_organization_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = _organization_id
      and om.user_id = (select auth.uid())
      and om.role_level >= 40
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'google_drive_connections','document_sources','document_source_revisions',
    'document_interpretations','document_context_bindings','document_app_state_snapshots','document_merge_proposals',
    'document_merge_items','document_change_applications','document_change_application_items'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.can_manage_document_org(organization_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_manage_document_org(organization_id))', t || '_insert', t);
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end $$;

create policy document_merge_proposals_update on public.document_merge_proposals
for update to authenticated using (public.can_manage_document_org(organization_id))
with check (public.can_manage_document_org(organization_id));
create policy document_change_applications_update on public.document_change_applications
for update to authenticated using (public.can_manage_document_org(organization_id))
with check (public.can_manage_document_org(organization_id));
grant update on table public.document_merge_proposals, public.document_change_applications to authenticated;

revoke all on table public.google_drive_connections from authenticated;
grant select (id, organization_id, user_id, scopes, google_account_email, expires_at, created_at, updated_at)
  on table public.google_drive_connections to authenticated;
grant select, insert on table public.document_sources, public.document_source_revisions,
  public.document_interpretations, public.document_context_bindings, public.document_app_state_snapshots,
  public.document_merge_proposals, public.document_merge_items,
  public.document_change_applications, public.document_change_application_items to authenticated;

create or replace function public.document_planning_state_version(_organization_id uuid, _class_id text)
returns text language sql stable security invoker set search_path = public as $$
  select encode(extensions.digest(jsonb_build_object(
    'cycles', coalesce((select jsonb_agg(to_jsonb(cp) order by cp.id) from public.class_plans cp
      where cp.organization_id = _organization_id and cp.classid = _class_id), '[]'::jsonb),
    'planning', coalesce((select jsonb_agg(to_jsonb(tp) order by tp.id) from public.training_plans tp
      where tp.organization_id = _organization_id and tp.classid = _class_id), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(to_jsonb(ts) order by ts.id) from public.training_sessions ts
      join public.training_session_classes tsc on tsc.session_id = ts.id
      where ts.organization_id = _organization_id and tsc.class_id = _class_id), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(sl) order by sl.id) from public.session_logs sl
      where sl.organization_id = _organization_id and sl.classid = _class_id), '[]'::jsonb),
    'decisions', coalesce((select jsonb_agg(to_jsonb(dt) order by dt.id) from public.ai_decision_traces dt
      where dt.organization_id = _organization_id and dt.class_id = _class_id), '[]'::jsonb)
  )::text, 'sha256'), 'hex');
$$;

create or replace function public.apply_approved_document_changes(
  _proposal_id uuid,
  _approved_item_ids uuid[],
  _expected_state_version text,
  _idempotency_key text
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  p public.document_merge_proposals%rowtype;
  existing public.document_change_applications%rowtype;
  app_id uuid := gen_random_uuid();
  before_version text;
  after_version text;
  i public.document_merge_items%rowtype;
  old_value jsonb;
begin
  select * into p from public.document_merge_proposals where id = _proposal_id for update;
  if p.id is null or not public.can_manage_document_org(p.organization_id) then raise exception 'proposal not available'; end if;
  select * into existing from public.document_change_applications
    where organization_id = p.organization_id and idempotency_key = _idempotency_key;
  if existing.id is not null then return to_jsonb(existing); end if;
  if p.status not in ('draft','approved','partially_approved') or p.expires_at <= now() then raise exception 'proposal expired'; end if;
  before_version := public.document_planning_state_version(p.organization_id, p.class_id);
  if before_version is distinct from _expected_state_version or p.snapshot_version is distinct from _expected_state_version then
    update public.document_merge_proposals set status = 'expired' where id = p.id;
    raise exception 'planning state changed';
  end if;
  if exists (select 1 from unnest(_approved_item_ids) x left join public.document_merge_items mi on mi.id=x and mi.proposal_id=p.id where mi.id is null) then
    raise exception 'approved item does not belong to proposal';
  end if;

  insert into public.document_change_applications(id, organization_id, proposal_id, idempotency_key,
    expected_state_version, previous_version, resulting_version, approved_by)
  values(app_id, p.organization_id, p.id, _idempotency_key, _expected_state_version, before_version, before_version, auth.uid());

  for i in select * from public.document_merge_items where proposal_id=p.id and id=any(_approved_item_ids) loop
    if i.target_type <> 'cycle' or i.target_id is null or i.target_field not in ('theme','technical_focus','constraints','ruleset') then
      raise exception 'unsupported or unsafe document target';
    end if;
    select case i.target_field
      when 'theme' then to_jsonb(theme)
      when 'technical_focus' then to_jsonb(technical_focus)
      when 'constraints' then to_jsonb(constraints)
      when 'ruleset' then to_jsonb(ruleset)
    end into old_value from public.class_plans
      where id=i.target_id and organization_id=p.organization_id and classid=p.class_id for update;
    if not found then raise exception 'planning target not found'; end if;
    update public.class_plans set
      theme = case when i.target_field='theme' then i.proposed_value#>>'{}' else theme end,
      technical_focus = case when i.target_field='technical_focus' then i.proposed_value#>>'{}' else technical_focus end,
      constraints = case when i.target_field='constraints' then i.proposed_value#>>'{}' else constraints end,
      ruleset = case when i.target_field='ruleset' then i.proposed_value#>>'{}' else ruleset end,
      updated_at = now(), updatedat = now()
      where id=i.target_id and organization_id=p.organization_id and classid=p.class_id;
    insert into public.document_change_application_items(organization_id, application_id, merge_item_id,
      target_type, target_id, target_field, previous_value, applied_value)
    values(p.organization_id, app_id, i.id, i.target_type, i.target_id, i.target_field, old_value, i.proposed_value);
  end loop;

  after_version := public.document_planning_state_version(p.organization_id, p.class_id);
  update public.document_change_applications set resulting_version=after_version where id=app_id;
  update public.document_merge_proposals set status = case when cardinality(_approved_item_ids) =
    (select count(*) from public.document_merge_items where proposal_id=p.id and recommendation='apply')
    then 'applied' else 'partially_approved' end where id=p.id;
  return (select to_jsonb(a) from public.document_change_applications a where a.id=app_id);
end $$;

create or replace function public.undo_document_changes(_application_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare a public.document_change_applications%rowtype; i public.document_change_application_items%rowtype;
begin
  select * into a from public.document_change_applications where id=_application_id for update;
  if a.id is null or not public.can_manage_document_org(a.organization_id) then raise exception 'application not available'; end if;
  if a.undone_at is not null then return to_jsonb(a); end if;
  if public.document_planning_state_version(a.organization_id,
      (select class_id from public.document_merge_proposals where id=a.proposal_id)) is distinct from a.resulting_version then
    raise exception 'planning state changed after application';
  end if;
  for i in select * from public.document_change_application_items where application_id=a.id loop
    update public.class_plans set
      theme = case when i.target_field='theme' then i.previous_value#>>'{}' else theme end,
      technical_focus = case when i.target_field='technical_focus' then i.previous_value#>>'{}' else technical_focus end,
      constraints = case when i.target_field='constraints' then i.previous_value#>>'{}' else constraints end,
      ruleset = case when i.target_field='ruleset' then i.previous_value#>>'{}' else ruleset end,
      updated_at=now(), updatedat=now()
      where id=i.target_id and organization_id=a.organization_id;
  end loop;
  update public.document_change_applications set undone_at=now(), undone_by=auth.uid() where id=a.id returning * into a;
  return to_jsonb(a);
end $$;

revoke all on function public.apply_approved_document_changes(uuid,uuid[],text,text) from public, anon;
revoke all on function public.undo_document_changes(uuid) from public, anon;
grant execute on function public.apply_approved_document_changes(uuid,uuid[],text,text) to authenticated;
grant execute on function public.undo_document_changes(uuid) to authenticated;
