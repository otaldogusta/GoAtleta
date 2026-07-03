-- PR6: Session logs org-aware
-- Add organization_id to session_logs for workspace filtering

-- Add organization_id column (nullable initially for backfill)
ALTER TABLE public.session_logs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill via classes
UPDATE public.session_logs sl
SET organization_id = c.organization_id
FROM public.classes c
WHERE sl.classid = c.id
  AND sl.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

-- Create indices for performance
CREATE INDEX IF NOT EXISTS session_logs_org_id ON public.session_logs(organization_id);
CREATE INDEX IF NOT EXISTS session_logs_org_class ON public.session_logs(organization_id, classid);
CREATE INDEX IF NOT EXISTS session_logs_org_date ON public.session_logs(organization_id, createdat);

-- RLS Policies (organization-based)
ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: Trainer/Admin members of the organization
DROP POLICY IF EXISTS "session_logs select trainer" ON public.session_logs;
CREATE POLICY "session_logs select trainer" ON public.session_logs
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = session_logs.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- INSERT: Only org members can insert
DROP POLICY IF EXISTS "session_logs insert trainer" ON public.session_logs;
CREATE POLICY "session_logs insert trainer" ON public.session_logs
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = session_logs.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- UPDATE: Only org members can update
DROP POLICY IF EXISTS "session_logs update trainer" ON public.session_logs;
CREATE POLICY "session_logs update trainer" ON public.session_logs
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = session_logs.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = session_logs.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- DELETE: Only org admins (role_level >= 50) can delete
DROP POLICY IF EXISTS "session_logs delete trainer" ON public.session_logs;
CREATE POLICY "session_logs delete trainer" ON public.session_logs
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = session_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.role_level >= 50
    )
  );
