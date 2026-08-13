import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { validateStringField } from "../_shared/input-validation.ts";

const jsonHeaders = (req: Request) => ({
  ...buildCorsHeaders(req),
  "Content-Type": "application/json",
});

const respond = (
  req: Request,
  status: number,
  payload: Record<string, unknown>
) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders(req),
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  if (req.method !== "POST") {
    return respond(req, 405, { code: "INVALID_REQUEST", error: "Method not allowed" });
  }

  let payload: { email?: unknown; code?: unknown } = {};
  try {
    payload = (await req.json()) as { email?: unknown; code?: unknown };
  } catch {
    return respond(req, 400, { code: "INVALID_REQUEST", error: "Invalid JSON" });
  }

  const email = validateStringField(payload.email, {
    minLength: 5,
    maxLength: 320,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  });
  const code = validateStringField(payload.code, {
    minLength: 6,
    maxLength: 6,
    pattern: /^\d{6}$/,
  });
  if (!email.ok || !code.ok) {
    return respond(req, 400, { code: "INVALID_REQUEST", error: "Invalid verification data" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return respond(req, 500, { code: "SERVER_ERROR", error: "Verification unavailable" });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });
  const { data: verified, error: verifyError } = await authClient.auth.verifyOtp({
    email: email.data.toLowerCase(),
    token: code.data,
    type: "email",
  });
  if (verifyError || !verified.user || !verified.session) {
    return respond(req, 400, { code: "OTP_INVALID", error: "Invalid or expired verification code" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const verifiedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(
    verified.user.id,
    {
      app_metadata: {
        ...(verified.user.app_metadata ?? {}),
        email_verified_hybrid_at: verifiedAt,
        email_verification_source: "otp",
      },
    }
  );
  if (updateError || !updated.user) {
    return respond(req, 500, { code: "SERVER_ERROR", error: "Verification could not be recorded" });
  }

  return respond(req, 200, {
    ...verified.session,
    user: updated.user,
  });
});
