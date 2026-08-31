import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { hasTrustedInviteIdentity } from "../_shared/invite-email-verification.ts";
import { validateObjectPayload } from "../_shared/input-validation.ts";
import { authenticateRequest } from "../_shared/middlewares/auth.ts";
import {
  hashStudentRelationshipInviteToken,
  normalizeStudentRelationshipInviteToken,
} from "../_shared/student-relationship-invite.ts";

type ClaimReceiptRow = {
  status?: unknown;
  relationship_id?: unknown;
  organization_id?: unknown;
  student_id?: unknown;
  relationship_kind?: unknown;
};

const jsonHeaders = (req: Request) => ({
  ...buildCorsHeaders(req),
  "Content-Type": "application/json",
});

const errorResponse = (
  req: Request,
  status: number,
  code: string,
  error: string,
) => new Response(JSON.stringify({ code, error }), {
  status,
  headers: jsonHeaders(req),
});

const mapClaimError = (message: string) => {
  if (message.includes("INVITE_EMAIL_MISMATCH")) {
    return { status: 403, code: "INVITE_EMAIL_MISMATCH", error: "Invite belongs to another email" };
  }
  if (message.includes("INVITE_ALREADY_USED")) {
    return { status: 409, code: "INVITE_ALREADY_USED", error: "Invite already used" };
  }
  if (message.includes("ATHLETE_ALREADY_LINKED")) {
    return { status: 409, code: "STUDENT_ALREADY_LINKED", error: "Athlete already linked" };
  }
  if (message.includes("STUDENT_NOT_FOUND")) {
    return { status: 404, code: "STUDENT_NOT_FOUND", error: "Student not found" };
  }
  for (const code of ["INVITE_REVOKED", "INVITE_EXPIRED", "INVITE_INVALID"]) {
    if (message.includes(code)) {
      return { status: 400, code, error: "Invite is not available" };
    }
  }
  return null;
};

const sanitizedReceipt = (row: ClaimReceiptRow) => {
  const status = String(row.status ?? "").trim();
  const relationshipId = String(row.relationship_id ?? "").trim();
  const organizationId = String(row.organization_id ?? "").trim();
  const studentId = String(row.student_id ?? "").trim();
  const relationshipKind = String(row.relationship_kind ?? "").trim();
  if (
    (status !== "claimed" && status !== "already_claimed") ||
    !relationshipId ||
    !organizationId ||
    !studentId ||
    !relationshipKind
  ) {
    return null;
  }
  return {
    status,
    relationshipId,
    organizationId,
    studentId,
    relationshipKind,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  if (req.method !== "POST") {
    return errorResponse(req, 405, "INVALID_REQUEST", "Method not allowed");
  }

  const auth = await authenticateRequest(req);
  if (!auth) {
    return errorResponse(req, 401, "UNAUTHORIZED", "Unauthorized");
  }
  const user = auth.user;
  if (!hasTrustedInviteIdentity(user)) {
    return errorResponse(
      req,
      403,
      "EMAIL_NOT_VERIFIED",
      "Email verification required",
    );
  }
  const verifiedEmail = String(user.email ?? "").trim().toLowerCase();
  if (!verifiedEmail) {
    return errorResponse(req, 403, "EMAIL_NOT_VERIFIED", "Email verification required");
  }

  let token: string | null = null;
  try {
    const parsed = validateObjectPayload(await req.json(), { maxBytes: 1_024 });
    if (!parsed.ok || !parsed.data) {
      return errorResponse(req, 400, "INVALID_REQUEST", "Invalid JSON");
    }
    token = normalizeStudentRelationshipInviteToken(parsed.data.token);
  } catch {
    return errorResponse(req, 400, "INVALID_REQUEST", "Invalid JSON");
  }
  if (!token) {
    return errorResponse(req, 400, "INVITE_INVALID", "Invalid invite");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse(req, 500, "SERVER_ERROR", "Missing configuration");
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tokenHash = await hashStudentRelationshipInviteToken(token);
  const { data, error } = await admin.rpc(
    "claim_student_relationship_invite_v1",
    {
      p_token_hash: tokenHash,
      p_user_id: user.id,
      p_user_email: verifiedEmail,
    },
  );

  if (error) {
    const known = mapClaimError(error.message ?? "");
    if (known) {
      return errorResponse(req, known.status, known.code, known.error);
    }
    console.error("claim-student-relationship-invite: atomic claim failed");
    return errorResponse(req, 500, "SERVER_ERROR", "Failed to claim invite");
  }

  const receipt = sanitizedReceipt(
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as ClaimReceiptRow)
      : {},
  );
  if (!receipt) {
    console.error("claim-student-relationship-invite: invalid RPC receipt");
    return errorResponse(req, 500, "SERVER_ERROR", "Failed to claim invite");
  }

  return new Response(JSON.stringify({ receipt }), {
    status: 200,
    headers: jsonHeaders(req),
  });
});
