-- Add training plan versioning columns and create override_events table
-- This enables: plan versions, pedagogical overrides, and learning from teacher behavior

-- =====================================================================
-- STEP 1: Add versioning columns to training_plans
-- =====================================================================

ALTER TABLE public.training_plans
  ADD COLUMN IF NOT EXISTS version integer,
  ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('generated', 'final')),
  ADD COLUMN IF NOT EXISTS origin text CHECK (origin IN ('auto', 'manual', 'manual_apply', 'edited_auto', 'imported')),
  ADD COLUMN IF NOT EXISTS inputhash text,
  ADD COLUMN IF NOT EXISTS generatedat timestamp with time zone,
  ADD COLUMN IF NOT EXISTS finalizedat timestamp with time zone,
  ADD COLUMN IF NOT EXISTS parent_plan_id text REFERENCES public.training_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_version_id text REFERENCES public.training_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pedagogy jsonb DEFAULT NULL;

-- Create indices for version queries
CREATE INDEX IF NOT EXISTS training_plans_version_desc
  ON public.training_plans(version DESC NULLS LAST, createdat DESC);

CREATE INDEX IF NOT EXISTS training_plans_status
  ON public.training_plans(classid, status) WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS training_plans_origin
  ON public.training_plans(origin) WHERE origin IS NOT NULL;

CREATE INDEX IF NOT EXISTS training_plans_parent
  ON public.training_plans(parent_plan_id) WHERE parent_plan_id IS NOT NULL;

-- =====================================================================
-- STEP 2: Create override_events table (for learning from teacher behavior)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.override_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  class_id text NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  from_rule_id text NOT NULL,
  to_rule_id text NOT NULL,
  reason_text text,
  reason_tags text[],
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),

  CONSTRAINT override_events_valid_rules CHECK (from_rule_id != to_rule_id)
);

-- If table already exists from a partial/previous run, force class_id to text.
ALTER TABLE public.override_events
  DROP CONSTRAINT IF EXISTS override_events_class_id_fkey;

ALTER TABLE public.override_events
  ALTER COLUMN class_id TYPE text USING class_id::text;

ALTER TABLE public.override_events
  ADD CONSTRAINT override_events_class_id_fkey
  FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;

-- Indices for aggregation queries
CREATE INDEX IF NOT EXISTS override_events_class
  ON public.override_events(class_id);

CREATE INDEX IF NOT EXISTS override_events_rules
  ON public.override_events(from_rule_id, to_rule_id);

CREATE INDEX IF NOT EXISTS override_events_class_rules
  ON public.override_events(class_id, from_rule_id, to_rule_id);

CREATE INDEX IF NOT EXISTS override_events_created
  ON public.override_events(class_id, created_at DESC);

-- =====================================================================
-- STEP 3: RLS Policies for override_events
-- =====================================================================

ALTER TABLE public.override_events ENABLE ROW LEVEL SECURITY;

-- SELECT: Students can see overrides for their classes, trainers can see all in their org
DROP POLICY IF EXISTS "override_events select" ON public.override_events;
CREATE POLICY "override_events select" ON public.override_events
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = override_events.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- INSERT: Only trainers can record overrides
DROP POLICY IF EXISTS "override_events insert" ON public.override_events;
CREATE POLICY "override_events insert" ON public.override_events
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = override_events.organization_id
        AND om.user_id = auth.uid()
        AND om.role_level >= 40  -- trainer or higher
    )
  );

-- =====================================================================
-- STEP 4: Grant permissions
-- =====================================================================

REVOKE ALL ON TABLE public.override_events FROM anon;
GRANT SELECT, INSERT ON TABLE public.override_events TO authenticated;
