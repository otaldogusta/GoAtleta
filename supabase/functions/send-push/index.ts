import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validateObjectPayload,
  validateStringField,
} from "../_shared/input-validation.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

type SendPushPayload = {
  organizationId?: string;
  targetUserId?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown> | null;
};

type ExpoTicket = {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string } & Record<string, unknown>;
};

const createAnonClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { persistSession: false } });
};

const createServiceClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
};

const requireUser = async (request: Request) => {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;
  const supabase = createAnonClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
};

const parsePayload = async (request: Request): Promise<SendPushPayload | null> => {
  try {
    return (await request.json()) as SendPushPayload;
  } catch {
    return null;
  }
};

const splitChunks = <T>(list: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
};

const toExpoTickets = (payload: unknown): ExpoTicket[] => {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (Array.isArray(data)) return data as ExpoTicket[];
  if (data && typeof data === "object") return [data as ExpoTicket];
  return [];
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  const user = await requireUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const payload = await parsePayload(request);
  if (!payload) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const organizationValidation = validateStringField(payload.organizationId, {
    minLength: 1,
    maxLength: 128,
  });
  if (!organizationValidation.ok) {
    return new Response(JSON.stringify({ error: `Invalid organizationId: ${organizationValidation.error}` }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const targetUserValidation = validateStringField(payload.targetUserId, {
    minLength: 1,
    maxLength: 128,
  });
  if (!targetUserValidation.ok) {
    return new Response(JSON.stringify({ error: `Invalid targetUserId: ${targetUserValidation.error}` }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const titleValidation = validateStringField(payload.title, {
    minLength: 1,
    maxLength: 120,
  });
  if (!titleValidation.ok) {
    return new Response(JSON.stringify({ error: `Invalid title: ${titleValidation.error}` }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const bodyValidation = validateStringField(payload.body, {
    minLength: 1,
    maxLength: 500,
  });
  if (!bodyValidation.ok) {
    return new Response(JSON.stringify({ error: `Invalid body: ${bodyValidation.error}` }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const dataValidation = validateObjectPayload(payload.data, { maxBytes: 4096 });
  if (!dataValidation.ok) {
    return new Response(JSON.stringify({ error: `Invalid data payload: ${dataValidation.error}` }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const organizationId = organizationValidation.data;
  const targetUserId = targetUserValidation.data;
  const title = titleValidation.data;
  const body = bodyValidation.data;
  const data = dataValidation.data;

  const supabase = createServiceClient();
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Missing service role configuration." }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const { data: senderMembership, error: senderError } = await supabase
    .from("organization_members")
    .select("role_level")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (senderError) {
    return new Response(JSON.stringify({ error: senderError.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
  const senderRoleLevel = Number(senderMembership?.role_level ?? 0);
  if (!senderMembership || !Number.isFinite(senderRoleLevel) || senderRoleLevel < 50) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: jsonHeaders,
    });
  }

  const { data: targetMembership, error: targetError } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (targetError) {
    return new Response(JSON.stringify({ error: targetError.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
  if (!targetMembership) {
    return new Response(JSON.stringify({ error: "Target user is not a member of organization." }), {
      status: 404,
      headers: jsonHeaders,
    });
  }

  const { data: tokenRows, error: tokensError } = await supabase
    .from("push_tokens")
    .select("expo_push_token")
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId);
  if (tokensError) {
    return new Response(JSON.stringify({ error: tokensError.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  const tokens = (tokenRows ?? [])
    .map((row) => String(row.expo_push_token ?? "").trim())
    .filter(Boolean);

  if (!tokens.length) {
    await supabase.from("push_deliveries").insert({
      organization_id: organizationId,
      from_user_id: user.id,
      to_user_id: targetUserId,
      title,
      body,
      data,
      status: "error",
      provider_response: { reason: "no_tokens" },
    });

    return new Response(
      JSON.stringify({
        status: "error",
        sent: 0,
        failed: 1,
        invalidTokens: 0,
      }),
      { status: 200, headers: jsonHeaders }
    );
  }

  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title,
    body,
    data: data ?? undefined,
  }));

  const chunks = splitChunks(messages, 100);
  const allTickets: ExpoTicket[] = [];
  const invalidTokenSet = new Set<string>();
  let failed = 0;
  let sent = 0;

  for (const chunk of chunks) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });

    if (!response.ok) {
      failed += chunk.length;
      for (let index = 0; index < chunk.length; index += 1) {
        allTickets.push({
          status: "error",
          message: `expo_http_${response.status}`,
        });
      }
      continue;
    }

    const payloadJson = await response.json().catch(() => null);
    const tickets = toExpoTickets(payloadJson);

    for (let index = 0; index < chunk.length; index += 1) {
      const ticket = tickets[index] ?? {
        status: "error",
        message: "missing_expo_ticket",
      };
      allTickets.push(ticket);

      if (ticket.status === "ok") {
        sent += 1;
        continue;
      }

      failed += 1;
      if (ticket.details?.error === "DeviceNotRegistered") {
        const invalidToken = chunk[index]?.to;
        if (typeof invalidToken === "string" && invalidToken.trim()) {
          invalidTokenSet.add(invalidToken);
        }
      }
    }
  }

  const invalidTokens = Array.from(invalidTokenSet);
  if (invalidTokens.length) {
    await supabase
      .from("push_tokens")
      .delete()
      .eq("organization_id", organizationId)
      .in("expo_push_token", invalidTokens);
  }

  const status: "ok" | "partial" | "error" =
    sent > 0 && failed === 0 ? "ok" : sent > 0 ? "partial" : "error";

  await supabase.from("push_deliveries").insert({
    organization_id: organizationId,
    from_user_id: user.id,
    to_user_id: targetUserId,
    title,
    body,
    data,
    status,
    provider_response: {
      sent,
      failed,
      invalidTokens: invalidTokens.length,
      tickets: allTickets,
    },
  });

  return new Response(
    JSON.stringify({
      status,
      sent,
      failed,
      invalidTokens: invalidTokens.length,
    }),
    {
      status: 200,
      headers: jsonHeaders,
    }
  );
});

