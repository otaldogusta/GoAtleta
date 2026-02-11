-- PR9: Enforce organization_id NOT NULL across org-aware tables

-- Ensure classes have organization_id from owner membership
UPDATE public.classes c
SET organization_id = (
  SELECT om.organization_id
  FROM public.organization_members om
  WHERE om.user_id = c.owner_id
  ORDER BY om.created_at ASC
  LIMIT 1
)
WHERE c.organization_id IS NULL
  AND c.owner_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = c.owner_id
  );

-- Students via classes
UPDATE public.students s
SET organization_id = c.organization_id
FROM public.classes c
WHERE s.classid = c.id
  AND s.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

-- Students fallback via owner membership
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

-- Attendance logs via students
UPDATE public.attendance_logs a
SET organization_id = s.organization_id
FROM public.students s
WHERE a.studentid = s.id
  AND a.organization_id IS NULL
  AND s.organization_id IS NOT NULL;

-- Attendance logs fallback via classes
UPDATE public.attendance_logs a
SET organization_id = c.organization_id
FROM public.classes c
WHERE a.classid = c.id
  AND a.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

-- Session logs via classes
UPDATE public.session_logs sl
SET organization_id = c.organization_id
FROM public.classes c
WHERE sl.classid = c.id
  AND sl.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

-- Training plans via classes
UPDATE public.training_plans tp
SET organization_id = c.organization_id
FROM public.classes c
WHERE tp.classid = c.id
  AND tp.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

-- Absence notices via students
UPDATE public.absence_notices an
SET organization_id = s.organization_id
FROM public.students s
WHERE an.student_id = s.id
  AND an.organization_id IS NULL
  AND s.organization_id IS NOT NULL;

-- Absence notices fallback via classes
UPDATE public.absence_notices an
SET organization_id = c.organization_id
FROM public.classes c
WHERE an.class_id = c.id
  AND an.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

-- Scouting logs via classes
UPDATE public.scouting_logs sl
SET organization_id = c.organization_id
FROM public.classes c
WHERE sl.classid = c.id
  AND sl.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

-- Class plans via classes
UPDATE public.class_plans cp
SET organization_id = c.organization_id
FROM public.classes c
WHERE cp.classid = c.id
  AND cp.organization_id IS NULL
  AND c.organization_id IS NOT NULL;

-- Enforce NOT NULL across org-aware tables
ALTER TABLE public.classes
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.students
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.attendance_logs
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.session_logs
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.training_plans
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.absence_notices
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.scouting_logs
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.class_plans
  ALTER COLUMN organization_id SET NOT NULL;
