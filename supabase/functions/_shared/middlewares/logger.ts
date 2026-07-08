import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function logRequestEnd(
  supabase: SupabaseClient,
  requestId: string,
  functionName: string,
  statusCode: number,
  durationMs: number,
  userId?: string,
  orgId?: string,
  error?: any,
  securityIssue?: string
) {
  // If there's an error, log as 'error'
  // If there's a security issue (e.g. auth failed), log as 'security'
  // Otherwise 'request'
  
  let eventType = "request";
  let metadata: Record<string, any> = {};

  if (securityIssue) {
    eventType = "security";
    metadata.reason = securityIssue;
  } else if (error || statusCode >= 400) {
    eventType = "error";
    metadata.message = error?.message || "HTTP Error";
    if (error?.stack) metadata.stack = error.stack;
  }

  try {
    await supabase.rpc('log_system_event', {
      p_request_id: requestId,
      p_event_type: eventType,
      p_function_name: functionName,
      p_organization_id: orgId || null,
      p_user_id: userId || null,
      p_duration_ms: durationMs,
      p_status_code: statusCode,
      p_metadata: metadata
    });
  } catch (err) {
    // Failsafe: if the logger itself fails, write to stdout for raw Deno logs
    console.error(`[LOGGER FAILED] ${requestId} -`, err);
  }
}
