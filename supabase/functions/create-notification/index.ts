import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validateObjectPayload,
  validateStringField,
} from "../_shared/input-validation.ts";


const makeJsonHeaders = (req: Request) => ({ ...buildCorsHeaders(req), "Content-Type": "application/json" });

const notificationTypes = new Set([
  "training_created",
  "training_saved",
  "birthday",
  "consultation_event",
  "absence_notice_created",
  "absence_notice_status_changed",
  "regulation_updated",
  "generic",
]);

type CreateNotificationPayload = {
  organizationId?: string;
  recipientUserId?: string;
  actorUserId?: string | null;
  type?: string;
  title?: string;
  body?: string;
  actionUrl?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown> | null;
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

const parsePayload = async (request: Request): Promise<CreateNotificationPayload | null> => {
  try {
    return (await request.json()) as CreateNotificationPayload;
  } catch {
    return null;
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return corsPreflight(req);
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: makeJsonHeaders(req),
    });
  }

  const user = await requireUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: makeJsonHeaders(req),
    });
  }

  const payload = await parsePayload(request);
  if (!payload) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: makeJsonHeaders(req),
    });
  }

  const organizationValidation = validateStringField(payload.organizationId, {
    minLength: 1,
    maxLength: 128,
  });
  const recipientValidation = validateStringField(payload.recipientUserId, {
    minLength: 1,
    maxLength: 128,
  });
  const titleValidation = validateStringField(payload.title, {
    minLength: 1,
    maxLength: 120,
  });
  const bodyValidation = validateStringField(payload.body, {
    minLength: 1,
    maxLength: 500,
  });
  const typeValidation = validateStringField(payload.type ?? "generic", {
    minLength: 1,
    maxLength: 64,
  });
  const actionUrlValidation = validateStringField(payload.actionUrl ?? "", {
    maxLength: 240,
  });
  const sourceTypeValidation = validateStringField(payload.sourceType ?? "", {
    maxLength: 80,
  });
  const sourceIdValidation = validateStringField(payload.sourceId ?? "", {
    maxLength: 160,
  });
  const metadataValidation = validateObjectPayload(payload.metadata, { maxBytes: 4096 });

  const validations = [
    ["organizationId", organizationValidation],
    ["recipientUserId", recipientValidation],
    ["title", titleValidation],
    ["body", bodyValidation],
    ["type", typeValidation],
    ["actionUrl", actionUrlValidation],
    ["sourceType", sourceTypeValidation],
    ["sourceId", sourceIdValidation],
    ["metadata", metadataValidation],
  ] as const;
  const failed = validations.find(([, result]) => !result.ok);
  if (failed) {
    return new Response(JSON.stringify({ error: `Invalid ${failed[0]}: ${failed[1].error}` }), {
      status: 400,
      headers: makeJsonHeaders(req),
    });
  }
  if (!notificationTypes.has(typeValidation.data)) {
    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
      headers: makeJsonHeaders(req),
    });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Missing service role configuration." }), {
      status: 500,
      headers: makeJsonHeaders(req),
    });
  }

  const organizationId = organizationValidation.data;
  const recipientUserId = recipientValidation.data;

  const { data: senderMembership, error: senderError } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (senderError) {
    return new Response(JSON.stringify({ error: senderError.message }), {
      status: 500,
      headers: makeJsonHeaders(req),
    });
  }
  if (!senderMembership) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: makeJsonHeaders(req),
    });
  }

  const { data: recipientMembership, error: recipientError } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", recipientUserId)
    .maybeSingle();
  if (recipientError) {
    return new Response(JSON.stringify({ error: recipientError.message }), {
      status: 500,
      headers: makeJsonHeaders(req),
    });
  }
  if (!recipientMembership) {
    return new Response(JSON.stringify({ error: "Recipient is not a member of organization." }), {
      status: 404,
      headers: makeJsonHeaders(req),
    });
  }

  const { data: notification, error: insertError } = await supabase
    .from("notifications")
    .insert({
      organization_id: organizationId,
      recipient_user_id: recipientUserId,
      actor_user_id: user.id,
      type: typeValidation.data,
      title: titleValidation.data,
      body: bodyValidation.data,
      action_url: actionUrlValidation.data || null,
      source_type: sourceTypeValidation.data || null,
      source_id: sourceIdValidation.data || null,
      metadata: metadataValidation.data ?? {},
    })
    .select(
      "id,organization_id,recipient_user_id,actor_user_id,type,title,body,action_url,source_type,source_id,metadata,read_at,created_at"
    )
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: makeJsonHeaders(req),
    });
  }

  return new Response(JSON.stringify({ notification }), {
    status: 200,
    headers: makeJsonHeaders(req),
  });
});
