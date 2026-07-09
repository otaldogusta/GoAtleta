import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const makeJsonHeaders = (req: Request) => ({ ...buildCorsHeaders(req), "Content-Type": "application/json" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflight(req);
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: makeJsonHeaders(req) });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  
  if (!token || token !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: makeJsonHeaders(req) });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: policies, error: polError } = await supabase
    .from("data_retention_policies")
    .select("*");

  if (polError) {
    return new Response(JSON.stringify({ error: "Failed to fetch policies" }), { status: 500, headers: makeJsonHeaders(req) });
  }

  let deletedCount = 0;

  for (const policy of policies) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);
    const cutoffIso = cutoffDate.toISOString();

    if (policy.action === "delete") {
      // In a real environment, this should be paginated and batched, but for this edge function
      // we'll run a bulk delete query based on created_at or accessed_at if applicable.
      // E.g., for assistant_memory_entries:
      if (policy.table_name === 'assistant_memory_entries') {
        const { count } = await supabase
          .from('assistant_memory_entries')
          .delete({ count: 'exact' })
          .lt('created_at', cutoffIso);
        if (count) deletedCount += count;
      }
      
      if (policy.table_name === 'health_data_access_logs' || policy.table_name === 'sensitive_data_access_logs') {
        const { count } = await supabase
          .from(policy.table_name)
          .delete({ count: 'exact' })
          .lt('accessed_at', cutoffIso); // Note accessed_at
        if (count) deletedCount += count;
      }
    }
  }

  return new Response(JSON.stringify({ status: "ok", deletedCount }), { headers: makeJsonHeaders(req) });
});
