-- Document Drive source foundation.
-- Extends the existing document-intelligence and KB/RAG tables for academic and
-- operational folders; scientific_sources remains separately governed.

create extension if not exists vector with schema extensions;

alter table public.google_drive_connections
  add column if not exists connection_scope text not null default 'workspace',
  add column if not exists sync_root_folder_id text,
  add column if not exists source_profile text not null default 'unknown',
  add column if not exists bound_class_id text references public.classes(id) on delete restrict,
  add column if not exists class_binding_confirmed_at timestamptz,
  add column if not exists class_binding_confirmed_by uuid references auth.users(id) on delete restrict,
  add column if not exists sync_cursor text,
  add column if not exists sync_status text not null default 'idle',
  add column if not exists sync_started_at timestamptz,
  add column if not exists sync_completed_at timestamptz,
  add column if not exists sync_error_code text,
  add column if not exists sync_error_message text;

update public.google_drive_connections
set source_profile = 'academic'
where connection_scope in ('user_academic', 'workspace_academic')
  and source_profile = 'unknown';

alter table public.google_drive_connections
  drop constraint if exists google_drive_connections_organization_id_user_id_key,
  drop constraint if exists google_drive_connections_organization_user_scope_key,
  drop constraint if exists google_drive_connections_source_identity_key,
  add constraint google_drive_connections_source_identity_key
    unique (
      organization_id,
      user_id,
      connection_scope,
      sync_root_folder_id,
      source_profile
    ),
  drop constraint if exists google_drive_connections_connection_scope_check,
  add constraint google_drive_connections_connection_scope_check
    check (connection_scope in ('workspace', 'workspace_academic', 'user_academic')),
  drop constraint if exists google_drive_connections_source_profile_check,
  add constraint google_drive_connections_source_profile_check
    check (
      source_profile in (
        'academic',
        'institutional_actions',
        'monthly_plan',
        'report',
        'lesson_plan',
        'unknown'
      )
    ),
  drop constraint if exists google_drive_connections_academic_profile_check,
  add constraint google_drive_connections_academic_profile_check
    check (
      (
        connection_scope in ('user_academic', 'workspace_academic')
        and source_profile = 'academic'
        and bound_class_id is null
      )
      or (
        connection_scope = 'workspace'
        and source_profile <> 'academic'
      )
    ),
  drop constraint if exists google_drive_connections_confirmed_class_check,
  add constraint google_drive_connections_confirmed_class_check
    check (
      (
        bound_class_id is null
        and class_binding_confirmed_at is null
        and class_binding_confirmed_by is null
      )
      or (
        bound_class_id is not null
        and class_binding_confirmed_at is not null
        and class_binding_confirmed_by is not null
      )
    ),
  drop constraint if exists google_drive_connections_sync_status_check,
  add constraint google_drive_connections_sync_status_check
    check (sync_status in ('idle', 'running', 'succeeded', 'partial', 'failed'));

alter table public.document_sources
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists source_scope text not null default 'workspace_institutional',
  add column if not exists source_profile text not null default 'unknown',
  add column if not exists folder_role text not null default 'unknown',
  add column if not exists month_key text,
  add column if not exists discipline text,
  add column if not exists academic_area text,
  add column if not exists material_type text not null default 'unknown',
  add column if not exists evidence_kind text not null default 'unknown_support',
  add column if not exists author text,
  add column if not exists institution text,
  add column if not exists academic_period text,
  add column if not exists topic text,
  add column if not exists audience text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists sync_state text not null default 'active',
  add column if not exists last_seen_at timestamptz,
  add column if not exists removed_at timestamptz;

alter table public.document_sources
  drop constraint if exists document_sources_organization_id_provider_external_id_key,
  drop constraint if exists document_sources_connection_provider_external_key,
  add constraint document_sources_connection_provider_external_key
    unique (organization_id, connection_id, provider, external_id);

update public.document_sources
set source_scope = case
  when class_id is not null then 'class_planning'
  else 'workspace_institutional'
end
where source_scope = 'workspace_institutional'
  and source_profile = 'unknown'
  and folder_role = 'unknown';

update public.document_sources
set
  source_profile = case
    when source_scope in ('user_academic', 'workspace_academic') then 'academic'
    when source_scope = 'class_history' then 'report'
    else source_profile
  end,
  folder_role = case
    when source_scope in ('user_academic', 'workspace_academic') then 'academic'
    when source_scope = 'class_history' then 'report'
    else folder_role
  end;

alter table public.document_sources
  drop constraint if exists document_sources_source_scope_check,
  add constraint document_sources_source_scope_check
    check (
      source_scope in (
        'user_academic',
        'workspace_academic',
        'workspace_institutional',
        'class_planning',
        'class_history',
        'scientific_reference'
      )
    ),
  drop constraint if exists document_sources_source_profile_check,
  add constraint document_sources_source_profile_check
    check (
      source_profile in (
        'academic',
        'institutional_actions',
        'monthly_plan',
        'report',
        'lesson_plan',
        'unknown'
      )
    ),
  drop constraint if exists document_sources_folder_role_check,
  add constraint document_sources_folder_role_check
    check (
      folder_role in (
        'academic',
        'institutional_actions',
        'monthly_plan',
        'report',
        'lesson_plan',
        'unknown'
      )
    ),
  drop constraint if exists document_sources_month_key_check,
  add constraint document_sources_month_key_check
    check (
      month_key is null
      or month_key ~ '^(20[0-9]{2}-)?(0[1-9]|1[0-2])$'
    ),
  drop constraint if exists document_sources_personal_scope_check,
  add constraint document_sources_personal_scope_check
    check (
      source_scope <> 'user_academic'
      or (owner_user_id is not null and class_id is null)
    ),
  drop constraint if exists document_sources_academic_no_class_check,
  add constraint document_sources_academic_no_class_check
    check (
      source_scope not in ('user_academic', 'workspace_academic')
      or class_id is null
    ),
  drop constraint if exists document_sources_academic_profile_check,
  add constraint document_sources_academic_profile_check
    check (
      (
        source_scope in ('user_academic', 'workspace_academic')
        and source_profile = 'academic'
        and folder_role = 'academic'
        and class_id is null
      )
      or source_scope not in ('user_academic', 'workspace_academic')
    ),
  drop constraint if exists document_sources_discipline_check,
  add constraint document_sources_discipline_check
    check (
      discipline is null
      or discipline in (
        'gestao_trabalho_pedagogico',
        'pratica_ensino_educacao_infantil',
        'curriculo_fundamentos_cultura',
        'educacao_basica_politica_legislacao',
        'libras',
        'tendencias_pedagogicas_didatica',
        'unknown'
      )
    ),
  drop constraint if exists document_sources_academic_area_check,
  add constraint document_sources_academic_area_check
    check (
      academic_area is null
      or academic_area in (
        'didatica',
        'curriculo',
        'politicas_educacionais',
        'planejamento_pedagogico',
        'avaliacao',
        'desenvolvimento_infantil',
        'inclusao',
        'acessibilidade',
        'libras',
        'metodologias_ensino',
        'abordagens_pedagogicas',
        'gestao_educacional',
        'legislacao',
        'etica',
        'conhecimento_cientifico_tecnico',
        'nao_classificado'
      )
    ),
  drop constraint if exists document_sources_material_type_check,
  add constraint document_sources_material_type_check
    check (
      material_type in (
        'official_norm',
        'scientific_article',
        'book_or_chapter',
        'university_handout',
        'lecture_presentation',
        'student_summary',
        'personal_note',
        'unknown'
      )
    ),
  drop constraint if exists document_sources_evidence_kind_check,
  add constraint document_sources_evidence_kind_check
    check (
      evidence_kind in (
        'official_norm',
        'scientific_research',
        'published_book',
        'institutional_academic_material',
        'classroom_academic_material',
        'student_authored_summary',
        'personal_note',
        'unknown_support'
      )
    ),
  drop constraint if exists document_sources_metadata_object_check,
  add constraint document_sources_metadata_object_check
    check (jsonb_typeof(metadata) = 'object'),
  drop constraint if exists document_sources_sync_state_check,
  add constraint document_sources_sync_state_check
    check (sync_state in ('active', 'unchanged', 'changed', 'removed', 'failed'));

