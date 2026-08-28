import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validateObjectPayload,
  validateStringField,
} from "../_shared/input-validation.ts";


const makeJsonHeaders = (req: Request) => ({ ...buildCorsHeaders(req), "Content-Type": "application/json" });

const createError = (req: Request, status: number, code: string, error: string) =>
  new Response(JSON.stringify({ code, error }), { status, headers: makeJsonHeaders(req) });

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflight(req);
  }
  if (req.method !== "POST") {
    return createError(req, 405, "INVALID_REQUEST", "Method not allowed");
  }

  const token = getBearerToken(req);
  if (!token) {
    return createError(req, 401, "UNAUTHORIZED", "Unauthorized");
  }

  let payload: { organizationId: string } = { organizationId: "" };
  try {
    const parsed = validateObjectPayload(await req.json());
    if (!parsed.ok || !parsed.data) {
      return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
    }
    payload = parsed.data as { organizationId: string };
  } catch {
    return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
  }

  const orgValidation = validateStringField(payload.organizationId, {
    minLength: 36,
    maxLength: 36,
  });
  if (!orgValidation.ok) {
    return createError(req, 400, "INVALID_REQUEST", `Invalid organizationId: ${orgValidation.error}`);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    return createError(req, 500, "SERVER_ERROR", "Missing Supabase configuration");
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const userId = authData?.user?.id ?? "";
  if (authError || !userId) {
    return createError(req, 401, "UNAUTHORIZED", "Unauthorized");
  }

  const { data, error } = await supabase.rpc(
    "list_trainer_invites_access",
    { p_org_id: orgValidation.data }
  );

  if (error) {
    if (error.message?.includes("NOT_AUTHORIZED")) {
      return createError(req, 403, "ORG_FORBIDDEN", "Forbidden");
    }
    return createError(req, 500, "SERVER_ERROR", "Failed to list invites");
  }

  return new Response(JSON.stringify({ invites: data ?? [] }), { headers: makeJsonHeaders(req) });
});
