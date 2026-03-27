-- Stores a structured review snapshot for weekly autopilot proposals.

ALTER TABLE public.weekly_autopilot_proposals
  ADD COLUMN IF NOT EXISTS plan_review jsonb NOT NULL DEFAULT '{}'::jsonb;
