import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validateObjectPayload,
  validateStringField,
} from "../_shared/input-validation.ts";


const makeJsonHeaders = (req: Request) => ({ ...buildCorsHeaders(req), "Content-Type": "application/json" });

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CHANNELS = new Set(["whatsapp", "email", "link"]);

type InviteRole = "collaborator" | "professor" | "intern" | "moderator";

const PERMISSION_KEYS = [
  "reports",
  "events",
  "students",
  "classes",
  "training",
  "periodization",
  "calendar",
  "absence_notices",
  "whatsapp_settings",
  "assistant",
  "org_members",
  "financial",
] as const;

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

const sendInviteEmail = async (to: string, signupLink: string, roleLabel: string) => {
  const apiKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY_NOT_CONFIGURED", providerId: undefined };
  }
  const from =
    (Deno.env.get("INVITE_EMAIL_FROM") ?? "").trim() ||
    "Go Atleta <nao-responda@auth.goatleta.com>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Você recebeu um convite para o Go Atleta",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#102038">
          <h1 style="font-size:22px">Convite para o Go Atleta</h1>
          <p>Você recebeu acesso como <strong>${roleLabel}</strong>.</p>
          <p><a href="${signupLink}" style="display:inline-block;padding:12px 18px;background:#41d984;color:#07111f;text-decoration:none;border-radius:8px;font-weight:700">Aceitar convite</a></p>
          <p style="font-size:12px;color:#5f6f85">Se você não esperava este convite, ignore esta mensagem.</p>
        </div>
      `,
    }),
  });
  if (!response.ok) {
    return { sent: false, error: `RESEND_${response.status}`, providerId: undefined };
  }
  const payload = (await response.json().catch(() => ({}))) as { id?: string };
  return { sent: true, error: undefined, providerId: payload.id };
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
    permissionKeys?: string[];
  } = { organizationId: "", role: "collaborator" };

  try {
    const parsed = validateObjectPayload(await req.json());
    if (!parsed.ok || !parsed.data) {
      return createError(req, 400, "INVALID_REQUEST", "Invalid JSON");
    }
    payload = parsed.data as typeof payload;
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

  const role: InviteRole =
    payload.role === "moderator"
      ? "moderator"
      : payload.role === "intern"
        ? "intern"
        : payload.role === "professor"
          ? "professor"
          : "collaborator";
  const targetRoleLevel = role === "moderator" ? 50 : role === "intern" ? 5 : 10;
  const permissionKeys = Array.from(
    new Set(
      (Array.isArray(payload.permissionKeys) ? payload.permissionKeys : []).filter(
        (key): key is typeof PERMISSION_KEYS[number] =>
          typeof key === "string" &&
          key !== "org_members" &&
          PERMISSION_KEYS.includes(key as typeof PERMISSION_KEYS[number])
      )
    )
  );

  const invitedVia = String(payload.invitedVia ?? "link").trim().toLowerCase();
  const invitedTo = String(payload.invitedTo ?? "").trim() || null;
  if (!INVITE_CHANNELS.has(invitedVia)) {
    return createError(req, 400, "INVALID_REQUEST", "Invalid invitation channel");
  }
  if (invitedVia === "email" && (!invitedTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedTo))) {
    return createError(req, 400, "INVALID_REQUEST", "A valid recipient email is required");
  }
  // The schema records one claimant, so every new link is intentionally single-use.
  // Keep accepting older clients that still send maxUses, but never persist it.
  const maxUses = 1;

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

  let code = "";
  let codeHash = "";
  let insertError: { message: string } | null = null;
  let inviteId = "";
  let expiresAt = "";

  for (let attempt = 0; attempt < 4; attempt += 1) {
    code = normalizeCode(`${randomCode(4)}-${randomCode(4)}`);
    codeHash = await sha256(code);

    const { data, error } = await supabase
      .rpc("create_trainer_invite_access", {
        p_org_id: orgValidation.data,
        p_code_hash: codeHash,
        p_target_role_level: targetRoleLevel,
        p_invited_via: invitedVia,
        p_invited_to: invitedTo,
        p_initial_permissions: permissionKeys,
      })
      .single();

    if (!error) {
      insertError = null;
      const inviteRow = data as {
        invite_id?: unknown;
        expires_at?: unknown;
      } | null;
      inviteId = String(inviteRow?.invite_id ?? "");
      expiresAt = String(inviteRow?.expires_at ?? "");
      break;
    }

    insertError = error;
    if (error.message?.toLowerCase().includes("duplicate") || error.message?.toLowerCase().includes("unique")) {
      continue;
    }
    break;
  }

  if (insertError) {
    if (insertError.message?.includes("NOT_AUTHORIZED")) {
      return createError(req, 403, "ORG_FORBIDDEN", "Forbidden");
    }
    return createError(req, 500, "SERVER_ERROR", "Failed to create invite");
  }
  if (!inviteId || !expiresAt) {
    return createError(req, 500, "SERVER_ERROR", "Failed to create invite");
  }

  const signupLink = buildSignupLink(code);
  const roleLabel =
    role === "moderator" ? "coordenação" : role === "intern" ? "estagiário" : "professor";
  const emailResult =
    invitedTo && invitedVia === "email"
      ? await sendInviteEmail(invitedTo, signupLink, roleLabel)
      : { sent: false, error: undefined, providerId: undefined };

  if (inviteId && invitedVia === "email") {
    await admin
      .from("trainer_invites")
      .update({
        delivery_status: emailResult.sent ? "sent" : "delivery_failed",
        delivery_attempted_at: new Date().toISOString(),
        delivery_provider_id: emailResult.providerId ?? null,
        delivery_error: emailResult.error ?? null,
      })
      .eq("id", inviteId);
  }

  return new Response(
    JSON.stringify({
      code,
      signup_link: signupLink,
      email_sent: emailResult.sent,
      email_error: emailResult.error,
      invite: {
        id: inviteId,
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
