-- PR7: Training plans org-aware
-- Add organization_id to training_plans for workspace filtering

-- Add organization_id column (nullable initially for backfill)
ALTER TABLE public.training_plans
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill via classes
UPDATE public.training_plans tp
SET organization_id = c.organization_id
FROM public.classes c
WHERE tp.classid = c.id
  AND tp.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

-- Create indices for performance
CREATE INDEX IF NOT EXISTS training_plans_org_id ON public.training_plans(organization_id);
CREATE INDEX IF NOT EXISTS training_plans_org_class ON public.training_plans(organization_id, classid);
CREATE INDEX IF NOT EXISTS training_plans_org_date ON public.training_plans(organization_id, createdat);

-- RLS Policies (organization-based)
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

-- SELECT: Trainer/Admin members of the organization
DROP POLICY IF EXISTS "training_plans select trainer" ON public.training_plans;
CREATE POLICY "training_plans select trainer" ON public.training_plans
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = training_plans.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- INSERT: Only org members can insert
DROP POLICY IF EXISTS "training_plans insert trainer" ON public.training_plans;
CREATE POLICY "training_plans insert trainer" ON public.training_plans
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = training_plans.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- UPDATE: Only org members can update
DROP POLICY IF EXISTS "training_plans update trainer" ON public.training_plans;
CREATE POLICY "training_plans update trainer" ON public.training_plans
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = training_plans.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = training_plans.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- DELETE: Only org admins (role_level >= 50) can delete
DROP POLICY IF EXISTS "training_plans delete trainer" ON public.training_plans;
CREATE POLICY "training_plans delete trainer" ON public.training_plans
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = training_plans.organization_id
        AND om.user_id = auth.uid()
        AND om.role_level >= 50
    )
  );