alter table public.document_source_revisions
  add column if not exists parser_name text,
  add column if not exists parser_version text,
  add column if not exists extraction_provenance jsonb not null default '{}'::jsonb;

alter table public.document_source_revisions
  drop constraint if exists document_source_revisions_provenance_object_check,
  add constraint document_source_revisions_provenance_object_check
    check (jsonb_typeof(extraction_provenance) = 'object');

alter table public.document_interpretations
  drop constraint if exists document_interpretations_document_type_check;

alter table public.document_interpretations
  add constraint document_interpretations_document_type_check
    check (
      document_type in (
        'monthly_plan',
        'monthly_report',
        'lesson_plan',
        'report',
        'calendar',
        'assessment',
        'institutional_guidance',
        'regulation',
        'academic_support',
        'unknown'
      )
    ),
  add column if not exists source_profile text not null default 'unknown',
  add column if not exists folder_role text not null default 'unknown',
  add column if not exists month_key text,
  add column if not exists discipline text,
  add column if not exists academic_area text,
  add column if not exists material_type text not null default 'unknown',
  add column if not exists evidence_kind text not null default 'unknown_support',
  add column if not exists evidence_confidence numeric,
  add column if not exists canonical_revision_id uuid
    references public.document_source_revisions(id) on delete cascade,
  add column if not exists extraction_provenance jsonb not null default '{}'::jsonb;

update public.document_interpretations
set
  source_profile = case
    when document_type = 'academic_support' then 'academic'
    when document_type = 'institutional_guidance' then 'institutional_actions'
    when document_type in ('monthly_plan', 'report', 'lesson_plan') then document_type
    when document_type = 'monthly_report' then 'report'
    else source_profile
  end,
  folder_role = case
    when document_type = 'academic_support' then 'academic'
    when document_type = 'institutional_guidance' then 'institutional_actions'
    when document_type in ('monthly_plan', 'report', 'lesson_plan') then document_type
    when document_type = 'monthly_report' then 'report'
    else folder_role
  end;

with latest_interpretation as (
  select distinct on (revision.source_id)
    revision.source_id,
    interpretation.source_profile,
    interpretation.folder_role
  from public.document_source_revisions revision
  join public.document_interpretations interpretation
    on interpretation.revision_id = revision.id
  order by revision.source_id, interpretation.created_at desc
)
update public.document_sources source
set
  source_scope = case
    when latest.source_profile = 'report' then 'class_history'
    when latest.source_profile in ('monthly_plan', 'lesson_plan')
      then 'class_planning'
    when latest.source_profile = 'institutional_actions'
      then 'workspace_institutional'
    else source.source_scope
  end,
  source_profile = latest.source_profile,
  folder_role = latest.folder_role
from latest_interpretation latest
where source.id = latest.source_id
  and latest.source_profile <> 'academic';

alter table public.document_interpretations
  drop constraint if exists document_interpretations_source_profile_check,
  add constraint document_interpretations_source_profile_check
    check (
      source_profile in (
        'academic',
        'institutional_actions',
        'monthly_plan',
        'report',
        'lesson_plan',
        'unknown'
      )
    ),
  drop constraint if exists document_interpretations_folder_role_check,
  add constraint document_interpretations_folder_role_check
    check (
      folder_role in (
        'academic',
        'institutional_actions',
        'monthly_plan',
        'report',
        'lesson_plan',
        'unknown'
      )
    ),
  drop constraint if exists document_interpretations_month_key_check,
  add constraint document_interpretations_month_key_check
    check (
      month_key is null
      or month_key ~ '^(20[0-9]{2}-)?(0[1-9]|1[0-2])$'
    ),
  drop constraint if exists document_interpretations_discipline_check,
  add constraint document_interpretations_discipline_check
    check (
      discipline is null
      or discipline in (
        'gestao_trabalho_pedagogico',
        'pratica_ensino_educacao_infantil',
        'curriculo_fundamentos_cultura',
        'educacao_basica_politica_legislacao',
        'libras',
        'tendencias_pedagogicas_didatica',
        'unknown'
      )
    ),
  drop constraint if exists document_interpretations_academic_area_check,
  add constraint document_interpretations_academic_area_check
    check (
      academic_area is null
      or academic_area in (
        'didatica',
        'curriculo',
        'politicas_educacionais',
        'planejamento_pedagogico',
        'avaliacao',
        'desenvolvimento_infantil',
        'inclusao',
        'acessibilidade',
        'libras',
        'metodologias_ensino',
        'abordagens_pedagogicas',
        'gestao_educacional',
        'legislacao',
        'etica',
        'conhecimento_cientifico_tecnico',
        'nao_classificado'
      )
    ),
  drop constraint if exists document_interpretations_material_type_check,
  add constraint document_interpretations_material_type_check
    check (
      material_type in (
        'official_norm',
        'scientific_article',
        'book_or_chapter',
        'university_handout',
        'lecture_presentation',
        'student_summary',
        'personal_note',
        'unknown'
      )
    ),
  drop constraint if exists document_interpretations_evidence_kind_check,
  add constraint document_interpretations_evidence_kind_check
    check (
      evidence_kind in (
        'official_norm',
        'scientific_research',
        'published_book',
        'institutional_academic_material',
        'classroom_academic_material',
        'student_authored_summary',
        'personal_note',
        'unknown_support'
      )
    ),
  drop constraint if exists document_interpretations_evidence_confidence_check,
  add constraint document_interpretations_evidence_confidence_check
    check (evidence_confidence is null or evidence_confidence between 0 and 1),
  drop constraint if exists document_interpretations_provenance_object_check,
  add constraint document_interpretations_provenance_object_check
    check (jsonb_typeof(extraction_provenance) = 'object');

