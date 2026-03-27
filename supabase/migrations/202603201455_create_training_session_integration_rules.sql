-- Formalizes integrated training sessions so the backend has a persisted
-- source of truth for multi-class execution.

CREATE TABLE IF NOT EXISTS public.training_session_integration_rules (
  id text PRIMARY KEY NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_session_id text NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  class_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_session_integration_rules_source_session_unique UNIQUE (source_session_id)
);

CREATE TABLE IF NOT EXISTS public.training_session_integration_rule_classes (
  id text PRIMARY KEY NOT NULL,
  rule_id text NOT NULL REFERENCES public.training_session_integration_rules(id) ON DELETE CASCADE,
  class_id text NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_session_integration_rule_classes_unique UNIQUE (rule_id, class_id)
);

CREATE INDEX IF NOT EXISTS training_session_integration_rules_org_start_at
  ON public.training_session_integration_rules (organization_id, start_at DESC);

CREATE INDEX IF NOT EXISTS training_session_integration_rules_org_session
  ON public.training_session_integration_rules (organization_id, source_session_id);

CREATE INDEX IF NOT EXISTS training_session_integration_rule_classes_rule_idx
  ON public.training_session_integration_rule_classes (rule_id);

CREATE INDEX IF NOT EXISTS training_session_integration_rule_classes_class_idx
  ON public.training_session_integration_rule_classes (class_id);

CREATE INDEX IF NOT EXISTS training_session_integration_rule_classes_org_class_idx
  ON public.training_session_integration_rule_classes (organization_id, class_id);

CREATE OR REPLACE FUNCTION public.get_training_integration_rules(_organization_id uuid)
RETURNS TABLE (
  id text,
  organization_id uuid,
  source_session_id text,
  start_at timestamptz,
  end_at timestamptz,
  class_count integer,
  class_ids text[],
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    r.id,
    r.organization_id,
    r.source_session_id,
    r.start_at,
    r.end_at,
    r.class_count,
    COALESCE(
      array_agg(rc.class_id ORDER BY rc.created_at) FILTER (WHERE rc.class_id IS NOT NULL),
      ARRAY[]::text[]
    ) AS class_ids,
    r.created_at,
    r.updated_at
  FROM public.training_session_integration_rules r
  LEFT JOIN public.training_session_integration_rule_classes rc
    ON rc.rule_id = r.id
  WHERE r.organization_id = _organization_id
  GROUP BY
    r.id,
    r.organization_id,
    r.source_session_id,
    r.start_at,
    r.end_at,
    r.class_count,
    r.created_at,
    r.updated_at
  ORDER BY r.start_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_training_integration_rules(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_training_integration_rules(uuid) TO authenticated;

ALTER TABLE public.training_session_integration_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_session_integration_rules select trainer" ON public.training_session_integration_rules;
CREATE POLICY "training_session_integration_rules select trainer" ON public.training_session_integration_rules
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_integration_rules.organization_id
          AND om.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.training_session_integration_rule_classes tric
        WHERE tric.rule_id = training_session_integration_rules.id
          AND public.is_class_staff(tric.class_id)
      )
    )
  );

DROP POLICY IF EXISTS "training_session_integration_rules insert trainer" ON public.training_session_integration_rules;
CREATE POLICY "training_session_integration_rules insert trainer" ON public.training_session_integration_rules
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = training_session_integration_rules.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "training_session_integration_rules update trainer" ON public.training_session_integration_rules;
CREATE POLICY "training_session_integration_rules update trainer" ON public.training_session_integration_rules
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = training_session_integration_rules.organization_id
        AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = training_session_integration_rules.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "training_session_integration_rules delete trainer" ON public.training_session_integration_rules;
CREATE POLICY "training_session_integration_rules delete trainer" ON public.training_session_integration_rules
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_integration_rules.organization_id
          AND om.user_id = auth.uid()
          AND om.role_level >= 50
      )
      OR EXISTS (
        SELECT 1
        FROM public.training_session_integration_rule_classes tric
        WHERE tric.rule_id = training_session_integration_rules.id
          AND public.is_class_staff(tric.class_id)
      )
    )
  );

ALTER TABLE public.training_session_integration_rule_classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "training_session_integration_rule_classes select trainer" ON public.training_session_integration_rule_classes;
CREATE POLICY "training_session_integration_rule_classes select trainer" ON public.training_session_integration_rule_classes
  FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_integration_rule_classes.organization_id
          AND om.user_id = auth.uid()
      )
      OR public.is_class_staff(training_session_integration_rule_classes.class_id)
    )
  );

