import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasTrustedInviteIdentity } from "../_shared/invite-email-verification.ts";
import { validateObjectPayload } from "../_shared/input-validation.ts";
import { authenticateRequest } from "../_shared/middlewares/auth.ts";


const makeJsonHeaders = (req: Request) => ({ ...buildCorsHeaders(req), "Content-Type": "application/json" });

const createError = (req: Request, status: number, code: string, error: string) =>
  new Response(JSON.stringify({ code, error }), { status, headers: makeJsonHeaders(req) });

const toHex = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
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
  const user = auth.user;

  if (!hasTrustedInviteIdentity(user)) {
    return createError(req, 403, "EMAIL_NOT_VERIFIED", "Email verification required");
  }

  let payload: { token: string } = { token: "" };
  try {
    const parsed = validateObjectPayload(await req.json());
    if (!parsed.ok || !parsed.data) {
      return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
    }
    payload = parsed.data as { token: string };
  } catch {
    return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
  }

  const token = String(payload.token ?? "").trim();
  if (!token || token.length > 128) {
    return createError(req, 400, "INVALID_REQUEST", "Missing token");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return createError(req, 500, "SERVER_ERROR", "Missing Supabase service role config");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const tokenHash = await sha256(token);

  const { data: claim, error: claimError } = await supabase.rpc(
    "claim_student_invite_access",
    {
      p_token_hash: tokenHash,
      p_user_id: user.id,
      p_user_email: String(user.email ?? "").trim().toLowerCase() || null,
    }
  );

  if (claimError) {
    const message = claimError.message ?? "";
    const knownError = [
      "INVITE_ALREADY_USED",
      "INVITE_REVOKED",
      "INVITE_EXPIRED",
      "INVITE_INVALID",
      "INVITE_EMAIL_MISMATCH",
      "STUDENT_ALREADY_LINKED",
      "STUDENT_NOT_FOUND",
    ].find((code) => message.includes(code));

    if (knownError === "INVITE_ALREADY_USED") {
      return createError(req, 409, knownError, "Invite already used");
    }
    if (knownError === "INVITE_EMAIL_MISMATCH") {
      return createError(req, 403, knownError, "Invite belongs to another email");
    }
    if (knownError === "STUDENT_ALREADY_LINKED") {
      return createError(req, 409, knownError, "Student already linked");
    }
    if (knownError === "STUDENT_NOT_FOUND") {
      return createError(req, 404, knownError, "Student not found");
    }
    if (knownError) {
      return createError(req, 400, knownError, "Invite is not available");
    }

    console.error("claim-student-invite: atomic claim failed");
    return createError(req, 500, "SERVER_ERROR", "Failed to apply invite access");
  }

  const claimPayload = claim && typeof claim === "object"
    ? claim as { student_id?: unknown }
    : null;
  const studentId = String(claimPayload?.student_id ?? "").trim();
  if (!studentId) {
    console.error("claim-student-invite: atomic claim returned no student id");
    return createError(req, 500, "SERVER_ERROR", "Failed to apply invite access");
  }

  return new Response(
    JSON.stringify({ status: "ok", student_id: studentId }),
    { headers: makeJsonHeaders(req) }
  );
});