alter table public.document_interpretations
  drop constraint if exists document_interpretations_canonical_revision_matches,
  add constraint document_interpretations_canonical_revision_matches
    check (
      canonical_revision_id is null
      or canonical_revision_id = revision_id
    );

with ranked_interpretations as (
  select
    id,
    revision_id,
    row_number() over (
      partition by revision_id
      order by created_at, id
    ) as revision_rank
  from public.document_interpretations
)
update public.document_interpretations interpretation
set canonical_revision_id = ranked.revision_id
from ranked_interpretations ranked
where ranked.id = interpretation.id
  and ranked.revision_rank = 1
  and interpretation.canonical_revision_id is null;

drop index if exists public.document_interpretations_revision_unique;
create unique index if not exists document_interpretations_canonical_revision_unique
  on public.document_interpretations (canonical_revision_id);

alter table public.document_context_bindings
  add column if not exists source_profile text not null default 'unknown',
  add column if not exists folder_role text not null default 'unknown',
  add column if not exists month_key text,
  add column if not exists binding_key text;

update public.document_context_bindings binding
set
  source_profile = interpretation.source_profile,
  folder_role = interpretation.folder_role,
  month_key = coalesce(
    interpretation.month_key,
    case
      when binding.period ~ '^(20[0-9]{2}-)?(0[1-9]|1[0-2])$'
        then binding.period
      else null
    end
  ),
  binding_key = case
    when binding.status = 'confirmed' and binding.class_id is not null then
      encode(
        extensions.digest(
          binding.organization_id::text || '|' ||
          binding.interpretation_id::text || '|' ||
          binding.class_id,
          'sha256'
        ),
        'hex'
      )
    else binding.binding_key
  end
from public.document_interpretations interpretation
where interpretation.id = binding.interpretation_id;

alter table public.document_context_bindings
  drop constraint if exists document_context_bindings_source_profile_check,
  add constraint document_context_bindings_source_profile_check
    check (
      source_profile in (
        'academic',
        'institutional_actions',
        'monthly_plan',
        'report',
        'lesson_plan',
        'unknown'
      )
    ),
  drop constraint if exists document_context_bindings_folder_role_check,
  add constraint document_context_bindings_folder_role_check
    check (
      folder_role in (
        'academic',
        'institutional_actions',
        'monthly_plan',
        'report',
        'lesson_plan',
        'unknown'
      )
    ),
  drop constraint if exists document_context_bindings_month_key_check,
  add constraint document_context_bindings_month_key_check
    check (
      month_key is null
      or month_key ~ '^(20[0-9]{2}-)?(0[1-9]|1[0-2])$'
    ),
  drop constraint if exists document_context_bindings_binding_key_check,
  add constraint document_context_bindings_binding_key_check
    check (
      binding_key is null
      or binding_key ~ '^[a-f0-9]{64}$'
    ),
  drop constraint if exists document_context_bindings_confirmed_key_check,
  add constraint document_context_bindings_confirmed_key_check
    check (
      status <> 'confirmed'
      or class_id is null
      or binding_key is not null
    ),
  drop constraint if exists document_context_bindings_academic_no_class_check,
  add constraint document_context_bindings_academic_no_class_check
    check (source_profile <> 'academic' or class_id is null),
  drop constraint if exists document_context_bindings_binding_key_key,
  add constraint document_context_bindings_binding_key_key unique (binding_key);

alter table public.knowledge_sources
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists source_scope text not null default 'workspace_institutional',
  add column if not exists document_source_id uuid references public.document_sources(id) on delete set null,
  add column if not exists document_revision_id uuid references public.document_source_revisions(id) on delete set null,
  add column if not exists discipline text,
  add column if not exists academic_area text,
  add column if not exists material_type text not null default 'unknown',
  add column if not exists evidence_kind text not null default 'unknown_support',
  add column if not exists institution text,
  add column if not exists academic_period text,
  add column if not exists confidence numeric,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.knowledge_sources
  drop constraint if exists knowledge_sources_source_scope_check,
  add constraint knowledge_sources_source_scope_check
    check (
      source_scope in (
      'user_academic',
      'workspace_academic',
      'workspace_institutional',
        'class_planning',
        'class_history',
        'scientific_reference'
      )
    ),
  drop constraint if exists knowledge_sources_personal_scope_check,
  add constraint knowledge_sources_personal_scope_check
    check (
      source_scope <> 'user_academic'
      or (
        owner_user_id is not null
        and document_source_id is not null
        and document_revision_id is not null
      )
    ),
  drop constraint if exists knowledge_sources_academic_provenance_check,
  add constraint knowledge_sources_academic_provenance_check
    check (
      source_scope not in ('user_academic', 'workspace_academic')
      or (
        document_source_id is not null
        and document_revision_id is not null
      )
    ),
  drop constraint if exists knowledge_sources_discipline_check,
  add constraint knowledge_sources_discipline_check
    check (
      discipline is null
      or discipline in (
        'gestao_trabalho_pedagogico',
        'pratica_ensino_educacao_infantil',
        'curriculo_fundamentos_cultura',
        'educacao_basica_politica_legislacao',
        'libras',
        'tendencias_pedagogicas_didatica',
        'unknown'
      )
    ),
  drop constraint if exists knowledge_sources_academic_area_check,
  add constraint knowledge_sources_academic_area_check
    check (
      academic_area is null
      or academic_area in (
        'didatica',
        'curriculo',
        'politicas_educacionais',
        'planejamento_pedagogico',
        'avaliacao',
        'desenvolvimento_infantil',
        'inclusao',
        'acessibilidade',
        'libras',
        'metodologias_ensino',
        'abordagens_pedagogicas',
        'gestao_educacional',
        'legislacao',
        'etica',
        'conhecimento_cientifico_tecnico',
        'nao_classificado'
      )
    ),
  drop constraint if exists knowledge_sources_material_type_check,
  add constraint knowledge_sources_material_type_check
    check (
      material_type in (
        'official_norm',
        'scientific_article',
        'book_or_chapter',
        'university_handout',
        'lecture_presentation',
        'student_summary',
        'personal_note',
        'unknown'
      )
    ),
  drop constraint if exists knowledge_sources_evidence_kind_check,
  add constraint knowledge_sources_evidence_kind_check
    check (
      evidence_kind in (
        'official_norm',
        'scientific_research',
        'published_book',
        'institutional_academic_material',
        'classroom_academic_material',
        'student_authored_summary',
        'personal_note',
        'unknown_support'
      )
    ),
  drop constraint if exists knowledge_sources_confidence_check,
  add constraint knowledge_sources_confidence_check
    check (confidence is null or confidence between 0 and 1),
  drop constraint if exists knowledge_sources_metadata_object_check,
  add constraint knowledge_sources_metadata_object_check
    check (jsonb_typeof(metadata) = 'object');

