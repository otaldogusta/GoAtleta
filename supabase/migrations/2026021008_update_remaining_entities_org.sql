-- PR8: Remaining entities org-aware
-- Add organization_id to absence_notices, scouting_logs, class_plans

-- Absence notices (via students)
ALTER TABLE public.absence_notices
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.absence_notices an
SET organization_id = s.organization_id
FROM public.students s
WHERE an.student_id = s.id
  AND an.organization_id IS NULL
  AND s.organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS absence_notices_org_id ON public.absence_notices(organization_id);
CREATE INDEX IF NOT EXISTS absence_notices_org_student ON public.absence_notices(organization_id, student_id);

ALTER TABLE public.absence_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "absence_notices select trainer" ON public.absence_notices;
CREATE POLICY "absence_notices select trainer" ON public.absence_notices
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = absence_notices.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "absence_notices insert trainer" ON public.absence_notices;
CREATE POLICY "absence_notices insert trainer" ON public.absence_notices
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = absence_notices.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "absence_notices update trainer" ON public.absence_notices;
CREATE POLICY "absence_notices update trainer" ON public.absence_notices
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = absence_notices.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "absence_notices delete trainer" ON public.absence_notices;
CREATE POLICY "absence_notices delete trainer" ON public.absence_notices
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = absence_notices.organization_id
        AND om.user_id = auth.uid()
        AND om.role_level >= 50
    )
  );

-- Scouting logs (via classes)
ALTER TABLE public.scouting_logs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.scouting_logs sl
SET organization_id = c.organization_id
FROM public.classes c
WHERE sl.classid = c.id
  AND sl.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS scouting_logs_org_id ON public.scouting_logs(organization_id);
CREATE INDEX IF NOT EXISTS scouting_logs_org_class ON public.scouting_logs(organization_id, classid);

ALTER TABLE public.scouting_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scouting_logs select trainer" ON public.scouting_logs;
CREATE POLICY "scouting_logs select trainer" ON public.scouting_logs
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = scouting_logs.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "scouting_logs insert trainer" ON public.scouting_logs;
CREATE POLICY "scouting_logs insert trainer" ON public.scouting_logs
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = scouting_logs.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "scouting_logs update trainer" ON public.scouting_logs;
CREATE POLICY "scouting_logs update trainer" ON public.scouting_logs
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = scouting_logs.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "scouting_logs delete trainer" ON public.scouting_logs;
CREATE POLICY "scouting_logs delete trainer" ON public.scouting_logs
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = scouting_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.role_level >= 50
    )
  );

-- Class plans (via classes)
ALTER TABLE public.class_plans
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

UPDATE public.class_plans cp
SET organization_id = c.organization_id
FROM public.classes c
WHERE cp.classid = c.id
  AND cp.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS class_plans_org_id ON public.class_plans(organization_id);
CREATE INDEX IF NOT EXISTS class_plans_org_class ON public.class_plans(organization_id, classid);

ALTER TABLE public.class_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_plans select trainer" ON public.class_plans;
CREATE POLICY "class_plans select trainer" ON public.class_plans
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = class_plans.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "class_plans insert trainer" ON public.class_plans;
CREATE POLICY "class_plans insert trainer" ON public.class_plans
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = class_plans.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "class_plans update trainer" ON public.class_plans;
CREATE POLICY "class_plans update trainer" ON public.class_plans
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = class_plans.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "class_plans delete trainer" ON public.class_plans;
CREATE POLICY "class_plans delete trainer" ON public.class_plans
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = class_plans.organization_id
        AND om.user_id = auth.uid()
        AND om.role_level >= 50
    )
  );
