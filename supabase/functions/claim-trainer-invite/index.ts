import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

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
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const user = await requireUser(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  let payload: { code: string } = {};
  try {
    payload = (await req.json()) as { code: string };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const rawCode = payload.code ?? "";
  const normalized = normalizeCode(rawCode);
  if (!normalized) {
    return new Response(JSON.stringify({ error: "Missing code" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase service role config" }),
      { status: 500, headers: jsonHeaders }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const codeHash = await sha256(normalized);

  const { data: invite, error: inviteError } = await supabase
    .from("trainer_invites")
    .select("id, uses, max_uses, expires_at, revoked")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (inviteError) {
    return new Response(JSON.stringify({ error: "Invite lookup failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  if (!invite || invite.revoked) {
    return new Response(JSON.stringify({ error: "Invalid invite" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  if (invite.expires_at) {
    const expiresAt = new Date(invite.expires_at);
    if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "Invite expired" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }
  }

  if (invite.uses >= invite.max_uses) {
    return new Response(JSON.stringify({ error: "Invite limit reached" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const { error: trainerError } = await supabase
    .from("trainers")
    .upsert({ user_id: user.id }, { onConflict: "user_id" });

  if (trainerError) {
    return new Response(JSON.stringify({ error: "Failed to create trainer" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const { error: updateError } = await supabase
    .from("trainer_invites")
    .update({ uses: invite.uses + 1 })
    .eq("id", invite.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: "Failed to update invite" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  return new Response(JSON.stringify({ status: "ok" }), {
    headers: jsonHeaders,
  });
});