create unique index if not exists knowledge_sources_personal_document_unique
  on public.knowledge_sources (organization_id, owner_user_id, document_source_id)
  where source_scope = 'user_academic';

create unique index if not exists knowledge_sources_personal_revision_unique
  on public.knowledge_sources (organization_id, owner_user_id, document_revision_id)
  where source_scope = 'user_academic';

alter table public.kb_documents
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists source_scope text not null default 'workspace_institutional',
  add column if not exists source_document_id uuid references public.document_sources(id) on delete set null,
  add column if not exists source_revision_id uuid references public.document_source_revisions(id) on delete set null,
  add column if not exists content_hash text,
  add column if not exists chunk_index integer,
  add column if not exists discipline text,
  add column if not exists academic_area text,
  add column if not exists material_type text not null default 'unknown',
  add column if not exists evidence_kind text not null default 'unknown_support',
  add column if not exists author text,
  add column if not exists institution text,
  add column if not exists academic_period text,
  add column if not exists topic text,
  add column if not exists audience text,
  add column if not exists source_excerpt text,
  add column if not exists source_location text,
  add column if not exists confidence numeric,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists available boolean not null default true,
  add column if not exists class_id text references public.classes(id) on delete restrict,
  add column if not exists embedding_vector extensions.vector(1536);

update public.kb_documents
set source_scope = case
  when source_id is not null or lower(level) = 'evidence' then 'scientific_reference'
  when class_id is not null then 'class_planning'
  else 'workspace_institutional'
end
where source_document_id is null
  and source_revision_id is null
  and owner_user_id is null;

alter table public.kb_documents
  drop constraint if exists kb_documents_source_scope_check,
  add constraint kb_documents_source_scope_check
    check (
      source_scope in (
        'user_academic',
        'workspace_academic',
        'workspace_institutional',
        'class_planning',
        'class_history',
        'scientific_reference'
      )
    ),
  drop constraint if exists kb_documents_personal_scope_check,
  add constraint kb_documents_personal_scope_check
    check (
      source_scope <> 'user_academic'
      or (
        owner_user_id is not null
        and source_document_id is not null
        and source_revision_id is not null
        and content_hash is not null
        and chunk_index is not null
        and class_id is null
      )
    ),
  drop constraint if exists kb_documents_academic_provenance_check,
  add constraint kb_documents_academic_provenance_check
    check (
      source_scope not in ('user_academic', 'workspace_academic')
      or (
        source_document_id is not null
        and source_revision_id is not null
        and content_hash is not null
        and chunk_index is not null
        and class_id is null
      )
    ),
  drop constraint if exists kb_documents_discipline_check,
  add constraint kb_documents_discipline_check
    check (
      discipline is null
      or discipline in (
        'gestao_trabalho_pedagogico',
        'pratica_ensino_educacao_infantil',
        'curriculo_fundamentos_cultura',
        'educacao_basica_politica_legislacao',
        'libras',
        'tendencias_pedagogicas_didatica',
        'unknown'
      )
    ),
  drop constraint if exists kb_documents_academic_area_check,
  add constraint kb_documents_academic_area_check
    check (
      academic_area is null
      or academic_area in (
        'didatica',
        'curriculo',
        'politicas_educacionais',
        'planejamento_pedagogico',
        'avaliacao',
        'desenvolvimento_infantil',
        'inclusao',
        'acessibilidade',
        'libras',
        'metodologias_ensino',
        'abordagens_pedagogicas',
        'gestao_educacional',
        'legislacao',
        'etica',
        'conhecimento_cientifico_tecnico',
        'nao_classificado'
      )
    ),
  drop constraint if exists kb_documents_material_type_check,
  add constraint kb_documents_material_type_check
    check (
      material_type in (
        'official_norm',
        'scientific_article',
        'book_or_chapter',
        'university_handout',
        'lecture_presentation',
        'student_summary',
        'personal_note',
        'unknown'
      )
    ),
  drop constraint if exists kb_documents_evidence_kind_check,
  add constraint kb_documents_evidence_kind_check
    check (
      evidence_kind in (
        'official_norm',
        'scientific_research',
        'published_book',
        'institutional_academic_material',
        'classroom_academic_material',
        'student_authored_summary',
        'personal_note',
        'unknown_support'
      )
    ),
  drop constraint if exists kb_documents_chunk_index_check,
  add constraint kb_documents_chunk_index_check
    check (chunk_index is null or chunk_index >= 0),
  drop constraint if exists kb_documents_content_hash_check,
  add constraint kb_documents_content_hash_check
    check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  drop constraint if exists kb_documents_confidence_check,
  add constraint kb_documents_confidence_check
    check (confidence is null or confidence between 0 and 1),
  drop constraint if exists kb_documents_metadata_object_check,
  add constraint kb_documents_metadata_object_check
    check (jsonb_typeof(metadata) = 'object');

create unique index if not exists kb_documents_revision_chunk_unique
  on public.kb_documents (organization_id, source_revision_id, chunk_index)
  where source_revision_id is not null;

