import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validateObjectPayload,
  validateStringField,
} from "../_shared/input-validation.ts";
import { authenticateRequest } from "../_shared/middlewares/auth.ts";


const makeJsonHeaders = (req: Request) => ({ ...buildCorsHeaders(req), "Content-Type": "application/json" });

const createError = (req: Request, status: number, code: string, error: string) =>
  new Response(JSON.stringify({ code, error }), { status, headers: makeJsonHeaders(req) });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflight(req);
  }
  if (req.method !== "POST") {
    return createError(req, 405, "INVALID_REQUEST", "Method not allowed");
  }

  const auth = await authenticateRequest(req);
  if (!auth) {
    return createError(req, 401, "UNAUTHORIZED", "Unauthorized");
  }

  let payload: { inviteId: string } = { inviteId: "" };
  try {
    const parsed = validateObjectPayload(await req.json());
    if (!parsed.ok || !parsed.data) {
      return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
    }
    payload = parsed.data as { inviteId: string };
  } catch {
    return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
  }

  const inviteValidation = validateStringField(payload.inviteId, {
    minLength: 36,
    maxLength: 36,
  });
  if (!inviteValidation.ok) {
    return createError(req, 400, "INVALID_REQUEST", `Invalid inviteId: ${inviteValidation.error}`);
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
        Authorization: `Bearer ${auth.token}`,
      },
    },
  });
  const { error: updateError } = await supabase.rpc(
    "revoke_student_invite_access",
    { p_invite_id: inviteValidation.data }
  );

  if (updateError) {
    const message = updateError.message ?? "";
    if (message.includes("INVITE_INVALID")) {
      return createError(req, 404, "INVITE_INVALID", "Invite not found");
    }
    if (message.includes("NOT_AUTHORIZED")) {
      return createError(req, 403, "FORBIDDEN", "Forbidden");
    }
    return createError(req, 500, "SERVER_ERROR", "Failed to revoke invite");
  }

  return new Response(JSON.stringify({ status: "ok" }), { headers: makeJsonHeaders(req) });
});
