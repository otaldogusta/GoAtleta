-- Adds versioned knowledge context snapshots to weekly autopilot proposals.

ALTER TABLE public.weekly_autopilot_proposals
  ADD COLUMN IF NOT EXISTS knowledge_base_version_id text REFERENCES public.knowledge_base_versions(id) ON DELETE SET NULL;

ALTER TABLE public.weekly_autopilot_proposals
  ADD COLUMN IF NOT EXISTS knowledge_base_version_label text NOT NULL DEFAULT '';

ALTER TABLE public.weekly_autopilot_proposals
  ADD COLUMN IF NOT EXISTS knowledge_domain text NOT NULL DEFAULT 'general';

ALTER TABLE public.weekly_autopilot_proposals
  ADD COLUMN IF NOT EXISTS knowledge_references jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.weekly_autopilot_proposals
  ADD COLUMN IF NOT EXISTS knowledge_rule_highlights jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS weekly_autopilot_org_knowledge_version
  ON public.weekly_autopilot_proposals (organization_id, knowledge_base_version_id);