create index if not exists document_sources_personal_owner_idx
  on public.document_sources (owner_user_id, organization_id, updated_at desc)
  where source_scope = 'user_academic';

create index if not exists document_sources_drive_folder_idx
  on public.document_sources (organization_id, folder_id, last_seen_at desc);

create index if not exists document_sources_profile_month_idx
  on public.document_sources (
    organization_id,
    source_profile,
    folder_role,
    month_key,
    class_id,
    last_seen_at desc
  );

create index if not exists document_interpretations_academic_idx
  on public.document_interpretations (organization_id, academic_area, evidence_kind, created_at desc)
  where document_type = 'academic_support';

create index if not exists knowledge_sources_personal_owner_idx
  on public.knowledge_sources (owner_user_id, organization_id, academic_area)
  where source_scope = 'user_academic';

create index if not exists kb_documents_personal_filters_idx
  on public.kb_documents (
    organization_id,
    owner_user_id,
    academic_area,
    evidence_kind,
    available
  )
  where source_scope = 'user_academic';

do $$
begin
  begin
    execute '
      create index if not exists kb_documents_academic_embedding_hnsw
      on public.kb_documents
      using hnsw (embedding_vector extensions.vector_cosine_ops)
      where source_scope = ''user_academic''
        and available
        and embedding_vector is not null
    ';
  exception
    when feature_not_supported or undefined_object then
      raise notice 'HNSW index unavailable; academic vector retrieval will use a sequential scan until supported.';
  end;
end;
$$;

create or replace function private.validate_document_organization_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  referenced_organization_id uuid;
  referenced_user_id uuid;
  referenced_connection_scope text;
  referenced_source_profile text;
  referenced_folder_role text;
  referenced_month_key text;
  referenced_bound_class_id text;
  referenced_class_confirmed_at timestamptz;
  referenced_source_id uuid;
  referenced_class_id text;
  referenced_proposal_id uuid;
begin
  case tg_table_name
    when 'google_drive_connections' then
      if new.bound_class_id is not null and not exists (
        select 1
        from public.classes class_row
        where class_row.id = new.bound_class_id
          and class_row.organization_id = new.organization_id
      ) then
        raise exception 'Drive connection class does not belong to organization';
      end if;
      if new.source_profile = 'academic' and new.bound_class_id is not null then
        raise exception 'academic Drive connection cannot bind directly to a class';
      end if;

    when 'document_sources' then
      select
        organization_id,
        user_id,
        connection_scope,
        source_profile,
        bound_class_id,
        class_binding_confirmed_at
        into
          referenced_organization_id,
          referenced_user_id,
          referenced_connection_scope,
          referenced_source_profile,
          referenced_bound_class_id,
          referenced_class_confirmed_at
      from public.google_drive_connections
      where id = new.connection_id;

      if referenced_organization_id is distinct from new.organization_id then
        raise exception 'document source connection does not belong to organization';
      end if;
      if referenced_source_profile is distinct from new.source_profile then
        raise exception 'document source profile does not match its Drive connection';
      end if;
      if new.class_id is not null
         and (
           referenced_bound_class_id is distinct from new.class_id
           or referenced_class_confirmed_at is null
         ) then
        raise exception 'document source class binding was not explicitly confirmed';
      end if;

      if new.source_scope = 'user_academic' then
        if new.class_id is not null then
          raise exception 'user academic source cannot bind directly to a class';
        end if;
        if new.owner_user_id is null or new.owner_user_id is distinct from referenced_user_id then
          raise exception 'user academic source owner must match the Drive connection owner';
        end if;
        if not exists (
          select 1
          from public.google_drive_connections connection
          where connection.id = new.connection_id
            and connection.connection_scope = 'user_academic'
        ) then
          raise exception 'user academic source requires a personal academic Drive connection';
        end if;
      end if;

      if new.source_scope = 'workspace_academic' then
        if new.class_id is not null then
          raise exception 'workspace academic source cannot bind directly to a class';
        end if;
        if referenced_connection_scope is distinct from 'workspace_academic' then
          raise exception 'workspace academic source requires a workspace academic Drive connection';
        end if;
      end if;

      if new.class_id is not null and not exists (
        select 1
        from public.classes class_row
        where class_row.id = new.class_id
          and class_row.organization_id = new.organization_id
      ) then
        raise exception 'document source class does not belong to organization';
      end if;

    when 'document_source_revisions' then
      select organization_id into referenced_organization_id
      from public.document_sources
      where id = new.source_id;
      if referenced_organization_id is distinct from new.organization_id then
        raise exception 'document revision source does not belong to organization';
      end if;

    when 'document_interpretations' then
      select
        revision.organization_id,
        source.source_profile,
        source.folder_role,
        source.month_key
        into
          referenced_organization_id,
          referenced_source_profile,
          referenced_folder_role,
          referenced_month_key
      from public.document_source_revisions revision
      join public.document_sources source on source.id = revision.source_id
      where revision.id = new.revision_id;
      if referenced_organization_id is distinct from new.organization_id then
        raise exception 'document interpretation revision does not belong to organization';
      end if;
      if referenced_source_profile is distinct from new.source_profile
         or referenced_folder_role is distinct from new.folder_role
         or referenced_month_key is distinct from new.month_key then
        raise exception 'document interpretation classification does not match its source';
      end if;

    when 'document_context_bindings' then
      select
        interpretation.organization_id,
        interpretation.source_profile,
        interpretation.folder_role,
        source.class_id
        into
          referenced_organization_id,
          referenced_source_profile,
          referenced_folder_role,
          referenced_class_id
      from public.document_interpretations interpretation
      join public.document_source_revisions revision
        on revision.id = interpretation.revision_id
      join public.document_sources source
        on source.id = revision.source_id
      where interpretation.id = new.interpretation_id;
      if referenced_organization_id is distinct from new.organization_id then
        raise exception 'document binding interpretation does not belong to organization';
      end if;
      if referenced_source_profile is distinct from new.source_profile
         or referenced_folder_role is distinct from new.folder_role then
        raise exception 'document binding profile does not match its interpretation';
      end if;
      if new.class_id is not null and not exists (
        select 1 from public.classes class_row
        where class_row.id = new.class_id
          and class_row.organization_id = new.organization_id
      ) then
        raise exception 'document binding class does not belong to organization';
      end if;
      if new.class_id is not null
         and (
           new.status is distinct from 'confirmed'
           or new.confirmed_by is null
           or referenced_class_id is distinct from new.class_id
         ) then
        raise exception 'document binding requires an explicitly confirmed source class';
      end if;

    when 'document_app_state_snapshots' then
      if not exists (
        select 1 from public.classes class_row
        where class_row.id = new.class_id
          and class_row.organization_id = new.organization_id
      ) then
        raise exception 'document snapshot class does not belong to organization';
      end if;

    when 'document_merge_proposals' then
      select binding.organization_id, binding.class_id
        into referenced_organization_id, referenced_class_id
      from public.document_context_bindings binding
      where binding.id = new.binding_id;
      if referenced_organization_id is distinct from new.organization_id
         or referenced_class_id is distinct from new.class_id then
        raise exception 'document proposal binding does not match organization and class';
      end if;
      if not exists (
        select 1
        from public.document_app_state_snapshots snapshot
        where snapshot.id = new.snapshot_id
          and snapshot.organization_id = new.organization_id
          and snapshot.class_id = new.class_id
      ) then
        raise exception 'document proposal snapshot does not match organization and class';
      end if;

    when 'document_merge_items' then
      select proposal.organization_id into referenced_organization_id
      from public.document_merge_proposals proposal
      where proposal.id = new.proposal_id;
      if referenced_organization_id is distinct from new.organization_id then
        raise exception 'document merge item proposal does not belong to organization';
      end if;

    when 'document_change_applications' then
      select proposal.organization_id into referenced_organization_id
      from public.document_merge_proposals proposal
      where proposal.id = new.proposal_id;
      if referenced_organization_id is distinct from new.organization_id then
        raise exception 'document application proposal does not belong to organization';
      end if;

    when 'document_change_application_items' then
      select application.organization_id, application.proposal_id
        into referenced_organization_id, referenced_proposal_id
      from public.document_change_applications application
      where application.id = new.application_id;
      if referenced_organization_id is distinct from new.organization_id then
        raise exception 'document application item does not belong to organization';
      end if;
      if not exists (
        select 1
        from public.document_merge_items item
        where item.id = new.merge_item_id
          and item.organization_id = new.organization_id
          and item.proposal_id = referenced_proposal_id
      ) then
        raise exception 'document application item does not belong to application proposal';
      end if;
  end case;

  return new;
