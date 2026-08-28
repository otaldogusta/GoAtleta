import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasTrustedInviteIdentity } from "../_shared/invite-email-verification.ts";
import {
  validateObjectPayload,
  validateStringField,
} from "../_shared/input-validation.ts";


const makeJsonHeaders = (req: Request) => ({ ...buildCorsHeaders(req), "Content-Type": "application/json" });

const createError = (req: Request, status: number, code: string, error: string) =>
  new Response(JSON.stringify({ code, error }), {
    status,
    headers: makeJsonHeaders(req),
  });

const normalizeCode = (value: string) => value.trim().toUpperCase();

const toHex = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
};

const createAnonClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
};

const requireUser = async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  const supabase = createAnonClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflight(req);
  }
  if (req.method !== "POST") {
    return createError(req, 405, "INVALID_REQUEST", "Method not allowed");
  }

  const user = await requireUser(req);
  if (!user) {
    return createError(req, 401, "UNAUTHORIZED", "Unauthorized");
  }

  if (!hasTrustedInviteIdentity(user)) {
    return createError(req, 403, "EMAIL_NOT_VERIFIED", "Email verification required");
  }

  let payload: { code: string } = { code: "" };
  try {
    const parsed = validateObjectPayload(await req.json());
    if (!parsed.ok || !parsed.data) {
      return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
    }
    payload = parsed.data as { code: string };
  } catch {
    return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
  }

  const codeValidation = validateStringField(payload.code, {
    minLength: 4,
    maxLength: 128,
    pattern: /^[a-zA-Z0-9-]+$/,
  });
  if (!codeValidation.ok) {
    return createError(req, 400, "INVALID_REQUEST", `Invalid code: ${codeValidation.error}`);
  }
  const normalized = normalizeCode(codeValidation.data);
  if (!normalized) {
    return createError(req, 400, "INVALID_REQUEST", "Missing code");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return createError(req, 500, "SERVER_ERROR", "Missing Supabase service role config");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const codeHash = await sha256(normalized);

  const { data: invite, error: inviteError } = await supabase
    .from("trainer_invites")
    .select("id, uses, max_uses, expires_at, revoked, organization_id, target_role_level, initial_permissions, invited_via, invited_to, claimed_by, claimed_at, created_by")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (inviteError) {
    return createError(req, 500, "SERVER_ERROR", "Invite lookup failed");
  }

  if (!invite) {
    return createError(req, 400, "INVITE_INVALID", "Invalid invite");
  }

  if (invite.claimed_by && invite.claimed_by !== user.id) {
    return createError(req, 400, "INVITE_ALREADY_USED", "Invite already used");
  }

  if (!invite.claimed_by) {
    if (invite.revoked) {
      return createError(req, 400, "INVITE_REVOKED", "Invite revoked");
    }

    if (invite.expires_at) {
      const expiresAt = new Date(invite.expires_at);
      if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
        return createError(req, 400, "INVITE_EXPIRED", "Invite expired");
      }
    }

    if (invite.uses >= invite.max_uses) {
      return createError(req, 400, "INVITE_LIMIT_REACHED", "Invite limit reached");
    }

    const invitedEmail = String(invite.invited_to ?? "").trim().toLowerCase();
    const authenticatedEmail = String(user.email ?? "").trim().toLowerCase();
    if (invite.invited_via === "email" && invitedEmail && invitedEmail !== authenticatedEmail) {
      return createError(req, 403, "INVITE_EMAIL_MISMATCH", "Invite belongs to another email");
    }
  }

  const { error: claimError } = await supabase.rpc("claim_trainer_invite_access", {
    p_invite_id: invite.id,
    p_user_id: user.id,
  });
  if (claimError) {
    const message = claimError.message ?? "";
    const claimErrorCode = message.includes("INVITE_ALREADY_USED")
      ? "INVITE_ALREADY_USED"
      : message.includes("INVITE_REVOKED")
        ? "INVITE_REVOKED"
        : message.includes("INVITE_EXPIRED")
          ? "INVITE_EXPIRED"
          : message.includes("INVITE_EMAIL_MISMATCH")
            ? "INVITE_EMAIL_MISMATCH"
            : "SERVER_ERROR";
    await supabase
      .from("trainer_invites")
      .update({
        claim_failed_at: new Date().toISOString(),
        claim_error_code: claimErrorCode,
      })
      .eq("id", invite.id);
    if (message.includes("INVITE_ALREADY_USED")) {
      return createError(req, 409, "INVITE_ALREADY_USED", "Invite already used");
    }
    if (message.includes("INVITE_REVOKED")) {
      return createError(req, 400, "INVITE_REVOKED", "Invite revoked");
    }
    if (message.includes("INVITE_EXPIRED")) {
      return createError(req, 400, "INVITE_EXPIRED", "Invite expired");
    }
    if (message.includes("INVITE_EMAIL_MISMATCH")) {
      return createError(req, 403, "INVITE_EMAIL_MISMATCH", "Invite belongs to another email");
    }
    return createError(req, 500, "SERVER_ERROR", "Failed to apply invite access");
  }

  await supabase
    .from("trainer_invites")
    .update({ claim_failed_at: null, claim_error_code: null })
    .eq("id", invite.id);

  return new Response(JSON.stringify({ status: "ok" }), {
    headers: makeJsonHeaders(req),
  });
});
