-- PR4: Students org-aware
-- Add organization_id to students for workspace filtering

-- Add organization_id column (nullable initially for backfill)
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill via classes (primary source of truth)
UPDATE public.students s
SET organization_id = c.organization_id
FROM public.classes c
WHERE s.classid = c.id
  AND s.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

-- Fallback for legacy students via owner_id membership
UPDATE public.students s
SET organization_id = (
  SELECT om.organization_id
  FROM public.organization_members om
  WHERE om.user_id = s.owner_id
  ORDER BY om.created_at ASC
  LIMIT 1
)
WHERE s.organization_id IS NULL
  AND s.owner_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = s.owner_id
  );

-- Create indices for performance
CREATE INDEX IF NOT EXISTS students_org_id ON public.students(organization_id);
CREATE INDEX IF NOT EXISTS students_org_class ON public.students(organization_id, classid);
CREATE INDEX IF NOT EXISTS students_org_birth ON public.students(organization_id, birthdate);

-- RLS Policies (organization-based)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- SELECT: Trainer/Admin members of the organization
DROP POLICY IF EXISTS "students select trainer" ON public.students;
CREATE POLICY "students select trainer" ON public.students
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = students.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- SELECT: Student sees only their own record
DROP POLICY IF EXISTS "students select self" ON public.students;
CREATE POLICY "students select self" ON public.students
  FOR SELECT
  USING (student_user_id = auth.uid());

-- INSERT: Only org members can insert
DROP POLICY IF EXISTS "students insert trainer" ON public.students;
CREATE POLICY "students insert trainer" ON public.students
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = students.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- UPDATE: Only org members can update
DROP POLICY IF EXISTS "students update trainer" ON public.students;
CREATE POLICY "students update trainer" ON public.students
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = students.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = students.organization_id
        AND om.user_id = auth.uid()
    )
  );

-- DELETE: Only org admins (role_level >= 50) can delete
DROP POLICY IF EXISTS "students delete trainer" ON public.students;
CREATE POLICY "students delete trainer" ON public.students
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = students.organization_id
        AND om.user_id = auth.uid()
        AND om.role_level >= 50
    )
  );