end;
$$;

revoke all on function private.validate_document_organization_references()
  from public, anon, authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'google_drive_connections',
    'document_sources',
    'document_source_revisions',
    'document_interpretations',
    'document_context_bindings',
    'document_app_state_snapshots',
    'document_merge_proposals',
    'document_merge_items',
    'document_change_applications',
    'document_change_application_items'
  ] loop
    execute format(
      'drop trigger if exists %I on public.%I',
      table_name || '_validate_organization_references',
      table_name
    );
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function private.validate_document_organization_references()',
      table_name || '_validate_organization_references',
      table_name
    );
  end loop;
end;
$$;

create or replace function private.validate_academic_knowledge_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.document_sources%rowtype;
  revision_row public.document_source_revisions%rowtype;
  knowledge_source_row public.knowledge_sources%rowtype;
  version_organization_id uuid;
  knowledge_source_organization_id uuid;
begin
  if tg_table_name = 'knowledge_sources' then
    select organization_id into version_organization_id
    from public.knowledge_base_versions
    where id = new.knowledge_base_version_id;

    if version_organization_id is distinct from new.organization_id then
      raise exception 'knowledge source version does not belong to organization';
    end if;

    if new.document_source_id is not null then
      select * into source_row
      from public.document_sources
      where id = new.document_source_id;
      if source_row.organization_id is distinct from new.organization_id then
        raise exception 'knowledge source document does not belong to organization';
      end if;
      new.source_scope := source_row.source_scope;
      new.owner_user_id := source_row.owner_user_id;
    end if;

    if new.document_revision_id is not null then
      select * into revision_row
      from public.document_source_revisions
      where id = new.document_revision_id;
      if revision_row.organization_id is distinct from new.organization_id
         or revision_row.source_id is distinct from new.document_source_id then
        raise exception 'knowledge source revision does not match document and organization';
      end if;
    end if;

  elsif tg_table_name = 'kb_documents' then
    if new.knowledge_base_version_id is not null then
      select organization_id into version_organization_id
      from public.knowledge_base_versions
      where id = new.knowledge_base_version_id;
      if version_organization_id is distinct from new.organization_id then
        raise exception 'knowledge chunk version does not belong to organization';
      end if;
    end if;

    if new.knowledge_source_id is not null then
      select * into knowledge_source_row
      from public.knowledge_sources
      where id = new.knowledge_source_id;
      knowledge_source_organization_id := knowledge_source_row.organization_id;
      if knowledge_source_organization_id is distinct from new.organization_id then
        raise exception 'knowledge chunk source does not belong to organization';
      end if;
    end if;

    if new.source_revision_id is not null then
      select * into revision_row
      from public.document_source_revisions
      where id = new.source_revision_id;
      select * into source_row
      from public.document_sources
      where id = revision_row.source_id;

      if revision_row.organization_id is distinct from new.organization_id
         or source_row.organization_id is distinct from new.organization_id
         or source_row.id is distinct from new.source_document_id then
        raise exception 'knowledge chunk revision does not match document and organization';
      end if;

      new.source_scope := source_row.source_scope;
      new.owner_user_id := source_row.owner_user_id;
      new.content_hash := revision_row.content_hash;
      new.class_id := source_row.class_id;
    end if;

    if knowledge_source_row.id is not null
       and new.source_scope in ('user_academic', 'workspace_academic') then
      if knowledge_source_row.document_source_id is distinct from new.source_document_id
         or knowledge_source_row.document_revision_id is distinct from new.source_revision_id
         or knowledge_source_row.source_scope is distinct from new.source_scope
         or knowledge_source_row.owner_user_id is distinct from new.owner_user_id then
        raise exception 'academic knowledge chunk does not match its source provenance';
      end if;
    end if;

    if new.class_id is not null and not exists (
      select 1
      from public.classes class_row
      where class_row.id = new.class_id
        and class_row.organization_id = new.organization_id
    ) then
      raise exception 'knowledge chunk class does not belong to organization';
    end if;

    if new.source_scope in ('user_academic', 'workspace_academic') then
      if new.class_id is not null then
        raise exception 'academic chunk cannot bind directly to a class';
      end if;
      new.id :=
        case
          when new.source_scope = 'user_academic' then 'acad_user_'
          else 'acad_workspace_'
        end ||
        replace(new.source_revision_id::text, '-', '') ||
        '_' ||
        lpad(new.chunk_index::text, 6, '0');
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_academic_knowledge_references()
  from public, anon, authenticated, service_role;

