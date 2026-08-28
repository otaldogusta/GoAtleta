import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { validateStringField } from "../_shared/input-validation.ts";
import { hasTrustedInviteIdentity } from "../_shared/invite-email-verification.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const makeHeaders = (request: Request) => ({
  ...buildCorsHeaders(request),
  "Content-Type": "application/json",
});

const response = (
  request: Request,
  status: number,
  payload: Record<string, unknown>
) => new Response(JSON.stringify(payload), { status, headers: makeHeaders(request) });

const createAnonClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  return url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;
};

const createServiceClient = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return corsPreflight(request);
  if (request.method !== "POST") {
    return response(request, 405, { error: "Method not allowed" });
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const anon = createAnonClient();
  const service = createServiceClient();
  if (!accessToken || !anon || !service) {
    return response(request, 401, { error: "Unauthorized" });
  }

  const { data: authData, error: authError } = await anon.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return response(request, 401, { error: "Unauthorized" });
  }
  if (!hasTrustedInviteIdentity(authData.user)) {
    return response(request, 403, {
      code: "EMAIL_NOT_VERIFIED",
      error: "Confirme seu e-mail antes de solicitar acesso.",
    });
  }

  const body = await request.json().catch(() => null) as {
    coordinatorEmail?: string;
  } | null;
  const emailValidation = validateStringField(body?.coordinatorEmail, {
    minLength: 3,
    maxLength: 254,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  });
  if (!emailValidation.ok) {
    return response(request, 400, { error: "Informe o e-mail da coordenação." });
  }

  const coordinatorEmail = emailValidation.data.trim().toLowerCase();
  const { data: coordinatorMemberships, error: coordinatorError } =
    await service.rpc("resolve_access_request_coordinator", {
      p_email: coordinatorEmail,
    });
  if (coordinatorError) {
    return response(request, 500, { error: "Falha ao localizar a coordenação." });
  }

  // Avoid exposing whether an email has an account or administrative access.
  if (!coordinatorMemberships?.length) {
    return response(request, 200, { accepted: true });
  }

  const requesterEmail = authData.user.email?.trim().toLowerCase() || "E-mail não informado";
  const requesterName =
    String(authData.user.user_metadata?.full_name ?? "").trim() ||
    requesterEmail.split("@")[0] ||
    "Novo usuário";
  const title = "Nova solicitação de acesso";
  const bodyText = `${requesterName} (${requesterEmail}) aguarda definição de função.`;

  for (const membership of coordinatorMemberships) {
    const organizationId = String(membership.organization_id);
    const coordinatorUserId = String(membership.coordinator_user_id);
    const { data: existingRequest, error: existingRequestError } = await service
      .from("organization_access_requests")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("requester_user_id", authData.user.id)
      .eq("status", "pending")
      .maybeSingle();
    if (existingRequestError) {
      return response(request, 500, {
        error: "Não foi possível registrar a solicitação de acesso.",
      });
    }

    let accessRequestId = String(existingRequest?.id ?? "");
    if (!accessRequestId) {
      const { data: createdRequest, error: requestInsertError } = await service
        .from("organization_access_requests")
        .insert({
          organization_id: organizationId,
          requester_user_id: authData.user.id,
          requester_email: requesterEmail,
          requester_name: requesterName,
        })
        .select("id")
        .single();
      if (requestInsertError || !createdRequest?.id) {
        if (requestInsertError?.code === "23505") {
          const { data: concurrentRequest } = await service
            .from("organization_access_requests")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("requester_user_id", authData.user.id)
            .eq("status", "pending")
            .maybeSingle();
          accessRequestId = String(concurrentRequest?.id ?? "");
        }
        if (!accessRequestId) {
          return response(request, 500, {
            error: "Não foi possível registrar a solicitação de acesso.",
          });
        }
      } else {
        accessRequestId = String(createdRequest.id);
      }
    }

    const { data: existing } = await service
      .from("notifications")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("recipient_user_id", coordinatorUserId)
      .eq("inbox_scope", "coord")
      .eq("source_type", "access_request")
      .eq("source_id", accessRequestId)
      .maybeSingle();

    if (existing) continue;

    const actionUrl = `/coord/management?accessRequestId=${encodeURIComponent(
      accessRequestId
    )}`;
    const { error: insertError } = await service.from("notifications").insert({
      organization_id: organizationId,
      recipient_user_id: coordinatorUserId,
      inbox_scope: "coord",
      actor_user_id: authData.user.id,
      type: "generic",
      title,
      body: bodyText,
      action_url: actionUrl,
      source_type: "access_request",
      source_id: accessRequestId,
      metadata: {
        accessRequestId,
        requesterEmail,
        requesterName,
        requestedOrganizationId: organizationId,
      },
    });
    if (insertError) continue;
    const { data: tokenRows } = await service
      .from("push_tokens")
      .select("expo_push_token")
      .eq("organization_id", organizationId)
      .eq("user_id", coordinatorUserId);
    const messages = (tokenRows ?? [])
      .map((row) => String(row.expo_push_token ?? "").trim())
      .filter(Boolean)
      .map((to) => ({
        to,
        sound: "default",
        title,
        body: bodyText,
        data: {
          route: "/coord/management",
          sourceType: "access_request",
          actionUrl,
        },
      }));

    if (messages.length) {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      }).catch(() => null);
    }
  }

  // Keep the public response identical whether or not the supplied address
  // belongs to a coordinator. Delivery details remain server-side only.
  return response(request, 200, { accepted: true });
});
