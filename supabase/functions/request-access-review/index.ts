import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { validateStringField } from "../_shared/input-validation.ts";

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
  const { data: coordinator, error: coordinatorError } =
    await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (coordinatorError) {
    return response(request, 500, { error: "Falha ao localizar a coordenação." });
  }

  const coordinatorUser = coordinator.users.find(
    (candidate) => candidate.email?.trim().toLowerCase() === coordinatorEmail
  );

  // Avoid exposing whether an email has an account or administrative access.
  if (!coordinatorUser) {
    return response(request, 200, { accepted: true });
  }

  const { data: memberships, error: membershipsError } = await service
    .from("organization_members")
    .select("organization_id,user_id,role_level")
    .eq("user_id", coordinatorUser.id)
    .gte("role_level", 50);
  if (membershipsError) {
    return response(request, 500, { error: "Falha ao localizar a coordenação." });
  }
  if (!memberships?.length) {
    return response(request, 200, { accepted: true });
  }

  const requesterEmail = authData.user.email?.trim().toLowerCase() || "E-mail não informado";
  const requesterName =
    String(authData.user.user_metadata?.full_name ?? "").trim() ||
    requesterEmail.split("@")[0] ||
    "Novo usuário";
  const title = "Nova solicitação de acesso";
  const bodyText = `${requesterName} (${requesterEmail}) aguarda definição de função.`;

  let createdCount = 0;
  for (const membership of memberships.slice(0, 20)) {
    const organizationId = String(membership.organization_id);
    const { data: existing } = await service
      .from("notifications")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("recipient_user_id", coordinatorUser.id)
      .eq("source_type", "access_request")
      .eq("source_id", authData.user.id)
      .is("read_at", null)
      .maybeSingle();

    if (existing) continue;

    const actionUrl = `/org-members?releaseEmail=${encodeURIComponent(
      requesterEmail
    )}`;
    const { error: insertError } = await service.from("notifications").insert({
      organization_id: organizationId,
      recipient_user_id: coordinatorUser.id,
      actor_user_id: authData.user.id,
      type: "generic",
      title,
      body: bodyText,
      action_url: actionUrl,
      source_type: "access_request",
      source_id: authData.user.id,
      metadata: {
        requesterEmail,
        requesterName,
        requestedOrganizationId: organizationId,
      },
    });
    if (insertError) continue;
    createdCount += 1;

    const { data: tokenRows } = await service
      .from("push_tokens")
      .select("expo_push_token")
      .eq("organization_id", organizationId)
      .eq("user_id", coordinatorUser.id);
    const messages = (tokenRows ?? [])
      .map((row) => String(row.expo_push_token ?? "").trim())
      .filter(Boolean)
      .map((to) => ({
        to,
        sound: "default",
        title,
        body: bodyText,
        data: {
          route: "/prof/absence-notices",
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

  return response(request, 200, { accepted: true, created: createdCount });
});
