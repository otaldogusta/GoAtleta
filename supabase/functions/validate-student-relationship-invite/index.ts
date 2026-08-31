import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { validateObjectPayload } from "../_shared/input-validation.ts";
import {
  hashStudentRelationshipInviteToken,
  normalizeStudentRelationshipInviteToken,
} from "../_shared/student-relationship-invite.ts";

type InvitePreviewRow = {
  invite_id?: unknown;
  organization_id?: unknown;
  organization_name?: unknown;
  student_id?: unknown;
  student_name?: unknown;
  relationship_kind?: unknown;
  relationship_label?: unknown;
  expires_at?: unknown;
  can_view_profile?: unknown;
  can_view_schedule?: unknown;
  can_view_attendance?: unknown;
  can_view_progress?: unknown;
  can_view_health?: unknown;
  can_sign_consents?: unknown;
  can_view_financial?: unknown;
  can_pay?: unknown;
};

const jsonHeaders = (req: Request) => ({
  ...buildCorsHeaders(req),
  "Content-Type": "application/json",
});

const respond = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders(req) });

const asBoolean = (value: unknown) => value === true;

const sanitizedPreview = (row: InvitePreviewRow) => {
  const inviteId = String(row.invite_id ?? "").trim();
  const organizationId = String(row.organization_id ?? "").trim();
  const organizationName = String(row.organization_name ?? "").trim();
  const studentId = String(row.student_id ?? "").trim();
  const studentName = String(row.student_name ?? "").trim();
  const relationshipKind = String(row.relationship_kind ?? "").trim();
  const expiresAt = String(row.expires_at ?? "").trim();
  if (
    !inviteId ||
    !organizationId ||
    !organizationName ||
    !studentId ||
    !studentName ||
    !relationshipKind ||
    !expiresAt
  ) {
    return null;
  }

  return {
    inviteId,
    organization: { id: organizationId, name: organizationName },
    student: { id: studentId, name: studentName },
    relationship: {
      kind: relationshipKind,
      label: String(row.relationship_label ?? "").trim() || null,
    },
    expiresAt,
    permissions: {
      canViewProfile: asBoolean(row.can_view_profile),
      canViewSchedule: asBoolean(row.can_view_schedule),
      canViewAttendance: asBoolean(row.can_view_attendance),
      canViewProgress: asBoolean(row.can_view_progress),
      canViewHealth: asBoolean(row.can_view_health),
      canSignConsents: asBoolean(row.can_sign_consents),
      canViewFinancial: asBoolean(row.can_view_financial),
      canPay: asBoolean(row.can_pay),
    },
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  if (req.method !== "POST") {
    return respond(req, 405, {
      code: "INVALID_REQUEST",
      error: "Method not allowed",
    });
  }

  let token: string | null = null;
  try {
    const parsed = validateObjectPayload(await req.json(), { maxBytes: 1_024 });
    if (!parsed.ok || !parsed.data) {
      return respond(req, 400, { code: "INVALID_REQUEST", error: "Invalid JSON" });
    }
    token = normalizeStudentRelationshipInviteToken(parsed.data.token);
  } catch {
    return respond(req, 400, { code: "INVALID_REQUEST", error: "Invalid JSON" });
  }
  if (!token) {
    return respond(req, 400, { code: "INVITE_INVALID", error: "Invalid invite" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return respond(req, 500, { code: "SERVER_ERROR", error: "Missing configuration" });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tokenHash = await hashStudentRelationshipInviteToken(token);
  const { data, error } = await admin
    .rpc("validate_student_relationship_invite_v1", {
      p_token_hash: tokenHash,
    })
    .single();

  if (error || !data) {
    const message = error?.message ?? "";
    const code = message.includes("INVITE_EXPIRED")
      ? "INVITE_EXPIRED"
      : message.includes("INVITE_REVOKED")
        ? "INVITE_REVOKED"
        : message.includes("INVITE_ALREADY_USED")
          ? "INVITE_ALREADY_USED"
          : "INVITE_INVALID";
    const status = code === "INVITE_ALREADY_USED" ? 409 : code === "INVITE_INVALID" ? 400 : 410;
    return respond(req, status, { code, error: "Invite is not available" });
  }

  const preview = sanitizedPreview(data as InvitePreviewRow);
  if (!preview) {
    console.error("validate-student-relationship-invite: invalid RPC projection");
    return respond(req, 500, { code: "SERVER_ERROR", error: "Invalid invite preview" });
  }

  return respond(req, 200, { status: "valid", preview });
});
