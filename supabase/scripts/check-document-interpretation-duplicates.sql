-- Read-only preflight for 20260716120000_add_personal_academic_document_foundation.sql.
-- It intentionally returns rows for manual review and never modifies data.

select
  interpretation.revision_id,
  count(*) as interpretation_count,
  count(distinct interpretation.interpretation::text) as distinct_interpretation_count,
  count(distinct interpretation.warnings::text) as distinct_warning_count,
  count(distinct interpretation.document_type) as distinct_document_type_count,
  count(distinct binding.id) as context_binding_count,
  count(distinct concat_ws('|', coalesce(binding.unit_id, ''), coalesce(binding.modality_id, ''), coalesce(binding.class_id, ''), coalesce(binding.period, ''), binding.status)) as distinct_binding_shape_count,
  array_agg(interpretation.id order by interpretation.created_at, interpretation.id) as interpretation_ids,
  min(interpretation.created_at) as first_created_at,
  max(interpretation.created_at) as last_created_at
from public.document_interpretations interpretation
left join public.document_context_bindings binding
  on binding.interpretation_id = interpretation.id
group by interpretation.revision_id
having count(*) > 1
order by last_created_at desc;

with duplicate_revisions as (
  select revision_id
  from public.document_interpretations
  group by revision_id
  having count(*) > 1
),
duplicate_interpretations as (
  select interpretation.id
  from public.document_interpretations interpretation
  join duplicate_revisions duplicate
    on duplicate.revision_id = interpretation.revision_id
),
duplicate_bindings as (
  select binding.id
  from public.document_context_bindings binding
  join duplicate_interpretations interpretation
    on interpretation.id = binding.interpretation_id
)
select
  count(distinct proposal.id) as referencing_proposal_count,
  array_agg(distinct proposal.id) filter (where proposal.id is not null) as referencing_proposal_ids
from duplicate_bindings binding
left join public.document_merge_proposals proposal
  on proposal.binding_id = binding.id;
