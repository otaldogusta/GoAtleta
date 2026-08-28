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

const ALLOWED_CHANNELS = new Set(["whatsapp", "email", "link"]);

const toHex = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
};

const normalizeChannel = (value: string) => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "whatsapp";
  return ALLOWED_CHANNELS.has(normalized) ? normalized : null;
};

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

  let payload: { studentId: string; invitedVia: string; invitedTo: string } = {
    studentId: "",
    invitedVia: "",
    invitedTo: "",
  };
  try {
    const parsed = validateObjectPayload(await req.json());
    if (!parsed.ok || !parsed.data) {
      return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
    }
    payload = parsed.data as {
      studentId: string;
      invitedVia: string;
      invitedTo: string;
    };
  } catch {
    return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
  }

  const studentIdValidation = validateStringField(payload.studentId, {
    minLength: 1,
    maxLength: 128,
  });
  if (!studentIdValidation.ok) {
    return createError(req, 400, "INVALID_REQUEST", `Invalid studentId: ${studentIdValidation.error}`);
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
  const token = crypto.randomUUID();
  const tokenHash = await sha256(token);
  const invitedVia = normalizeChannel(String(payload.invitedVia ?? ""));
  if (!invitedVia) {
    return createError(req, 400, "INVALID_REQUEST", "Invalid invitation channel");
  }
  const invitedToValidation = validateStringField(payload.invitedTo, {
    maxLength: 255,
    ...(invitedVia === "email"
      ? {
          minLength: 5,
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        }
      : {}),
  });
  if (invitedVia === "email" && !invitedToValidation.ok) {
    return createError(req, 400, "INVALID_REQUEST", "Invalid invitation email");
  }
  const invitedTo = invitedToValidation.ok && invitedToValidation.data
    ? invitedVia === "email"
      ? invitedToValidation.data.trim().toLowerCase()
      : invitedToValidation.data.trim()
    : null;

  const { data: invite, error: insertError } = await supabase
    .rpc("create_student_invite_access", {
      p_student_id: studentId,
      p_token_hash: tokenHash,
      p_invited_via: invitedVia,
      p_invited_to: invitedTo,
    })
    .single();

  if (insertError || !invite) {
    const message = insertError?.message ?? "";
    if (message.includes("STUDENT_NOT_FOUND")) {
      return createError(req, 404, "STUDENT_NOT_FOUND", "Student not found");
    }
    if (message.includes("STUDENT_ALREADY_LINKED")) {
      return createError(req, 409, "STUDENT_ALREADY_LINKED", "Student already linked");
    }
    if (message.includes("NOT_AUTHORIZED")) {
      return createError(req, 403, "FORBIDDEN", "Forbidden");
    }
    console.error("create-student-invite: atomic insert failed");
    return createError(req, 500, "SERVER_ERROR", "Failed to create invite");
  }

  const expiresAt = String(
    (invite as { expires_at?: unknown }).expires_at ?? ""
  );
  if (!expiresAt) {
    return createError(req, 500, "SERVER_ERROR", "Failed to create invite");
  }

  return new Response(
    JSON.stringify({
      token,
      expires_at: expiresAt,
      student_id: studentId,
    }),
    { headers: makeJsonHeaders(req) }
  );
});
