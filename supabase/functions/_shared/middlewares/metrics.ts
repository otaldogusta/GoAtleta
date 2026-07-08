import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface MetricsTracker {
  trackAiUsage: (provider: string, model: string, tokensIn: number, tokensOut: number, latencyMs: number, costEstimate?: number) => void;
  trackPerf: (action: string, latencyMs: number, customMetadata?: Record<string, any>) => void;
  flush: () => Promise<void>;
}

interface MetricEvent {
  event_type: "ai" | "perf";
  metadata: Record<string, any>;
  duration_ms: number;
}

export function createMetricsTracker(supabase: SupabaseClient, requestId: string, functionName: string, userId?: string, orgId?: string): MetricsTracker {
  const events: MetricEvent[] = [];

  return {
    trackAiUsage: (provider, model, tokensIn, tokensOut, latencyMs, costEstimate = 0) => {
      events.push({
        event_type: "ai",
        duration_ms: latencyMs,
        metadata: {
          provider,
          model,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          cost: costEstimate
        }
      });
    },
    trackPerf: (action, latencyMs, customMetadata = {}) => {
      events.push({
        event_type: "perf",
        duration_ms: latencyMs,
        metadata: {
          action,
          ...customMetadata
        }
      });
    },
    flush: async () => {
      if (events.length === 0) return;
      
      // Batch insert into system_events via RPC
      for (const ev of events) {
        await supabase.rpc('log_system_event', {
          p_request_id: requestId,
          p_event_type: ev.event_type,
          p_function_name: functionName,
          p_organization_id: orgId || null,
          p_user_id: userId || null,
          p_duration_ms: ev.duration_ms,
          p_status_code: null,
          p_metadata: ev.metadata
        });
      }
    }
  };
}
