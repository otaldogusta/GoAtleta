-- Migration: 20260708162100_create_ai_facts.sql
-- Description: Creates ai_facts table for structured cognitive memory and RLS

CREATE TABLE public.ai_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subject_type TEXT NOT NULL CHECK (subject_type IN ('student', 'class', 'coach', 'organization')),
    subject_id TEXT NOT NULL,
    fact_type TEXT NOT NULL CHECK (fact_type IN ('motor_skill', 'class_pattern', 'coach_preference', 'general')),
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    source_event_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ
);

-- Optimize queries by querying facts mapped to orgs and subject targets
CREATE INDEX idx_ai_facts_org_subject ON public.ai_facts (organization_id, subject_type, subject_id);
CREATE INDEX idx_ai_facts_expires ON public.ai_facts (expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.ai_facts ENABLE ROW LEVEL SECURITY;

-- Select/Insert policies aligned with organization membership
CREATE POLICY ai_facts_select_member ON public.ai_facts
    FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY ai_facts_insert_member ON public.ai_facts
    FOR INSERT WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY ai_facts_update_admin ON public.ai_facts
    FOR UPDATE USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY ai_facts_delete_admin ON public.ai_facts
    FOR DELETE USING (public.is_org_admin(organization_id));
