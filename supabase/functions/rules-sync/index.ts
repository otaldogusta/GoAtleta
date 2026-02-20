import { runRulesSync } from "../_shared/regulation-sync-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-rules-sync-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

type RulesSyncRequest = {
  organizationId?: string | null;
  sourceId?: string | null;
  force?: boolean;
};

const isAuthorized = (request: Request) => {
  const expected = Deno.env.get("RULES_SYNC_SECRET") ?? "";
  if (!expected) return false;
  const received = request.headers.get("x-rules-sync-secret") ?? "";
  return Boolean(received) && received === expected;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  let payload: RulesSyncRequest = {};
  try {
    payload = (await request.json()) as RulesSyncRequest;
  } catch {
    payload = {};
  }

  try {
    const report = await runRulesSync({
      organizationId: payload.organizationId ?? null,
      sourceId: payload.sourceId ?? null,
      force: payload.force ?? false,
    });

    return new Response(JSON.stringify({ status: "ok", ...report }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Rules sync failed.",
      }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
