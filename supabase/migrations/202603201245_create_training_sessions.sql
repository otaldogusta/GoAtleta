-- Multi-class training sessions
-- Adds a master session entity plus class links and session-level attendance.

CREATE TABLE IF NOT EXISTS public.training_sessions (
  id text PRIMARY KEY NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  type text NOT NULL DEFAULT 'training',
  source text NOT NULL DEFAULT 'manual',
  plan_id text REFERENCES public.training_plans(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_sessions_status_check CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  CONSTRAINT training_sessions_type_check CHECK (type IN ('training', 'integration', 'event', 'match')),
  CONSTRAINT training_sessions_source_check CHECK (source IN ('manual', 'plan', 'import'))
);

CREATE TABLE IF NOT EXISTS public.training_session_classes (
  id text PRIMARY KEY NOT NULL,
  session_id text NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  class_id text NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_session_classes_unique UNIQUE (session_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.training_session_attendance (
  id text PRIMARY KEY NOT NULL,
  session_id text NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id text NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present',
  note text NOT NULL DEFAULT '',
  pain_score integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_session_attendance_unique UNIQUE (session_id, student_id),
  CONSTRAINT training_session_attendance_status_check CHECK (status IN ('present', 'absent'))
);

CREATE INDEX IF NOT EXISTS training_sessions_org_start_at
  ON public.training_sessions (organization_id, start_at DESC);

CREATE INDEX IF NOT EXISTS training_sessions_org_plan
  ON public.training_sessions (organization_id, plan_id);

CREATE INDEX IF NOT EXISTS training_session_classes_session_idx
  ON public.training_session_classes (session_id);

CREATE INDEX IF NOT EXISTS training_session_classes_class_idx
  ON public.training_session_classes (class_id);

CREATE INDEX IF NOT EXISTS training_session_classes_org_class_idx
  ON public.training_session_classes (organization_id, class_id);

CREATE INDEX IF NOT EXISTS training_session_attendance_session_idx
  ON public.training_session_attendance (session_id);

CREATE INDEX IF NOT EXISTS training_session_attendance_class_idx
  ON public.training_session_attendance (class_id);

CREATE INDEX IF NOT EXISTS training_session_attendance_student_idx
  ON public.training_session_attendance (student_id);

CREATE INDEX IF NOT EXISTS training_session_attendance_org_class_idx
  ON public.training_session_attendance (organization_id, class_id);

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_sessions select trainer" ON public.training_sessions;
CREATE POLICY "training_sessions select trainer" ON public.training_sessions
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = training_sessions.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "training_sessions insert trainer" ON public.training_sessions;
CREATE POLICY "training_sessions insert trainer" ON public.training_sessions
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = training_sessions.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "training_sessions update trainer" ON public.training_sessions;
CREATE POLICY "training_sessions update trainer" ON public.training_sessions
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = training_sessions.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = training_sessions.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "training_sessions delete trainer" ON public.training_sessions;
CREATE POLICY "training_sessions delete trainer" ON public.training_sessions
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = training_sessions.organization_id
        AND om.user_id = auth.uid()
        AND om.role_level >= 50
    )
  );

ALTER TABLE public.training_session_classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_session_classes select trainer" ON public.training_session_classes;
CREATE POLICY "training_session_classes select trainer" ON public.training_session_classes
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_classes.organization_id
          AND om.user_id = auth.uid()
      )
      OR public.is_class_staff(training_session_classes.class_id)
    )
  );

DROP POLICY IF EXISTS "training_session_classes insert trainer" ON public.training_session_classes;
CREATE POLICY "training_session_classes insert trainer" ON public.training_session_classes
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_classes.organization_id
          AND om.user_id = auth.uid()
      )
      OR public.is_class_staff(training_session_classes.class_id)
    )
  );

DROP POLICY IF EXISTS "training_session_classes update trainer" ON public.training_session_classes;
CREATE POLICY "training_session_classes update trainer" ON public.training_session_classes
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_classes.organization_id
          AND om.user_id = auth.uid()
      )
      OR public.is_class_staff(training_session_classes.class_id)
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_classes.organization_id
          AND om.user_id = auth.uid()
      )
      OR public.is_class_staff(training_session_classes.class_id)
    )
  );

DROP POLICY IF EXISTS "training_session_classes delete trainer" ON public.training_session_classes;
CREATE POLICY "training_session_classes delete trainer" ON public.training_session_classes
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_classes.organization_id
          AND om.user_id = auth.uid()
        AND om.role_level >= 50
      )
      OR public.is_class_staff(training_session_classes.class_id)
    )
  );