DROP POLICY IF EXISTS "training_session_integration_rule_classes insert trainer" ON public.training_session_integration_rule_classes;
CREATE POLICY "training_session_integration_rule_classes insert trainer" ON public.training_session_integration_rule_classes
  FOR INSERT
  WITH CHECK (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_integration_rule_classes.organization_id
          AND om.user_id = auth.uid()
      )
      OR public.is_class_staff(training_session_integration_rule_classes.class_id)
    )
  );

DROP POLICY IF EXISTS "training_session_integration_rule_classes update trainer" ON public.training_session_integration_rule_classes;
CREATE POLICY "training_session_integration_rule_classes update trainer" ON public.training_session_integration_rule_classes
  FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_integration_rule_classes.organization_id
          AND om.user_id = auth.uid()
      )
      OR public.is_class_staff(training_session_integration_rule_classes.class_id)
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_integration_rule_classes.organization_id
          AND om.user_id = auth.uid()
      )
      OR public.is_class_staff(training_session_integration_rule_classes.class_id)
    )
  );

DROP POLICY IF EXISTS "training_session_integration_rule_classes delete trainer" ON public.training_session_integration_rule_classes;
CREATE POLICY "training_session_integration_rule_classes delete trainer" ON public.training_session_integration_rule_classes
  FOR DELETE
  USING (
    organization_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.organization_members om
        WHERE om.organization_id = training_session_integration_rule_classes.organization_id
          AND om.user_id = auth.uid()
          AND om.role_level >= 50
      )
      OR public.is_class_staff(training_session_integration_rule_classes.class_id)
    )
  );

WITH integrated_sessions AS (
  SELECT
    ts.id AS source_session_id,
    ts.organization_id,
    ts.start_at,
    ts.end_at,
    MIN(ts.created_at) AS created_at,
    MAX(ts.updated_at) AS updated_at,
    COUNT(tsc.class_id) AS class_count
  FROM public.training_sessions ts
  JOIN public.training_session_classes tsc ON tsc.session_id = ts.id
  GROUP BY ts.id, ts.organization_id, ts.start_at, ts.end_at
  HAVING COUNT(tsc.class_id) > 1
),
resolved_rules AS (
  SELECT
    'tir_' || md5(source_session_id) AS id,
    source_session_id,
    organization_id,
    start_at,
    end_at,
    class_count,
    created_at,
    updated_at
  FROM integrated_sessions
)
INSERT INTO public.training_session_integration_rules (
  id,
  organization_id,
  source_session_id,
  start_at,
  end_at,
  class_count,
  created_at,
  updated_at
)
SELECT
  resolved_rules.id,
  resolved_rules.organization_id,
  resolved_rules.source_session_id,
  resolved_rules.start_at,
  resolved_rules.end_at,
  resolved_rules.class_count,
  resolved_rules.created_at,
  resolved_rules.updated_at
FROM resolved_rules
ON CONFLICT (source_session_id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  start_at = EXCLUDED.start_at,
  end_at = EXCLUDED.end_at,
  class_count = EXCLUDED.class_count,
  updated_at = EXCLUDED.updated_at;

WITH integrated_sessions AS (
  SELECT
    ts.id AS source_session_id,
    ts.organization_id,
    ts.start_at,
    ts.end_at,
    MIN(ts.created_at) AS created_at,
    MAX(ts.updated_at) AS updated_at,
    COUNT(tsc.class_id) AS class_count
  FROM public.training_sessions ts
  JOIN public.training_session_classes tsc ON tsc.session_id = ts.id
  GROUP BY ts.id, ts.organization_id, ts.start_at, ts.end_at
  HAVING COUNT(tsc.class_id) > 1
),
resolved_rules AS (
  SELECT
    'tir_' || md5(source_session_id) AS id,
    source_session_id,
    organization_id,
    start_at,
    end_at,
    class_count,
    created_at,
    updated_at
  FROM integrated_sessions
)
INSERT INTO public.training_session_integration_rule_classes (
  id,
  rule_id,
  class_id,
  organization_id,
  created_at
)
SELECT
  'trc_' || md5(resolved_rules.id || '|' || tsc.class_id),
  resolved_rules.id,
  tsc.class_id,
  resolved_rules.organization_id,
  COALESCE(resolved_rules.created_at, resolved_rules.updated_at)
FROM resolved_rules
JOIN public.training_session_classes tsc ON tsc.session_id = resolved_rules.source_session_id
ON CONFLICT (rule_id, class_id) DO NOTHING;
