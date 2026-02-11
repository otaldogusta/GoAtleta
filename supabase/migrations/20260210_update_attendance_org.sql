-- PR5: Attendance logs org-aware
-- Add organization_id to attendance_logs for workspace filtering

-- Add organization_id column (nullable initially for backfill)
ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill via students (primary source)
UPDATE public.attendance_logs a
SET organization_id = s.organization_id
FROM public.students s
WHERE a.studentid = s.id
  AND a.organization_id IS NULL
  AND s.organization_id IS NOT NULL;

-- Fallback via classes
UPDATE public.attendance_logs a
SET organization_id = c.organization_id
FROM public.classes c
WHERE a.classid = c.id
  AND a.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

-- Create indices for performance
CREATE INDEX IF NOT EXISTS attendance_logs_org_id ON public.attendance_logs(organization_id);
CREATE INDEX IF NOT EXISTS attendance_logs_org_class ON public.attendance_logs(organization_id, classid);
CREATE INDEX IF NOT EXISTS attendance_logs_org_date ON public.attendance_logs(organization_id, date);
CREATE INDEX IF NOT EXISTS attendance_logs_org_student ON public.attendance_logs(organization_id, studentid);

-- RLS Policies (organization-based)
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: Trainer/Admin members of the organization
DROP POLICY IF EXISTS "attendance_logs select trainer" ON public.attendance_logs;
CREATE POLICY "attendance_logs select trainer" ON public.attendance_logs
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = attendance_logs.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- SELECT: Student sees only their own attendance
DROP POLICY IF EXISTS "attendance_logs select student" ON public.attendance_logs;
CREATE POLICY "attendance_logs select student" ON public.attendance_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.students s
      WHERE s.id = attendance_logs.studentid
        AND s.student_user_id = auth.uid()
    )
  );

-- INSERT: Only org members can insert
DROP POLICY IF EXISTS "attendance_logs insert trainer" ON public.attendance_logs;
CREATE POLICY "attendance_logs insert trainer" ON public.attendance_logs
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = attendance_logs.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- UPDATE: Only org members can update
DROP POLICY IF EXISTS "attendance_logs update trainer" ON public.attendance_logs;
CREATE POLICY "attendance_logs update trainer" ON public.attendance_logs
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = attendance_logs.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = attendance_logs.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- DELETE: Only org admins (role_level >= 50) can delete
DROP POLICY IF EXISTS "attendance_logs delete trainer" ON public.attendance_logs;
CREATE POLICY "attendance_logs delete trainer" ON public.attendance_logs
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = attendance_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.role_level >= 50
    )
  );
