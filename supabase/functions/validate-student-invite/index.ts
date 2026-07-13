import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = (req: Request) => ({
  ...buildCorsHeaders(req),
  "Content-Type": "application/json",
});

const response = (req: Request, status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders(req) });

const sha256 = async (value: string) => {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight(req);
  if (req.method !== "POST") {
    return response(req, 405, { code: "INVALID_REQUEST", error: "Method not allowed" });
  }

  let token = "";
  try {
    const payload = (await req.json()) as { token?: string };
    token = (payload.token ?? "").trim();
  } catch {
    return response(req, 400, { code: "INVALID_REQUEST", error: "Invalid JSON" });
  }
  if (!token || token.length > 128) {
    return response(req, 400, { code: "INVITE_INVALID", error: "Invalid invite" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return response(req, 500, { code: "SERVER_ERROR", error: "Missing configuration" });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const tokenHash = await sha256(token);
  const { data: invite, error } = await admin
    .from("student_invites")
    .select("expires_at, used_at, revoked")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) return response(req, 500, { code: "SERVER_ERROR", error: "Invite lookup failed" });
  if (!invite) return response(req, 400, { code: "INVITE_INVALID", error: "Invalid invite" });
  if (invite.revoked) return response(req, 400, { code: "INVITE_REVOKED", error: "Invite revoked" });
  if (invite.used_at) return response(req, 400, { code: "INVITE_ALREADY_USED", error: "Invite already used" });
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return response(req, 400, { code: "INVITE_EXPIRED", error: "Invite expired" });
  }

  return response(req, 200, { status: "valid" });
});
