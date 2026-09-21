-- Restrict persistent assistant facts to their authenticated subject or an
-- organization administrator. Organization membership alone must never allow
-- one member to place trusted memory into another coach's assistant context.

DROP POLICY IF EXISTS ai_facts_insert_member ON public.ai_facts;

CREATE POLICY ai_facts_insert_authorized ON public.ai_facts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_admin(organization_id)
    OR (
      public.is_org_member(organization_id)
      AND subject_type = 'coach'
      AND subject_id = (SELECT auth.uid())::text
    )
  );

COMMENT ON POLICY ai_facts_insert_authorized ON public.ai_facts IS
  'Only organization admins or the authenticated coach writing their own coach fact may insert AI memory.';
