import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateStringField } from "../_shared/input-validation.ts";


const makeJsonHeaders = (req: Request) => ({ ...buildCorsHeaders(req), "Content-Type": "application/json" });

const INVITE_TTL_DAYS = 14;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type InviteRole = "collaborator" | "moderator";

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

const randomCode = (length: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
};

const normalizeCode = (value: string) => value.trim().toUpperCase();

const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
};

const buildSignupLink = (code: string) => {
  const appBase =
    (Deno.env.get("APP_INVITE_URL") ?? Deno.env.get("APP_URL") ?? "").trim();
  if (appBase) {
    const normalized = appBase.replace(/\/$/, "");
    return `${normalized}/signup?role=trainer&inviteCode=${encodeURIComponent(code)}`;
  }
  return `https://goatleta.com/signup?role=trainer&inviteCode=${encodeURIComponent(code)}`;
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

  let payload: {
    organizationId: string;
    role: InviteRole;
    invitedTo?: string;
    invitedVia?: string;
    maxUses?: number;
  } = { organizationId: "", role: "collaborator" };

  try {
    payload = (await req.json()) as typeof payload;
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

  const role = payload.role === "moderator" ? "moderator" : "collaborator";
  const targetRoleLevel = role === "moderator" ? 50 : 10;

  const invitedVia = (payload.invitedVia ?? "link").trim().toLowerCase();
  const invitedTo = (payload.invitedTo ?? "").trim() || null;
  const maxUses = Number.isFinite(payload.maxUses) ? Math.max(1, Math.min(10, Number(payload.maxUses))) : 1;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
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
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const userId = authData?.user?.id ?? "";
  if (authError || !userId) {
    return createError(req, 401, "UNAUTHORIZED", "Unauthorized");
  }

  const { data: adminRow, error: adminError } = await supabase
    .from("organization_members")
    .select("role_level")
    .eq("organization_id", orgValidation.data)
    .eq("user_id", userId)
    .maybeSingle();

  if (adminError) {
    return createError(req, 500, "SERVER_ERROR", "Organization lookup failed");
  }

  if (!adminRow) {
    return createError(req, 404, "ORG_NOT_FOUND", "Organization not found");
  }

  if ((adminRow.role_level ?? 0) < 50) {
    return createError(req, 403, "ORG_FORBIDDEN", "Forbidden");
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let code = "";
  let codeHash = "";
  let insertError: { message: string } | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    code = normalizeCode(`${randomCode(4)}-${randomCode(4)}`);
    codeHash = await sha256(code);

    // Membership and role were validated through the user-scoped client.
    // Persist with the server client to avoid the legacy `is_trainer()` policy
    // rejecting valid coordinators and organization administrators.
    const { error } = await admin.from("trainer_invites").insert({
      code_hash: codeHash,
      created_by: userId,
      expires_at: expiresAt,
      max_uses: maxUses,
      uses: 0,
      revoked: false,
      organization_id: orgValidation.data,
      target_role_level: targetRoleLevel,
      invited_via: invitedVia,
      invited_to: invitedTo,
    });

    if (!error) {
      insertError = null;
      break;
    }

    insertError = error;
    if (error.message?.toLowerCase().includes("duplicate") || error.message?.toLowerCase().includes("unique")) {
      continue;
    }
    break;
  }

  if (insertError) {
    return createError(req, 500, "SERVER_ERROR", "Failed to create invite");
  }

  return new Response(
    JSON.stringify({
      code,
      signup_link: buildSignupLink(code),
      invite: {
        organization_id: orgValidation.data,
        target_role_level: targetRoleLevel,
        expires_at: expiresAt,
        max_uses: maxUses,
        uses: 0,
        revoked: false,
        invited_via: invitedVia,
        invited_to: invitedTo,
      },
    }),
    { headers: makeJsonHeaders(req) }
  );
});