ALTER TABLE public.training_session_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_session_attendance select trainer" ON public.training_session_attendance;
CREATE POLICY "training_session_attendance select trainer" ON public.training_session_attendance
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_attendance.organization_id
          AND om.user_id = auth.uid()
      )
      OR public.is_class_staff(training_session_attendance.class_id)
    )
  );

DROP POLICY IF EXISTS "training_session_attendance insert trainer" ON public.training_session_attendance;
CREATE POLICY "training_session_attendance insert trainer" ON public.training_session_attendance
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_attendance.organization_id
          AND om.user_id = auth.uid()
      )
      OR public.is_class_staff(training_session_attendance.class_id)
    )
  );

DROP POLICY IF EXISTS "training_session_attendance update trainer" ON public.training_session_attendance;
CREATE POLICY "training_session_attendance update trainer" ON public.training_session_attendance
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_attendance.organization_id
          AND om.user_id = auth.uid()
      )
      OR public.is_class_staff(training_session_attendance.class_id)
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_attendance.organization_id
          AND om.user_id = auth.uid()
      )
      OR public.is_class_staff(training_session_attendance.class_id)
    )
  );

DROP POLICY IF EXISTS "training_session_attendance delete trainer" ON public.training_session_attendance;
CREATE POLICY "training_session_attendance delete trainer" ON public.training_session_attendance
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_attendance.organization_id
          AND om.user_id = auth.uid()
        AND om.role_level >= 50
      )
      OR public.is_class_staff(training_session_attendance.class_id)
    )
  );

-- Backfill legacy class-attendance and session logs into the new session model.
WITH legacy_sources AS (
  SELECT
    COALESCE(al.organization_id, c.organization_id) AS organization_id,
    al.classid AS class_id,
    al.date::date AS session_date,
    al.createdat::timestamptz AS source_created_at
  FROM public.attendance_logs al
  LEFT JOIN public.classes c ON c.id = al.classid
  UNION ALL
  SELECT
    COALESCE(sl.organization_id, c.organization_id) AS organization_id,
    sl.classid AS class_id,
    sl.createdat::date AS session_date,
    sl.createdat::timestamptz AS source_created_at
  FROM public.session_logs sl
  LEFT JOIN public.classes c ON c.id = sl.classid
),
legacy_sessions AS (
  SELECT
    organization_id,
    class_id,
    session_date,
    MIN(source_created_at) AS created_at
  FROM legacy_sources
  WHERE organization_id IS NOT NULL
  GROUP BY organization_id, class_id, session_date
),
resolved_sessions AS (
  SELECT
    'ts_' || md5(
      COALESCE(legacy_sessions.organization_id::text, '') || '|' ||
      legacy_sessions.class_id || '|' ||
      legacy_sessions.session_date::text
    ) AS id,
    legacy_sessions.organization_id,
    legacy_sessions.class_id,
    legacy_sessions.session_date,
    legacy_sessions.created_at,
    COALESCE(tp.id, NULL) AS plan_id,
    COALESCE(tp.title, c.name, 'Treino') AS title,
    COALESCE(
      (legacy_sessions.session_date::timestamp + COALESCE(NULLIF(c.starttime, '')::time, time '12:00')),
      legacy_sessions.session_date::timestamp + time '12:00'
    ) AS start_at,
    COALESCE(
      (legacy_sessions.session_date::timestamp + COALESCE(NULLIF(c.starttime, '')::time, time '12:00')) +
      (COALESCE(c.duration, 60) * INTERVAL '1 minute'),
      legacy_sessions.session_date::timestamp + time '13:00'
    ) AS end_at
  FROM legacy_sessions
  LEFT JOIN public.classes c ON c.id = legacy_sessions.class_id
  LEFT JOIN LATERAL (
    SELECT tp.id, tp.title
    FROM public.training_plans tp
    WHERE tp.classid = legacy_sessions.class_id
      AND (
        tp.applydate = legacy_sessions.session_date
        OR (
          tp.applydays IS NOT NULL
          AND EXTRACT(ISODOW FROM legacy_sessions.session_date)::int = ANY(tp.applydays)
        )
      )
    ORDER BY (tp.applydate = legacy_sessions.session_date) DESC, tp.createdat DESC
    LIMIT 1
  ) tp ON TRUE
)
INSERT INTO public.training_sessions (
  id,
  organization_id,
  title,
  description,
  start_at,
  end_at,
  status,
  type,
  source,
  plan_id,
  created_at,
  updated_at
)
SELECT
  resolved_sessions.id,
  resolved_sessions.organization_id,
  resolved_sessions.title,
  '',
  resolved_sessions.start_at,
  resolved_sessions.end_at,
  'completed',
  'training',
  'import',
  resolved_sessions.plan_id,
  resolved_sessions.created_at,
  resolved_sessions.created_at