drop trigger if exists knowledge_sources_validate_academic_references
  on public.knowledge_sources;
create trigger knowledge_sources_validate_academic_references
before insert or update on public.knowledge_sources
for each row execute function private.validate_academic_knowledge_references();

drop trigger if exists kb_documents_validate_academic_references
  on public.kb_documents;
create trigger kb_documents_validate_academic_references
before insert or update on public.kb_documents
for each row execute function private.validate_academic_knowledge_references();

drop policy if exists google_drive_connections_select
  on public.google_drive_connections;
create policy google_drive_connections_select
  on public.google_drive_connections
  for select
  to authenticated
  using (
    (
      connection_scope = 'user_academic'
      and user_id = (select auth.uid())
      and (select public.is_org_member(organization_id))
    )
    or (
      connection_scope <> 'user_academic'
      and public.can_manage_document_org(organization_id)
    )
  );

drop policy if exists document_sources_select on public.document_sources;
create policy document_sources_select
  on public.document_sources
  for select
  to authenticated
  using (
    (
      source_scope = 'user_academic'
      and owner_user_id = (select auth.uid())
      and (select public.is_org_member(organization_id))
    )
    or (
      source_scope <> 'user_academic'
      and public.can_manage_document_org(organization_id)
    )
  );

drop policy if exists document_sources_personal_insert on public.document_sources;
create policy document_sources_personal_insert
  on public.document_sources
  for insert
  to authenticated
  with check (
    source_scope = 'user_academic'
    and owner_user_id = (select auth.uid())
    and class_id is null
    and (select public.is_org_member(organization_id))
  );

drop policy if exists document_sources_insert on public.document_sources;
create policy document_sources_insert
  on public.document_sources
  for insert
  to authenticated
  with check (
    source_scope <> 'user_academic'
    and public.can_manage_document_org(organization_id)
  );

drop policy if exists document_source_revisions_select
  on public.document_source_revisions;
create policy document_source_revisions_select
  on public.document_source_revisions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.document_sources source
      where source.id = document_source_revisions.source_id
        and source.organization_id = document_source_revisions.organization_id
        and (
          (
            source.source_scope = 'user_academic'
            and source.owner_user_id = (select auth.uid())
            and (select public.is_org_member(source.organization_id))
          )
          or (
            source.source_scope <> 'user_academic'
            and public.can_manage_document_org(source.organization_id)
          )
        )
    )
  );

drop policy if exists document_source_revisions_personal_insert
  on public.document_source_revisions;
create policy document_source_revisions_personal_insert
  on public.document_source_revisions
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.document_sources source
      where source.id = document_source_revisions.source_id
        and source.organization_id = document_source_revisions.organization_id
        and source.source_scope = 'user_academic'
        and source.owner_user_id = (select auth.uid())
        and (select public.is_org_member(source.organization_id))
    )
  );

drop policy if exists document_source_revisions_insert
  on public.document_source_revisions;
create policy document_source_revisions_insert
  on public.document_source_revisions
  for insert
  to authenticated
  with check (
    public.can_manage_document_org(organization_id)
    and exists (
      select 1
      from public.document_sources source
      where source.id = document_source_revisions.source_id
        and source.organization_id = document_source_revisions.organization_id
        and source.source_scope <> 'user_academic'
    )
  );

drop policy if exists document_interpretations_select
  on public.document_interpretations;
create policy document_interpretations_select
  on public.document_interpretations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.document_source_revisions revision
      join public.document_sources source on source.id = revision.source_id
      where revision.id = document_interpretations.revision_id
        and revision.organization_id = document_interpretations.organization_id
        and (
          (
            source.source_scope = 'user_academic'
            and source.owner_user_id = (select auth.uid())
            and (select public.is_org_member(source.organization_id))
          )
          or (
            source.source_scope <> 'user_academic'
            and public.can_manage_document_org(source.organization_id)
          )
        )
    )
  );

drop policy if exists document_interpretations_insert
  on public.document_interpretations;
create policy document_interpretations_insert
  on public.document_interpretations
  for insert
  to authenticated
  with check (
    public.can_manage_document_org(organization_id)
    and exists (
      select 1
      from public.document_source_revisions revision
      join public.document_sources source on source.id = revision.source_id
      where revision.id = document_interpretations.revision_id
        and revision.organization_id = document_interpretations.organization_id
        and source.source_scope <> 'user_academic'
    )
  );

drop policy if exists knowledge_sources_select_member
  on public.knowledge_sources;
drop policy if exists "knowledge_sources select member"
  on public.knowledge_sources;
create policy "knowledge_sources select member"
  on public.knowledge_sources
  for select
  to authenticated
  using (
    (select public.is_org_member(organization_id))
    and (
      source_scope <> 'user_academic'
      or owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "knowledge_sources insert admin"
  on public.knowledge_sources;
create policy "knowledge_sources insert admin"
  on public.knowledge_sources
  for insert
  to authenticated
  with check (
    source_scope <> 'user_academic'
    and public.is_org_admin(organization_id)
  );

drop policy if exists "knowledge_sources update admin"
  on public.knowledge_sources;
create policy "knowledge_sources update admin"
  on public.knowledge_sources
  for update
  to authenticated
  using (
    source_scope <> 'user_academic'
    and public.is_org_admin(organization_id)
  )
  with check (
    source_scope <> 'user_academic'
    and public.is_org_admin(organization_id)
  );

drop policy if exists "knowledge_sources delete admin"
  on public.knowledge_sources;
create policy "knowledge_sources delete admin"
  on public.knowledge_sources
  for delete
  to authenticated
  using (
    source_scope <> 'user_academic'
    and public.is_org_admin(organization_id)
  );

drop policy if exists kb_documents_select_org_member
  on public.kb_documents;
drop policy if exists "kb_documents_select_org_member"
  on public.kb_documents;
create policy "kb_documents_select_org_member"
  on public.kb_documents
  for select
  to authenticated
  using (
    (select public.is_org_member(organization_id))
    and (
      source_scope <> 'user_academic'
      or owner_user_id = (select auth.uid())
    )
    and (
      class_id is null
      or public.is_org_admin(organization_id)
      or public.is_class_staff(class_id)
    )
  );

drop policy if exists "kb_documents_insert_org_admin"
  on public.kb_documents;
create policy "kb_documents_insert_org_admin"
  on public.kb_documents
  for insert
  to authenticated
  with check (
    source_scope <> 'user_academic'
    and public.is_org_admin(organization_id)
  );

drop policy if exists "kb_documents_update_org_admin"
  on public.kb_documents;
create policy "kb_documents_update_org_admin"
  on public.kb_documents
  for update
  to authenticated
  using (
    source_scope <> 'user_academic'
    and public.is_org_admin(organization_id)
  )
  with check (
    source_scope <> 'user_academic'
    and public.is_org_admin(organization_id)
  );

drop policy if exists "kb_documents_delete_org_admin"
  on public.kb_documents;
create policy "kb_documents_delete_org_admin"
  on public.kb_documents
  for delete
  to authenticated
  using (
    source_scope <> 'user_academic'
    and public.is_org_admin(organization_id)
  );

drop policy if exists assistant_memory_select_member
  on public.assistant_memory_entries;
create policy assistant_memory_select_member
  on public.assistant_memory_entries
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and (select public.is_org_member(organization_id))
  );

drop policy if exists assistant_memory_insert_member
  on public.assistant_memory_entries;
create policy assistant_memory_insert_member
  on public.assistant_memory_entries
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_org_member(organization_id))
  );

