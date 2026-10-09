import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { isTrainerInviteAvailable } from "../_shared/trainer-invite-validation.ts";

// Dedicated local signup worktree; do not broaden the shared production allowlist.
const corsHeaders = (req: Request) => {
  const headers = buildCorsHeaders(req);
  if (req.headers.get("Origin") === "http://localhost:8089") {
    headers["Access-Control-Allow-Origin"] = "http://localhost:8089";
  }
  return headers;
};

const respond = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return respond(req, 405, { code: "INVALID_REQUEST" });
  let code = "";
  try {
    const body = await req.json();
    if (typeof body?.code === "string") code = body.code.trim().toUpperCase();
  } catch {
    return respond(req, 400, { code: "INVALID_REQUEST" });
  }
  if (!/^[A-Z0-9-]{4,128}$/.test(code)) return respond(req, 400, { code: "INVITE_INVALID" });
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return respond(req, 503, { code: "SERVER_ERROR" });
  try {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
    const codeHash = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.from("trainer_invites")
      .select("revoked, claimed_by, uses, max_uses, expires_at")
      .eq("code_hash", codeHash).maybeSingle();
    if (error) return respond(req, 503, { code: "SERVER_ERROR" });
    // All unavailable states share a response; this never consumes the invitation.
    if (!isTrainerInviteAvailable(data)) return respond(req, 400, { code: "INVITE_INVALID" });
    return respond(req, 200, { status: "valid" });
  } catch {
    return respond(req, 503, { code: "SERVER_ERROR" });
  }
});
