import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validateObjectPayload,
  validateStringField,
} from "../_shared/input-validation.ts";
import { authorizeNotificationDelivery } from "../_shared/notification-authorization.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_PUSH_TOKENS_PER_USER = 8;
const EXPO_PUSH_TOKEN_PATTERN =
  /^(?:ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/;


const makeJsonHeaders = (request: Request) => ({ ...buildCorsHeaders(request), "Content-Type": "application/json" });

type SendPushPayload = {
  organizationId?: string;
  targetUserId?: string;
  notificationType?: string;
  sourceType?: string;
  notificationId?: string;
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

type StoredNotificationRow = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  recipient_user_id: string;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  source_type: string | null;
  source_id: string | null;
  metadata: Record<string, unknown> | null;
};

type PushDeliveryClaimRow = {
  delivery_id: string | null;
  claim_status: "claimed" | "duplicate" | "rate_limited";
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

const isValidExpoPushToken = (value: string) =>
  value.length <= 200 && EXPO_PUSH_TOKEN_PATTERN.test(value);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return corsPreflight(request);
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: makeJsonHeaders(request),
    });
  }

  const user = await requireUser(request);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: makeJsonHeaders(request),
    });
  }

  const payload = await parsePayload(request);
  if (!payload) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: makeJsonHeaders(request),
    });
  }

  const organizationValidation = validateStringField(payload.organizationId, {
    minLength: 1,
    maxLength: 128,
  });
  if (!organizationValidation.ok) {
    return new Response(JSON.stringify({ error: `Invalid organizationId: ${organizationValidation.error}` }), {
      status: 400,
      headers: makeJsonHeaders(request),
    });
  }

  const targetUserValidation = validateStringField(payload.targetUserId, {
    minLength: 1,
    maxLength: 128,
  });
  if (!targetUserValidation.ok) {
    return new Response(JSON.stringify({ error: `Invalid targetUserId: ${targetUserValidation.error}` }), {
      status: 400,
      headers: makeJsonHeaders(request),
    });
  }

  const notificationTypeValidation = validateStringField(
    payload.notificationType ?? "generic",
    {
      minLength: 1,
      maxLength: 64,
    },
  );
  if (!notificationTypeValidation.ok) {
    return new Response(
      JSON.stringify({
        error: `Invalid notificationType: ${notificationTypeValidation.error}`,
      }),
      { status: 400, headers: makeJsonHeaders(request) },
    );
  }

  const sourceTypeValidation = validateStringField(payload.sourceType ?? "", {
    maxLength: 80,
  });
  if (!sourceTypeValidation.ok) {
    return new Response(
      JSON.stringify({ error: `Invalid sourceType: ${sourceTypeValidation.error}` }),
      { status: 400, headers: makeJsonHeaders(request) },
    );
  }

  const notificationIdValidation = validateStringField(
    payload.notificationId ?? "",
    { maxLength: 128 },
  );
  if (!notificationIdValidation.ok) {
    return new Response(
      JSON.stringify({
        error: `Invalid notificationId: ${notificationIdValidation.error}`,
      }),
      { status: 400, headers: makeJsonHeaders(request) },
    );
  }

  const organizationId = organizationValidation.data;
  const targetUserId = targetUserValidation.data;
  const notificationType = notificationTypeValidation.data;
  const sourceType = sourceTypeValidation.data;
  const notificationId = notificationIdValidation.data;

  const supabase = createServiceClient();
  if (!supabase) {
    return new Response(JSON.stringify({ error: "Missing service role configuration." }), {
      status: 500,
      headers: makeJsonHeaders(request),
    });
  }

  let authorization;
  try {
    authorization = await authorizeNotificationDelivery({
      supabase,
      organizationId,
      senderUserId: user.id,
      recipientUserId: targetUserId,
      notificationType,
      sourceType,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Push authorization failed.",
      }),
      { status: 500, headers: makeJsonHeaders(request) },
    );
  }

  if (!authorization.allowed) {
    const targetMissing = authorization.reason === "recipient_not_linked";
    return new Response(
      JSON.stringify({
        error: targetMissing
          ? "Target user is not linked to organization."
          : "Forbidden",
      }),
      {
        status: targetMissing ? 404 : 403,
        headers: makeJsonHeaders(request),
      },
    );
  }

  if (!authorization.mode) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: makeJsonHeaders(request),
    });
  }

  let deliveryTitle: string;
  let deliveryBody: string;
  let deliveryData: Record<string, unknown> | null;

  if (authorization.mode === "admin") {
    const titleValidation = validateStringField(payload.title, {
      minLength: 1,
      maxLength: 120,
    });
    if (!titleValidation.ok) {
      return new Response(
        JSON.stringify({ error: `Invalid title: ${titleValidation.error}` }),
        { status: 400, headers: makeJsonHeaders(request) },
      );
    }

    const bodyValidation = validateStringField(payload.body, {
      minLength: 1,
      maxLength: 500,
    });
    if (!bodyValidation.ok) {
      return new Response(
        JSON.stringify({ error: `Invalid body: ${bodyValidation.error}` }),
        { status: 400, headers: makeJsonHeaders(request) },
      );
    }

    const dataValidation = validateObjectPayload(payload.data, {
      maxBytes: 4096,
    });
    if (!dataValidation.ok) {
      return new Response(
        JSON.stringify({
          error: `Invalid data payload: ${dataValidation.error}`,
        }),
        { status: 400, headers: makeJsonHeaders(request) },
      );
    }

    deliveryTitle = titleValidation.data;
    deliveryBody = bodyValidation.data;
    deliveryData = dataValidation.data;
  } else {
    if (!notificationId) {
      return new Response(
        JSON.stringify({
          error: "notificationId is required for non-admin push delivery.",
        }),
        { status: 400, headers: makeJsonHeaders(request) },
      );
    }

    const { data: storedNotification, error: storedNotificationError } =
      await supabase
        .from("notifications")
        .select(
          "id,organization_id,actor_user_id,recipient_user_id,type,title,body,action_url,source_type,source_id,metadata",
        )
        .eq("id", notificationId)
        .eq("organization_id", organizationId)
        .maybeSingle<StoredNotificationRow>();

    if (storedNotificationError) {
      return new Response(
        JSON.stringify({ error: storedNotificationError.message }),
        { status: 500, headers: makeJsonHeaders(request) },
      );
    }

    const storedSourceType = String(
      storedNotification?.source_type ?? "",
    ).trim();
    const notificationMatchesDelivery = Boolean(
      storedNotification &&
        storedNotification.organization_id === organizationId &&
        storedNotification.actor_user_id === user.id &&
        storedNotification.recipient_user_id === targetUserId &&
        storedNotification.type === notificationType &&
        storedSourceType === sourceType,
    );

    if (!storedNotification || !notificationMatchesDelivery) {
      return new Response(
        JSON.stringify({ error: "Notification is not authorized for delivery." }),
        { status: 403, headers: makeJsonHeaders(request) },
      );
    }

    const storedTitleValidation = validateStringField(
      storedNotification.title,
      { minLength: 1, maxLength: 120 },
    );
    const storedBodyValidation = validateStringField(storedNotification.body, {
      minLength: 1,
      maxLength: 500,
    });
    const storedMetadataValidation = validateObjectPayload(
      storedNotification.metadata ?? {},
      { maxBytes: 4096 },
    );
    if (
      !storedTitleValidation.ok ||
      !storedBodyValidation.ok ||
      !storedMetadataValidation.ok ||
      !storedMetadataValidation.data
    ) {
      return new Response(
        JSON.stringify({ error: "Stored notification content is invalid." }),
        { status: 500, headers: makeJsonHeaders(request) },
      );
    }

    const canonicalParams = {
      ...storedMetadataValidation.data,
      ...(storedNotification.source_type
        ? { sourceType: storedNotification.source_type }
        : {}),
      ...(storedNotification.source_id
        ? { sourceId: storedNotification.source_id }
        : {}),
    };
    const canonicalDataValidation = validateObjectPayload(
      {
        notificationId: storedNotification.id,
        type: storedNotification.type,
        route: storedNotification.action_url ?? "/communications",
        ...(Object.keys(canonicalParams).length
          ? { params: canonicalParams }
          : {}),
      },
      { maxBytes: 4096 },
    );
    if (!canonicalDataValidation.ok || !canonicalDataValidation.data) {
      return new Response(
        JSON.stringify({ error: "Stored notification data is invalid." }),
        { status: 500, headers: makeJsonHeaders(request) },
      );
    }

    deliveryTitle = storedTitleValidation.data;
    deliveryBody = storedBodyValidation.data;
    deliveryData = canonicalDataValidation.data;
  }

  // Claim a persisted notification id before contacting Expo so retries and
  // concurrent replays fail closed. Legacy admin sends without an inbox row
  // remain supported and are bounded by the server-side sender rate limit.
  const replayGuardNotificationId = notificationId || null;
  const { data: deliveryClaim, error: deliveryClaimError } = await supabase
    .rpc("claim_push_delivery", {
      p_organization_id: organizationId,
      p_from_user_id: user.id,
      p_to_user_id: targetUserId,
      p_notification_id: replayGuardNotificationId,
      p_title: deliveryTitle,
      p_body: deliveryBody,
      p_data: deliveryData,
    })
    .single<PushDeliveryClaimRow>();

  if (deliveryClaimError) {
    return new Response(
      JSON.stringify({ error: "Unable to claim push delivery." }),
      { status: 500, headers: makeJsonHeaders(request) },
    );
  }

  if (deliveryClaim.claim_status === "duplicate") {
    return new Response(
      JSON.stringify({
        error: "Notification push delivery was already attempted.",
      }),
      { status: 409, headers: makeJsonHeaders(request) },
    );
  }

  if (deliveryClaim.claim_status === "rate_limited") {
    return new Response(
      JSON.stringify({
        error: "Push delivery rate limit exceeded. Try again shortly.",
      }),
      { status: 429, headers: makeJsonHeaders(request) },
    );
  }

  const deliveryId = String(deliveryClaim.delivery_id ?? "").trim();
  if (!deliveryId) {
    return new Response(
      JSON.stringify({ error: "Unable to claim push delivery." }),
      { status: 500, headers: makeJsonHeaders(request) },
    );
  }

  const { data: tokenRows, error: tokensError } = await supabase
    .from("push_tokens")
    .select("expo_push_token")
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId)
    .order("updated_at", { ascending: false })
    .limit(MAX_PUSH_TOKENS_PER_USER);
  if (tokensError) {
    await supabase
      .from("push_deliveries")
      .update({ provider_response: { reason: "token_lookup_failed" } })
      .eq("id", deliveryId);

    return new Response(JSON.stringify({ error: "Unable to load push recipients." }), {
      status: 500,
      headers: makeJsonHeaders(request),
    });
  }

  const tokens = Array.from(
    new Set(
      (tokenRows ?? [])
        .map((row) => String(row.expo_push_token ?? "").trim())
        .filter(isValidExpoPushToken),
    ),
  );

  if (!tokens.length) {
    await supabase
      .from("push_deliveries")
      .update({
        status: "error",
        provider_response: { reason: "no_tokens" },
      })
      .eq("id", deliveryId);

    return new Response(
      JSON.stringify({
        status: "error",
        sent: 0,
        failed: 1,
        invalidTokens: 0,
      }),
      { status: 200, headers: makeJsonHeaders(request) }
    );
  }

  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title: deliveryTitle,
    body: deliveryBody,
    data: deliveryData ?? undefined,
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

  await supabase
    .from("push_deliveries")
    .update({
      status,
      provider_response: {
        sent,
        failed,
        invalidTokens: invalidTokens.length,
        tickets: allTickets,
      },
    })
    .eq("id", deliveryId);

  return new Response(
    JSON.stringify({
      status,
      sent,
      failed,
      invalidTokens: invalidTokens.length,
    }),
    {
      status: 200,
      headers: makeJsonHeaders(request),
    }
  );
});
