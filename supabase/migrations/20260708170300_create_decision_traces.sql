-- Migration: 20260708170300_create_decision_traces.sql
-- Description: Creates ai_decision_traces table and RLS policies

CREATE TABLE public.ai_decision_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL, -- Kept loose without hard FK constraint for telemetry decoupling
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    class_id TEXT,
    decision TEXT NOT NULL,
    reason TEXT NOT NULL,
    confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    based_on TEXT[] NOT NULL,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for lookup speed and audit tracing
CREATE INDEX idx_decision_traces_request ON public.ai_decision_traces (request_id);
CREATE INDEX idx_decision_traces_org_class ON public.ai_decision_traces (organization_id, class_id);
CREATE INDEX idx_decision_traces_created ON public.ai_decision_traces (created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_decision_traces ENABLE ROW LEVEL SECURITY;

-- Member-only select policies
CREATE POLICY decision_traces_select_member ON public.ai_decision_traces
    FOR SELECT USING (public.is_org_member(organization_id));

CREATE POLICY decision_traces_insert_member ON public.ai_decision_traces
    FOR INSERT WITH CHECK (public.is_org_member(organization_id));
