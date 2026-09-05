import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import {
  validateObjectPayload,
  validateStringField,
} from "../_shared/input-validation.ts";
import { authenticateRequest } from "../_shared/middlewares/auth.ts";
import {
  buildStudentRelationshipInviteUrl,
  generateStudentRelationshipInviteToken,
  hashStudentRelationshipInviteToken,
} from "../_shared/student-relationship-invite.ts";

type RelationshipKind = "athlete" | "guardian" | "payer" | "viewer";
type InviteChannel = "email" | "whatsapp" | "link";

type RelationshipPermissions = {
  canViewProfile?: boolean;
  canViewSchedule?: boolean;
  canViewAttendance?: boolean;
  canViewProgress?: boolean;
  canViewHealth?: boolean;
  canSignConsents?: boolean;
  canViewFinancial?: boolean;
  canPay?: boolean;
};

type CreateInvitePayload = {
  organizationId?: unknown;
  studentId?: unknown;
  invitedEmail?: unknown;
  relationshipKind?: unknown;
  relationshipLabel?: unknown;
  invitedVia?: unknown;
  permissions?: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RELATIONSHIP_KINDS = new Set<RelationshipKind>([
  "athlete",
  "guardian",
  "payer",
  "viewer",
]);
const INVITE_CHANNELS = new Set<InviteChannel>([
  "email",
  "whatsapp",
  "link",
]);
const PERMISSION_KEYS = [
  "canViewProfile",
  "canViewSchedule",
  "canViewAttendance",
  "canViewProgress",
  "canViewHealth",
  "canSignConsents",
  "canViewFinancial",
  "canPay",
] as const;

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

const parsePermissions = (
  value: unknown,
): RelationshipPermissions | null => {
  if (value === undefined) return {};
  const validation = validateObjectPayload(value, { maxBytes: 2_048 });
  if (!validation.ok || !validation.data) return null;

  const allowed = new Set<string>(PERMISSION_KEYS);
  for (const [key, permissionValue] of Object.entries(validation.data)) {
    if (!allowed.has(key) || typeof permissionValue !== "boolean") return null;
  }
  return validation.data as RelationshipPermissions;
};

const mapCreateError = (message: string) => {
  if (message.includes("ATHLETE_RELATIONSHIP_IMMUTABLE")) {
    return { status: 409, code: "ATHLETE_RELATIONSHIP_IMMUTABLE", error: "A conta do atleta não pode ser usada como responsável pelo mesmo cadastro." };
  }
  if (message.includes("NOT_AUTHORIZED")) {
    return { status: 403, code: "FORBIDDEN", error: "Forbidden" };
  }
  if (message.includes("STUDENT_NOT_FOUND")) {
    return { status: 404, code: "STUDENT_NOT_FOUND", error: "Student not found" };
  }
  if (message.includes("ATHLETE_ALREADY_LINKED")) {
    return {
      status: 409,
      code: "STUDENT_ALREADY_LINKED",
      error: "Athlete already linked",
    };
  }
  if (
    message.includes("RELATIONSHIP_KIND_INVALID") ||
    message.includes("INVITE_EMAIL_REQUIRED") ||
    message.includes("INVITE_CHANNEL_INVALID") ||
    message.includes("INVITE_TOKEN_HASH_INVALID")
  ) {
    return { status: 400, code: "INVALID_REQUEST", error: "Invalid invite" };
  }
  return null;
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

  let payload: CreateInvitePayload;
  try {
    const parsed = validateObjectPayload(await req.json(), { maxBytes: 4_096 });
    if (!parsed.ok || !parsed.data) {
      return errorResponse(req, 400, "INVALID_REQUEST", "Invalid JSON");
    }
    payload = parsed.data;
  } catch {
    return errorResponse(req, 400, "INVALID_REQUEST", "Invalid JSON");
  }

  const organization = validateStringField(payload.organizationId, {
    minLength: 36,
    maxLength: 36,
    pattern: UUID_PATTERN,
  });
  const student = validateStringField(payload.studentId, {
    minLength: 1,
    maxLength: 128,
  });
  const email = validateStringField(payload.invitedEmail, {
    minLength: 5,
    maxLength: 254,
    pattern: EMAIL_PATTERN,
  });
  if (!organization.ok || !student.ok || !email.ok) {
    return errorResponse(req, 400, "INVALID_REQUEST", "Invalid invite fields");
  }

  const relationshipKind = String(payload.relationshipKind ?? "")
    .trim()
    .toLowerCase() as RelationshipKind;
  const invitedVia = String(payload.invitedVia ?? "email")
    .trim()
    .toLowerCase() as InviteChannel;
  if (!RELATIONSHIP_KINDS.has(relationshipKind)) {
    return errorResponse(req, 400, "INVALID_REQUEST", "Invalid relationship kind");
  }
  if (!INVITE_CHANNELS.has(invitedVia)) {
    return errorResponse(req, 400, "INVALID_REQUEST", "Invalid invite channel");
  }

  const label = validateStringField(payload.relationshipLabel, { maxLength: 80 });
  if (!label.ok) {
    return errorResponse(req, 400, "INVALID_REQUEST", "Invalid relationship label");
  }
  const permissions = parsePermissions(payload.permissions);
  if (!permissions) {
    return errorResponse(req, 400, "INVALID_REQUEST", "Invalid permissions");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    return errorResponse(req, 500, "SERVER_ERROR", "Missing configuration");
  }
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${auth.token}` } },
  });

  let token = "";
  let inviteId = "";
  let expiresAt = "";
  let finalError: { message?: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    token = generateStudentRelationshipInviteToken();
    const tokenHash = await hashStudentRelationshipInviteToken(token);
    const canPay = permissions.canPay ?? false;
    const { data, error } = await supabase
      .rpc("create_student_relationship_invite_v1", {
        p_org_id: organization.data,
        p_student_id: student.data,
        p_token_hash: tokenHash,
        p_invited_email: email.data.toLowerCase(),
        p_relationship_kind: relationshipKind,
        p_relationship_label: label.data || null,
        p_invited_via: invitedVia,
        p_can_view_profile: permissions.canViewProfile ?? true,
        p_can_view_schedule: permissions.canViewSchedule ?? false,
        p_can_view_attendance: permissions.canViewAttendance ?? false,
        p_can_view_progress: permissions.canViewProgress ?? false,
        p_can_view_health: permissions.canViewHealth ?? false,
        p_can_sign_consents: permissions.canSignConsents ?? false,
        p_can_view_financial:
          (permissions.canViewFinancial ?? false) || canPay,
        p_can_pay: canPay,
      })
      .single();

    if (!error && data) {
      const row = data as { invite_id?: unknown; expires_at?: unknown };
      inviteId = String(row.invite_id ?? "").trim();
      expiresAt = String(row.expires_at ?? "").trim();
      finalError = null;
      break;
    }

    finalError = error;
    const message = error?.message?.toLowerCase() ?? "";
    if (!message.includes("duplicate") && !message.includes("unique")) break;
  }

  if (finalError || !inviteId || !expiresAt || !token) {
    const known = mapCreateError(finalError?.message ?? "");
    if (known) {
      return errorResponse(req, known.status, known.code, known.error);
    }
    console.error("create-student-relationship-invite: atomic create failed");
    return errorResponse(req, 500, "SERVER_ERROR", "Failed to create invite");
  }

  const appBaseUrl =
    Deno.env.get("APP_INVITE_URL") ?? Deno.env.get("APP_URL") ?? "";
  const inviteUrl = buildStudentRelationshipInviteUrl(token, appBaseUrl);

  return new Response(
    JSON.stringify({ inviteId, expiresAt, token, inviteUrl }),
    { status: 200, headers: jsonHeaders(req) },
  );
});
