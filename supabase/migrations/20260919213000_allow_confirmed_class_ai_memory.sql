-- Allow a professor to persist an explicitly confirmed rule only for a class
-- they are assigned to. The proposal UUID makes retries idempotent.

DROP POLICY IF EXISTS ai_facts_insert_authorized ON public.ai_facts;

CREATE POLICY ai_facts_insert_authorized ON public.ai_facts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_admin(organization_id)
    OR (
      public.is_org_member(organization_id)
      AND subject_type = 'coach'
      AND subject_id = (SELECT auth.uid())::text
    )
    OR (
      public.is_org_member(organization_id)
      AND subject_type = 'class'
      AND fact_type = 'class_pattern'
      AND public.is_class_staff(subject_id)
      AND EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = subject_id
          AND c.organization_id = ai_facts.organization_id
      )
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS ai_facts_source_event_unique
  ON public.ai_facts (source_event_id)
  WHERE source_event_id IS NOT NULL;

COMMENT ON POLICY ai_facts_insert_authorized ON public.ai_facts IS
  'Admins, coaches writing their own facts, or assigned class staff confirming class patterns may insert AI memory.';