revoke insert, update, delete
  on table public.document_change_applications
  from authenticated;
revoke insert, update, delete
  on table public.document_change_application_items
  from authenticated;

drop policy if exists document_change_applications_insert
  on public.document_change_applications;
drop policy if exists document_change_applications_update
  on public.document_change_applications;
drop policy if exists document_change_application_items_insert
  on public.document_change_application_items;

alter function public.apply_approved_document_changes(uuid, uuid[], text, text)
  security definer;
alter function public.apply_approved_document_changes(uuid, uuid[], text, text)
  set search_path = public, pg_temp;
alter function public.undo_document_changes(uuid)
  security definer;
alter function public.undo_document_changes(uuid)
  set search_path = public, pg_temp;

revoke all on function public.apply_approved_document_changes(uuid, uuid[], text, text)
  from public, anon;
revoke all on function public.undo_document_changes(uuid)
  from public, anon;
grant execute on function public.apply_approved_document_changes(uuid, uuid[], text, text)
  to authenticated;
grant execute on function public.undo_document_changes(uuid)
  to authenticated;

create or replace function public.match_academic_knowledge(
  _organization_id uuid,
  _owner_user_id uuid,
  _query_embedding extensions.vector(1536),
  _query_text text default '',
  _academic_areas text[] default null,
  _evidence_kinds text[] default null,
  _match_count integer default 6
)
returns table (
  id text,
  knowledge_source_id text,
  source_scope text,
  content_hash text,
  chunk_index integer,
  title text,
  source_url text,
  chunk text,
  source_document_id uuid,
  source_revision_id uuid,
  discipline text,
  academic_area text,
  material_type text,
  evidence_kind text,
  author text,
  institution text,
  academic_period text,
  topic text,
  audience text,
  source_excerpt text,
  source_location text,
  confidence numeric,
  metadata jsonb,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with eligible as materialized (
    select
      document.*,
      case
        when _query_embedding is not null
          and document.embedding_vector is not null
          then greatest(
            0::double precision,
            1 - (document.embedding_vector <=> _query_embedding)
          )
        else null::double precision
      end as semantic_similarity,
      case
        when btrim(coalesce(_query_text, '')) <> ''
          then ts_rank_cd(
            setweight(
              to_tsvector('simple', coalesce(document.title, '')),
              'A'
            )
            ||
            setweight(
              to_tsvector('simple', coalesce(document.chunk, '')),
              'B'
            )
            ||
            setweight(
              to_tsvector(
                'simple',
                concat_ws(
                  ' ',
                  document.discipline,
                  document.academic_area,
                  document.material_type,
                  document.evidence_kind,
                  document.topic,
                  document.audience,
                  document.source_excerpt
                )
              ),
              'C'
            ),
            websearch_to_tsquery('simple', _query_text)
          )::double precision
        else 0::double precision
      end as lexical_similarity
    from public.kb_documents document
    where document.organization_id = _organization_id
      and document.owner_user_id = _owner_user_id
      and _owner_user_id = (select auth.uid())
      and (select public.is_org_member(_organization_id))
      and document.source_scope = 'user_academic'
      and document.available
      and document.class_id is null
      and (
        coalesce(cardinality(_academic_areas), 0) = 0
        or document.academic_area = any(_academic_areas)
      )
      and (
        coalesce(cardinality(_evidence_kinds), 0) = 0
        or document.evidence_kind = any(_evidence_kinds)
      )
      and (
        (
          _query_embedding is not null
          and document.embedding_vector is not null
        )
        or btrim(coalesce(_query_text, '')) <> ''
      )
  ),
  scored as (
    select
      eligible.*,
      case
        when eligible.semantic_similarity is not null
          and eligible.lexical_similarity > 0
          then least(
            1::double precision,
            (eligible.semantic_similarity * 0.85)
              + (least(1::double precision, eligible.lexical_similarity) * 0.15)
          )
        when eligible.semantic_similarity is not null
          then eligible.semantic_similarity
        else least(1::double precision, eligible.lexical_similarity)
      end as match_similarity
    from eligible
    where eligible.semantic_similarity is not null
       or eligible.lexical_similarity > 0
  )
  select
    scored.id,
    scored.knowledge_source_id,
    scored.source_scope,
    scored.content_hash,
    scored.chunk_index,
    scored.title,
    scored.source as source_url,
    scored.chunk,
    scored.source_document_id,
    scored.source_revision_id,
    scored.discipline,
    scored.academic_area,
    scored.material_type,
    scored.evidence_kind,
    scored.author,
    scored.institution,
    scored.academic_period,
    scored.topic,
    scored.audience,
    scored.source_excerpt,
    scored.source_location,
    scored.confidence,
    scored.metadata,
    scored.match_similarity as similarity
  from scored
  order by
    scored.match_similarity desc,
    scored.confidence desc nulls last,
    scored.id
  limit least(greatest(coalesce(_match_count, 6), 1), 20);
$$;

revoke all on function public.match_academic_knowledge(
  uuid,
  uuid,
  extensions.vector,
  text,
  text[],
  text[],
  integer
) from public, anon;
grant execute on function public.match_academic_knowledge(
  uuid,
  uuid,
  extensions.vector,
  text,
  text[],
  text[],
  integer
) to authenticated;
