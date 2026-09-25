import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { validateStringField } from "../_shared/input-validation.ts";
import { hasTrustedInviteIdentity } from "../_shared/invite-email-verification.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const DEFAULT_PLATFORM_ALERT_EMAIL = "uniquexperieence@gmail.com";
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

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );

const sendPlatformAccessAlert = async ({
  organizationName,
  requesterEmail,
  requesterName,
  requestedProduct,
}: {
  organizationName: string;
  requesterEmail: string;
  requesterName: string;
  requestedProduct: "goatleta" | "goatleta_pro";
}) => {
  const apiKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  if (!apiKey) return false;

  const recipient =
    (Deno.env.get("PLATFORM_ALERT_EMAIL") ?? "").trim().toLowerCase() ||
    DEFAULT_PLATFORM_ALERT_EMAIL;
  const from =
    (Deno.env.get("INVITE_EMAIL_FROM") ?? "").trim() ||
    "Go Atleta <nao-responda@auth.goatleta.com>";
  const productLabel =
    requestedProduct === "goatleta_pro" ? "GoAtleta Pro" : "GoAtleta";

  try {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `Nova solicitação no Go Atleta — ${organizationName}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#102038">
            <h1 style="font-size:22px">Nova solicitação de acesso</h1>
            <p><strong>Instituição:</strong> ${escapeHtml(organizationName)}</p>
            <p><strong>Responsável:</strong> ${escapeHtml(requesterName)}</p>
            <p><strong>E-mail:</strong> ${escapeHtml(requesterEmail)}</p>
            <p><strong>Produto:</strong> ${escapeHtml(productLabel)}</p>
            <p><a href="https://goatleta.com/platform/accesses" style="display:inline-block;padding:12px 18px;background:#41d984;color:#07111f;text-decoration:none;border-radius:8px;font-weight:700">Abrir painel SaaS</a></p>
          </div>
        `,
      }),
    });
    return emailResponse.ok;
  } catch {
    return false;
  }
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
    organizationId?: string;
    requestedProduct?: "goatleta" | "goatleta_pro";
  } | null;
  const organizationId = String(body?.organizationId ?? "").trim();
  const requestedProduct = body?.requestedProduct === "goatleta_pro"
    ? "goatleta_pro"
    : "goatleta";
  let coordinatorMemberships: Array<{
    organization_id: string;
    coordinator_user_id: string;
  }> = [];

  if (organizationId) {
    const { data: organization, error: organizationError } = await service
      .from("organizations")
      .select("id,name")
      .eq("id", organizationId)
      .maybeSingle();
    if (organizationError || !organization) {
      return response(request, 404, { error: "Instituição não encontrada." });
    }
    const { data: coordinators, error: coordinatorsError } = await service
      .from("organization_members")
      .select("organization_id,user_id")
      .eq("organization_id", organizationId)
      .gte("role_level", 50);
    if (coordinatorsError) {
      return response(request, 500, { error: "Falha ao localizar a coordenação." });
    }
    coordinatorMemberships = (coordinators ?? []).map((membership) => ({
      organization_id: String(membership.organization_id),
      coordinator_user_id: String(membership.user_id),
    }));
    if (!coordinatorMemberships.length) {
      // The platform queue must still receive the request while an institution
      // is waiting for its first coordinator to be provisioned.
      coordinatorMemberships = [{
        organization_id: organizationId,
        coordinator_user_id: "",
      }];
    }
  } else {
    const emailValidation = validateStringField(body?.coordinatorEmail, {
      minLength: 3,
      maxLength: 254,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    });
    if (!emailValidation.ok) {
      return response(request, 400, { error: "Escolha uma instituição." });
    }
    const coordinatorEmail = emailValidation.data.trim().toLowerCase();
    const { data, error: coordinatorError } =
      await service.rpc("resolve_access_request_coordinator", {
        p_email: coordinatorEmail,
      });
    if (coordinatorError) {
      return response(request, 500, { error: "Falha ao localizar a coordenação." });
    }
    coordinatorMemberships = data ?? [];
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
  const alertedRequestIds = new Set<string>();

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
    let createdNewRequest = false;
    if (!accessRequestId) {
      const { data: createdRequest, error: requestInsertError } = await service
        .from("organization_access_requests")
        .insert({
          organization_id: organizationId,
          requester_user_id: authData.user.id,
          requester_email: requesterEmail,
          requester_name: requesterName,
          requested_product: requestedProduct,
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
        createdNewRequest = true;
      }
    }

    if (createdNewRequest && !alertedRequestIds.has(accessRequestId)) {
      alertedRequestIds.add(accessRequestId);
      const { data: organization } = await service
        .from("organizations")
        .select("name")
        .eq("id", organizationId)
        .maybeSingle();
      await sendPlatformAccessAlert({
        organizationName: String(organization?.name ?? "Instituição"),
        requesterEmail,
        requesterName,
        requestedProduct,
      });
    }

    if (!coordinatorUserId) continue;
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
  return response(request, 200, {
    accepted: true,
    status: "pending",
    organizationId: organizationId || null,
  });
});
