import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateStringField } from "../_shared/input-validation.ts";


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

  let payload: { code: string } = {};
  try {
    payload = (await req.json()) as { code: string };
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
    .select("id, uses, max_uses, expires_at, revoked, organization_id, target_role_level")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (inviteError) {
    return createError(req, 500, "SERVER_ERROR", "Invite lookup failed");
  }

  if (!invite) {
    return createError(req, 400, "INVITE_INVALID", "Invalid invite");
  }

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

  const nowIso = new Date().toISOString();
  const { data: updatedInvite, error: updateError } = await supabase
    .from("trainer_invites")
    .update({ uses: invite.uses + 1, claimed_by: user.id, claimed_at: nowIso })
    .eq("id", invite.id)
    .eq("uses", invite.uses)
    .select()
    .maybeSingle();

  if (updateError || !updatedInvite) {
    return createError(req, 409, "INVITE_CONFLICT", "Invite update conflict or already used concurrently");
  }

  const { error: trainerError } = await supabase
    .from("trainers")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });

  if (trainerError) {
    return createError(req, 500, "SERVER_ERROR", "Failed to create trainer");
  }

  if (invite.organization_id) {
    const targetRoleLevel = Number(invite.target_role_level ?? 10) >= 50 ? 50 : 10;
    const { data: existingMember, error: memberLookupError } = await supabase
      .from("organization_members")
      .select("role_level")
      .eq("organization_id", invite.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberLookupError) {
      return createError(req, 500, "SERVER_ERROR", "Failed to lookup organization member");
    }

    const nextRoleLevel = Math.max(Number(existingMember?.role_level ?? 0), targetRoleLevel);
    const { error: memberUpsertError } = await supabase
      .from("organization_members")
      .upsert(
        {
          organization_id: invite.organization_id,
          user_id: user.id,
          role_level: nextRoleLevel,
        },
        { onConflict: "organization_id,user_id" }
      );

    if (memberUpsertError) {
      return createError(req, 500, "SERVER_ERROR", "Failed to apply organization member role");
    }
  }

  return new Response(JSON.stringify({ status: "ok" }), {
    headers: makeJsonHeaders(req),
  });
});
