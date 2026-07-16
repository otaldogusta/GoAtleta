-- Read-only post-migration verification.

with duplicated_revisions as (
  select revision_id
  from public.document_interpretations
  group by revision_id
  having count(*) > 1
),
interpretation_summary as (
  select
    interpretation.revision_id,
    count(*) as interpretation_count,
    count(*) filter (
      where interpretation.canonical_revision_id = interpretation.revision_id
    ) as canonical_count,
    count(distinct binding.id) as binding_count,
    count(distinct proposal.id) as proposal_count
  from public.document_interpretations interpretation
  join duplicated_revisions duplicate
    on duplicate.revision_id = interpretation.revision_id
  left join public.document_context_bindings binding
    on binding.interpretation_id = interpretation.id
  left join public.document_merge_proposals proposal
    on proposal.binding_id = binding.id
  group by interpretation.revision_id
)
select *
from interpretation_summary
order by revision_id;

select count(*) as invalid_canonical_reference_count
from public.document_interpretations
where canonical_revision_id is not null
  and canonical_revision_id <> revision_id;
