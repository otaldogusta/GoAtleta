import { createClient, SupabaseClient, User } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "./cors.ts";
import { getBearerToken, validateAuth } from "./middlewares/auth.ts";
import { logRequestEnd } from "./middlewares/logger.ts";
import { createMetricsTracker, MetricsTracker } from "./middlewares/metrics.ts";

const jsonHeaders = {
  "Content-Type": "application/json",
};

const withCors = (req: Request, response: Response): Response => {
  const headers = new Headers(response.headers);
  const corsHeaders = buildCorsHeaders(req);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export interface EdgeContext<TBody = any> {
  req: Request;
  requestId: string;
  supabase: SupabaseClient;
  user: User | null;
  token: string | null;
  body: TBody | null;
  metrics: MetricsTracker;
}

export interface EdgeFunctionConfig<TBody = any> {
  name: string; // Required for Observability
  requireAuth?: boolean;
  parseJson?: boolean;
  handler: (ctx: EdgeContext<TBody>) => Promise<Response>;
}

export const createError = (status: number, code: string, error: string) => {
  return new Response(JSON.stringify({ code, error }), { status, headers: jsonHeaders });
};

export const createSuccess = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
};

export function createEdgeFunction<TBody = any>(config: EdgeFunctionConfig<TBody>) {
  return async (req: Request): Promise<Response> => {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    let responseStatusCode = 500;
    let authUser: User | null = null;
    let securityIssue: string | undefined = undefined;
    let metricsTracker: MetricsTracker | null = null;
    
    // Telemetry is server-only. Never allow the public anon key to forge system events.
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const telemetryClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    
    try {
      // 1. CORS Preflight
      if (req.method === "OPTIONS") {
        return new Response("ok", { headers: buildCorsHeaders(req) });
      }

      if (!supabaseUrl || !anonKey || !serviceRoleKey) {
        throw new Error("Missing Supabase configuration");
      }

      // 2. Token extraction & Supabase initialization
      const token = getBearerToken(req);
      const supabaseOptions = {
        auth: { persistSession: false },
        ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {})
      };
      const supabase = createClient(supabaseUrl, anonKey, supabaseOptions);

      // 3. Auth Middleware
      const authResult = await validateAuth(supabase, token, !!config.requireAuth);
      if (authResult.error) {
        responseStatusCode = authResult.status;
        securityIssue = authResult.error;
        return withCors(req, createError(authResult.status, "UNAUTHORIZED", authResult.error));
      }
      authUser = authResult.user;

      // 4. Initialization of Metrics Middleware
      metricsTracker = createMetricsTracker(telemetryClient, requestId, config.name, authUser?.id);

      // 5. Input Parsing Middleware
      let body: TBody | null = null;
      if (config.parseJson && req.method !== "GET" && req.method !== "HEAD") {
        try {
          body = await req.json();
        } catch (e) {
          responseStatusCode = 400;
          return withCors(req, createError(400, "BAD_REQUEST", "Invalid JSON payload"));
        }
      }

      // 6. Execute Business Logic (Handler)
      const ctx: EdgeContext<TBody> = { req, requestId, supabase, user: authUser, token, body, metrics: metricsTracker };
      const response = await config.handler(ctx);
      
      responseStatusCode = response.status;
      return withCors(req, response);

    } catch (error: any) {
      // Log full error server-side for observability, never expose internals to client.
      console.error(`[${requestId}] EdgeFunction Error:`, error?.message ?? error);
      responseStatusCode = 500;
      const isDev = Deno.env.get("SUPABASE_ENV") === "local" || Deno.env.get("EDGE_FUNCTION_ENV") === "development";
      const safeMessage = isDev ? (error?.message ?? "An unexpected error occurred") : "An unexpected error occurred";
      return withCors(req, createError(500, "INTERNAL_ERROR", safeMessage));
    } finally {
      // 7. Flush Metrics
      if (metricsTracker) {
        await metricsTracker.flush().catch(console.error);
      }
      
      // 8. Log Request Lifecycle (Logger Middleware)
      const durationMs = Date.now() - startTime;
      await logRequestEnd(
        telemetryClient,
        requestId,
        config.name,
        responseStatusCode,
        durationMs,
        authUser?.id,
        undefined, // orgId extraction could be added if available in standard body
        responseStatusCode >= 400 ? new Error("Request failed") : undefined,
        securityIssue
      );
    }
  };
}
