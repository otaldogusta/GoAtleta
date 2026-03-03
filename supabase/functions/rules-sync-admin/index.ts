import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { runRulesSync } from "../_shared/regulation-sync-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
};

const RATE_LIMIT_STORE =
  (globalThis as unknown as {
    __rulesSyncAdminRateLimitStore?: Map<string, { count: number; resetAt: number }>;
  }).__rulesSyncAdminRateLimitStore ??
  new Map<string, { count: number; resetAt: number }>();

(globalThis as unknown as { __rulesSyncAdminRateLimitStore?: typeof RATE_LIMIT_STORE }).__rulesSyncAdminRateLimitStore =
  RATE_LIMIT_STORE;

const checkRateLimit = (
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult => {
  const now = Date.now();
  const previous = RATE_LIMIT_STORE.get(key);
  if (!previous || now >= previous.resetAt) {
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }
  if (previous.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((previous.resetAt - now) / 1000)),
    };
  }
  previous.count += 1;
  RATE_LIMIT_STORE.set(key, previous);
  return {
    allowed: true,
    retryAfterSec: Math.max(1, Math.ceil((previous.resetAt - now) / 1000)),
  };
};

type RulesSyncAdminRequest = {
  organizationId?: string;
  sourceId?: string;
  force?: boolean;
};

const createAnonClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
};

const createServiceClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
};

const requireUser = async (request: Request) => {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  const supabase = createAnonClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
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

  const user = await requireUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  let payload: RulesSyncAdminRequest = {};
  try {
    payload = (await request.json()) as RulesSyncAdminRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const sourceId = String(payload.sourceId ?? "").trim();
  if (!sourceId) {
    return new Response(JSON.stringify({ error: "sourceId is required" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase service role config" }),
      {
        status: 500,
        headers: jsonHeaders,
      }
    );
  }

  const { data: source, error: sourceError } = await supabase
    .from("regulation_sources")
    .select("id, organization_id, enabled")
    .eq("id", sourceId)
    .maybeSingle();

  if (sourceError) {
    return new Response(JSON.stringify({ error: sourceError.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
  if (!source) {
    return new Response(JSON.stringify({ error: "Source not found" }), {
      status: 404,
      headers: jsonHeaders,
    });
  }

  const expectedOrganizationId = String(payload.organizationId ?? "").trim();
  if (expectedOrganizationId && expectedOrganizationId !== String(source.organization_id)) {
    return new Response(JSON.stringify({ error: "Source does not belong to organizationId" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const { data: memberRow, error: memberError } = await supabase
    .from("organization_members")
    .select("role_level")
    .eq("organization_id", source.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError) {
    return new Response(JSON.stringify({ error: memberError.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  if (!memberRow || Number(memberRow.role_level ?? 0) < 50) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: jsonHeaders,
    });
  }

  const maxRequestsPerMinute = Math.max(
    1,
    Number.parseInt(
      String(Deno.env.get("RULES_SYNC_ADMIN_RATE_LIMIT_PER_MIN") ?? "10"),
      10
    ) || 10
  );
  const limiter = checkRateLimit(
    `rules-sync-admin:${source.organization_id}:${user.id}`,
    maxRequestsPerMinute,
    60_000
  );
  if (!limiter.allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        retryAfterSec: limiter.retryAfterSec,
        maxRequestsPerMinute,
      }),
      {
        status: 429,
        headers: jsonHeaders,
      }
    );
  }

  try {
    const report = await runRulesSync({
      organizationId: String(source.organization_id),
      sourceId: String(source.id),
      force: payload.force ?? true,
    });
    return new Response(JSON.stringify({ status: "ok", ...report }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Rules sync failed",
      }),
      {
        status: 500,
        headers: jsonHeaders,
      }
    );
  }
});
