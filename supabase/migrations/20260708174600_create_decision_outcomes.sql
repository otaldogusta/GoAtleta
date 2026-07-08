-- Migration: 20260708174600_create_decision_outcomes.sql
-- Description: Creates ai_decision_outcomes table for coach feedback and result mapping

CREATE TABLE public.ai_decision_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision_trace_id UUID NOT NULL REFERENCES public.ai_decision_traces(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    coach_action TEXT NOT NULL CHECK (coach_action IN ('accepted', 'modified', 'ignored')),
    feedback TEXT,
    result TEXT CHECK (result IN ('positive', 'neutral', 'negative')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for loop aggregation queries
CREATE INDEX idx_decision_outcomes_trace ON public.ai_decision_outcomes(decision_trace_id);
CREATE INDEX idx_decision_outcomes_org ON public.ai_decision_outcomes(organization_id);
CREATE INDEX idx_decision_outcomes_created ON public.ai_decision_outcomes(created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_decision_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY decision_outcomes_select_member ON public.ai_decision_outcomes
    FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY decision_outcomes_insert_member ON public.ai_decision_outcomes
    FOR INSERT WITH CHECK (public.is_org_member(organization_id));
