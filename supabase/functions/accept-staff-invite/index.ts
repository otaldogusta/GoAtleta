import { createClient } from "https://esm.sh/@supabase/supabase-js@2.115.0";
import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { assertStaffInviteRecipient } from "../_shared/staff-invite-auth.ts";
import { hasTrustedInviteIdentity } from "../_shared/invite-email-verification.ts";

// Public entry: identity comes only from Supabase's single-use email proof,
// never the caller's existing bearer token, email parameter, or user metadata.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
  if (req.method !== "POST") return respond(405, { code: "INVALID_REQUEST" });
  try {
    const body = await req.json();
    const { code, token_hash, type } = body ?? {};
    const completing = body?.action === "complete";
    const preparing = body?.action === "setup";
    if (typeof code !== "string" || !/^[A-Z0-9-]{4,128}$/i.test(code)) return respond(400, { code: "INVITE_INVALID" });
    if (!completing && !preparing && (
        typeof token_hash !== "string" || !/^[a-f0-9]{32,128}$/i.test(token_hash) ||
        !["magiclink", "signup", "invite"].includes(type))) return respond(400, { code: "INVITE_INVALID" });
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code.trim().toUpperCase()));
    const codeHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    const { data: invite, error: lookupError } = await admin.from("trainer_invites")
      .select("id, invited_to, invited_via, revoked, expires_at, uses, max_uses, organization_id, claimed_by")
      .eq("code_hash", codeHash).maybeSingle();
    if (lookupError) return respond(503, { code: "INVITE_UNAVAILABLE" });
    if (!invite || invite.revoked ||
        (invite.expires_at && Date.parse(invite.expires_at) <= Date.now())) {
      return respond(400, { code: "INVITE_INVALID" });
    }
    if (!completing && !preparing && (invite.invited_via !== "email" || !invite.invited_to)) {
      return respond(400, { code: "INVITE_INVALID" });
    }
    if (completing || preparing) {
      const bearer = req.headers.get("Authorization") ?? "";
      if (!bearer.startsWith("Bearer ")) return respond(401, { code: "UNAUTHORIZED" });
      const { data, error } = await auth.auth.getUser(bearer.slice(7));
      const user = data?.user;
      if (error || !user || user.app_metadata?.staff_invite_setup_required !== true ||
          !hasTrustedInviteIdentity(user)) {
        return respond(403, { code: "SETUP_NOT_ALLOWED" });
      }
      if (invite.invited_via === "email") assertStaffInviteRecipient(invite.invited_to, user.email);
      if (invite.uses >= invite.max_uses && invite.claimed_by !== user.id) return respond(400, { code: "INVITE_INVALID" });
      if (preparing) return respond(200, { user, organization_id: invite.organization_id });
      if (typeof body.password !== "string" || body.password.trim().length < 6 || body.password.length > 128) {
        return respond(400, { code: "SETUP_FIELDS_INVALID" });
      }
      // Use the recipient's authenticated update, not an admin password reset:
      // admin resets revoke every refresh session, including this signup session.
      const updateAccount = (attributes: Record<string, unknown>) => fetch(`${url}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, Authorization: bearer, "Content-Type": "application/json" },
        body: JSON.stringify(attributes),
      });
      const passwordResponse = await updateAccount({ password: body.password });
      if (!passwordResponse.ok) {
        const failure = await passwordResponse.json().catch(() => ({}));
        // A previous attempt may have saved the password before claim failed.
        if (failure.code !== "same_password") return respond(400, { code: "SETUP_PASSWORD_REJECTED" });
      }
      const { error: claimError } = await admin.rpc("claim_trainer_invite_access", { p_invite_id: invite.id, p_user_id: user.id });
      if (claimError) return respond(409, { code: "INVITE_NOT_APPLIED" });
      const { data: completed, error: completionError } = await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...user.app_metadata, staff_invite_setup_required: false },
      });
      if (completionError || !completed.user) return respond(503, { code: "INVITE_UNAVAILABLE" });
      return respond(200, { user: completed.user, organization_id: invite.organization_id });
    }
    if (invite.uses >= invite.max_uses) return respond(400, { code: "INVITE_INVALID" });
    const { data: verified, error: verificationError } = await auth.auth.verifyOtp({ token_hash, type });
    if (verificationError || !verified.user || !verified.session) return respond(400, { code: "AUTH_LINK_EXPIRED" });
    assertStaffInviteRecipient(invite.invited_to, verified.user.email);
    // Same trusted proof used by canonical email verification; only after Auth verified the token.
    const { data: updated, error: proofError } = await admin.auth.admin.updateUserById(verified.user.id, {
      app_metadata: { ...verified.user.app_metadata, email_verified_hybrid_at: new Date().toISOString(), email_verification_source: "staff_invite_link" },
    });
    if (proofError || !updated.user) return respond(503, { code: "INVITE_UNAVAILABLE" });
    if (updated.user.app_metadata?.staff_invite_setup_required === true) {
      // No organization membership yet; this session is held in memory by the
      // signup form and is not published over the browser's existing account.
      return respond(200, { setup_required: true, session: { ...verified.session, user: updated.user }, organization_id: invite.organization_id });
    }
    // Existing RPC remains the transactional authority for organization role/permissions.
    const { error: claimError } = await admin.rpc("claim_trainer_invite_access", { p_invite_id: invite.id, p_user_id: verified.user.id });
    if (claimError) return respond(409, { code: "INVITE_NOT_APPLIED" });
    return respond(200, { session: { ...verified.session, user: updated.user }, organization_id: invite.organization_id });
  } catch {
    return respond(400, { code: "INVITE_INVALID" });
  }
});