FROM resolved_sessions
ON CONFLICT (id) DO NOTHING;

WITH legacy_sources AS (
  SELECT
    COALESCE(al.organization_id, c.organization_id) AS organization_id,
    al.classid AS class_id,
    al.date::date AS session_date,
    al.createdat::timestamptz AS source_created_at
  FROM public.attendance_logs al
  LEFT JOIN public.classes c ON c.id = al.classid
  UNION ALL
  SELECT
    COALESCE(sl.organization_id, c.organization_id) AS organization_id,
    sl.classid AS class_id,
    sl.createdat::date AS session_date,
    sl.createdat::timestamptz AS source_created_at
  FROM public.session_logs sl
  LEFT JOIN public.classes c ON c.id = sl.classid
),
legacy_sessions AS (
  SELECT
    organization_id,
    class_id,
    session_date,
    MIN(source_created_at) AS created_at
  FROM legacy_sources
  WHERE organization_id IS NOT NULL
  GROUP BY organization_id, class_id, session_date
),
resolved_sessions AS (
  SELECT
    'ts_' || md5(
      COALESCE(legacy_sessions.organization_id::text, '') || '|' ||
      legacy_sessions.class_id || '|' ||
      legacy_sessions.session_date::text
    ) AS id,
    legacy_sessions.organization_id,
    legacy_sessions.class_id,
    legacy_sessions.session_date,
    legacy_sessions.created_at,
    COALESCE(tp.id, NULL) AS plan_id,
    COALESCE(tp.title, c.name, 'Treino') AS title,
    COALESCE(
      (legacy_sessions.session_date::timestamp + COALESCE(NULLIF(c.starttime, '')::time, time '12:00')),
      legacy_sessions.session_date::timestamp + time '12:00'
    ) AS start_at,
    COALESCE(
      (legacy_sessions.session_date::timestamp + COALESCE(NULLIF(c.starttime, '')::time, time '12:00')) +
      (COALESCE(c.duration, 60) * INTERVAL '1 minute'),
      legacy_sessions.session_date::timestamp + time '13:00'
    ) AS end_at
  FROM legacy_sessions
  LEFT JOIN public.classes c ON c.id = legacy_sessions.class_id
  LEFT JOIN LATERAL (
    SELECT tp.id, tp.title
    FROM public.training_plans tp
    WHERE tp.classid = legacy_sessions.class_id
      AND (
        tp.applydate = legacy_sessions.session_date
        OR (
          tp.applydays IS NOT NULL
          AND EXTRACT(ISODOW FROM legacy_sessions.session_date)::int = ANY(tp.applydays)
        )
      )
    ORDER BY (tp.applydate = legacy_sessions.session_date) DESC, tp.createdat DESC
    LIMIT 1
  ) tp ON TRUE
)
INSERT INTO public.training_session_classes (
  id,
  session_id,
  class_id,
  organization_id,
  created_at
)
SELECT
  'tsc_' || md5(resolved_sessions.id || '|' || resolved_sessions.class_id),
  resolved_sessions.id,
  resolved_sessions.class_id,
  resolved_sessions.organization_id,
  resolved_sessions.created_at
FROM resolved_sessions
ON CONFLICT (session_id, class_id) DO NOTHING;

INSERT INTO public.training_session_attendance (
  id,
  session_id,
  student_id,
  class_id,
  organization_id,
  status,
  note,
  pain_score,
  created_at,
  updated_at
)
SELECT
  'tsa_' || md5(
    COALESCE(al.organization_id, c.organization_id)::text || '|' ||
    al.classid || '|' ||
    al.studentid || '|' ||
    al.date::text
  ),
  ts.id,
  al.studentid,
  al.classid,
  COALESCE(al.organization_id, c.organization_id),
  CASE WHEN al.status = 'presente' THEN 'present' ELSE 'absent' END,
  COALESCE(al.note, ''),
  COALESCE(al.pain_score, 0),
  al.createdat::timestamptz,
  al.createdat::timestamptz
FROM public.attendance_logs al
LEFT JOIN public.classes c ON c.id = al.classid
JOIN public.students s ON s.id = al.studentid
JOIN public.training_sessions ts
  ON ts.organization_id = COALESCE(al.organization_id, c.organization_id)
 AND ts.start_at::date = al.date::date
 AND EXISTS (
   SELECT 1
   FROM public.training_session_classes tsc
   WHERE tsc.session_id = ts.id
     AND tsc.class_id = al.classid
 )
ON CONFLICT (session_id, student_id) DO NOTHING;
