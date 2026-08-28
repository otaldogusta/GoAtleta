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

  let payload: { studentId: string; clearLoginEmail: boolean } = {
    studentId: "",
    clearLoginEmail: false,
  };
  try {
    const parsed = validateObjectPayload(await req.json());
    if (!parsed.ok || !parsed.data) {
      return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
    }
    payload = parsed.data as {
      studentId: string;
      clearLoginEmail: boolean;
    };
  } catch {
    return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
  }

  const studentIdValidation = validateStringField(payload.studentId, {
    minLength: 1,
    maxLength: 128,
  });
  if (!studentIdValidation.ok) {
    return createError(req, 400, "INVALID_REQUEST", "Invalid studentId");
  }
  const studentId = studentIdValidation.data;

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
  const { error: revokeError } = await supabase.rpc("revoke_student_access", {
    p_student_id: studentId,
    p_clear_login_email: payload.clearLoginEmail === true,
  });

  if (revokeError) {
    const message = revokeError.message ?? "";
    if (message.includes("STUDENT_NOT_FOUND")) {
      return createError(req, 404, "STUDENT_NOT_FOUND", "Student not found");
    }
    if (message.includes("NOT_AUTHORIZED")) {
      return createError(req, 403, "FORBIDDEN", "Not authorized");
    }
    console.error("revoke-student-access: atomic revoke failed");
    return createError(req, 500, "SERVER_ERROR", "Failed to revoke student access");
  }

  return new Response(JSON.stringify({ status: "ok" }), { headers: makeJsonHeaders(req) });
});
