-- Migration: 20260708151600_add_system_events.sql
-- Description: Creates observability foundation tables and RPCs

-- Tabela particionável de logs/eventos de sistema
CREATE TABLE public.system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_type TEXT NOT NULL CHECK (event_type IN ('request', 'error', 'security', 'ai', 'perf')),
    function_name TEXT NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    duration_ms INTEGER,
    status_code INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Indexing for observability lookups
CREATE INDEX idx_system_events_request_id ON public.system_events(request_id);
CREATE INDEX idx_system_events_timestamp ON public.system_events(timestamp DESC);
CREATE INDEX idx_system_events_event_type ON public.system_events(event_type);
CREATE INDEX idx_system_events_function ON public.system_events(function_name, timestamp DESC);

-- RLS: Security Definer functions will insert. Normal users cannot read or write to this table.
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

-- Expose an RPC for inserting events securely (to be called by Edge Functions via Anon/Service key)
-- Wait, Edge Functions using Service Key bypass RLS anyway. 
-- Using Anon Key would require a security definer function to avoid exposing the table.
-- Let's create an RPC to insert safely from Edge Functions using Anon context if needed.
CREATE OR REPLACE FUNCTION public.log_system_event(
    p_request_id UUID,
    p_event_type TEXT,
    p_function_name TEXT,
    p_organization_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_duration_ms INTEGER DEFAULT NULL,
    p_status_code INTEGER DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_id UUID;
BEGIN
    INSERT INTO public.system_events (
        request_id, event_type, function_name, organization_id, user_id, 
        duration_ms, status_code, metadata
    ) VALUES (
        p_request_id, p_event_type, p_function_name, p_organization_id, p_user_id, 
        p_duration_ms, p_status_code, p_metadata
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

-- Aggregate RPC for Dashboard (Future)
-- Returns JSON summary of system metrics (e.g., P95 latency, total requests, error counts)
CREATE OR REPLACE FUNCTION public.get_system_metrics(
    p_start_time TIMESTAMPTZ DEFAULT (now() - interval '24 hours'),
    p_end_time TIMESTAMPTZ DEFAULT now()
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Require staff/admin privileges? For now, we assume this is called securely or checked inside.
    -- To keep it simple for the initial implementation, we just aggregate.
    
    WITH req_stats AS (
        SELECT 
            COUNT(*) as total_requests,
            percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_latency,
            AVG(duration_ms) as avg_latency
        FROM public.system_events
        WHERE event_type = 'request' AND timestamp BETWEEN p_start_time AND p_end_time
    ),
    err_stats AS (
        SELECT COUNT(*) as total_errors
        FROM public.system_events
        WHERE event_type = 'error' AND timestamp BETWEEN p_start_time AND p_end_time
    ),
    ai_stats AS (
        SELECT 
            COUNT(*) as total_ai_calls,
            SUM((metadata->>'tokens_in')::numeric) as total_tokens_in,
            SUM((metadata->>'tokens_out')::numeric) as total_tokens_out,
            SUM((metadata->>'cost')::numeric) as total_cost
        FROM public.system_events
        WHERE event_type = 'ai' AND timestamp BETWEEN p_start_time AND p_end_time
    )
    SELECT jsonb_build_object(
        'requests', (SELECT row_to_json(req_stats) FROM req_stats),
        'errors', (SELECT row_to_json(err_stats) FROM err_stats),
        'ai', (SELECT row_to_json(ai_stats) FROM ai_stats)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Cron: Retention policy for logs older than 30 days
-- Assuming pg_cron is enabled
-- SELECT cron.schedule(
--     'system-events-cleanup',
--     '0 3 * * *', -- Everyday at 3 AM
--     $$ DELETE FROM public.system_events WHERE timestamp < now() - interval '30 days' $$
-- );
