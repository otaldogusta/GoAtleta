// eslint-disable-next-line import/no-unresolved
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { getBearerToken } from "../_shared/middlewares/auth.ts";
import {
  DEFAULT_ACADEMIC_DRIVE_FOLDER_ID,
  parseGoogleDriveFolderId,
} from "../_shared/academic-knowledge.ts";
import {
  parseConfiguredDriveSourceProfiles,
  resolveAllowedDriveSource,
  resolveDriveSourceProfile,
  resolveExplicitClassBinding,
  type DriveAcademicScope,
  type DriveSourceProfile,
} from "../_shared/document-drive-source.ts";
import {
  GOOGLE_DRIVE_READONLY_SCOPE,
  createPkceChallenge,
  createPkceVerifier,
  encryptDriveRefreshToken,
  exchangeGoogleDriveAuthorizationCode,
  resolveSafeDriveReturnUrl,
} from "../_shared/google-drive-auth.ts";

type OAuthRequest = {
  action?: "start" | "status";
  organizationId?: string;
  folderUrl?: string;
  sourceProfile?: DriveSourceProfile;
  academicScope?: DriveAcademicScope;
  classId?: string;
  classBindingConfirmed?: boolean;
  redirectTo?: string;
};

const textValue = (value: unknown) => String(value ?? "").trim();
const jsonHeaders = { "Content-Type": "application/json" };

const withCors = (req: Request, response: Response) => {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(buildCorsHeaders(req))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const json = (req: Request, status: number, payload: unknown) =>
  withCors(
    req,
    new Response(JSON.stringify(payload), { status, headers: jsonHeaders }),
  );

const adminClient = () => {
  const url = textValue(Deno.env.get("SUPABASE_URL"));
  const key = textValue(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  if (!url || !key) throw new Error("supabase_not_configured");
  return createClient(url, key, { auth: { persistSession: false } });
};

const userClient = (token: string) => {
  const url = textValue(Deno.env.get("SUPABASE_URL"));
  const key = textValue(Deno.env.get("SUPABASE_ANON_KEY"));
  if (!url || !key) throw new Error("supabase_not_configured");
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

const configuredAcademicFolderIds = () =>
  textValue(Deno.env.get("ACADEMIC_DRIVE_ALLOWED_FOLDER_IDS"))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const resolveAllowedSource = (params: {
  folderId: string;
  requestedSourceProfile?: unknown;
  requestedAcademicScope?: unknown;
}) =>
  resolveAllowedDriveSource({
    ...params,
    defaultAcademicFolderId: DEFAULT_ACADEMIC_DRIVE_FOLDER_ID,
    configuredAcademicFolderIds: configuredAcademicFolderIds(),
    configuredProfiles: parseConfiguredDriveSourceProfiles(
      Deno.env.get("DOCUMENT_DRIVE_SOURCE_PROFILES"),
    ),
  });

const appendOAuthResult = (
  redirectTo: string,
  status: "connected" | "error",
  code?: string,
) => {
  const url = new URL(redirectTo);
  url.searchParams.set("drive", status);
  if (code) url.searchParams.set("drive_code", code);
  return url.toString();
};

const redirect = (location: string) =>
  new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });

const handleCallback = async (req: Request) => {
  const url = new URL(req.url);
  const stateValue = textValue(url.searchParams.get("state"));
  const authorizationCode = textValue(url.searchParams.get("code"));
  const oauthError = textValue(url.searchParams.get("error"));
  if (!stateValue) {
    return json(req, 400, {
      code: "OAUTH_STATE_MISSING",
      error: "Estado OAuth ausente.",
    });
  }

  const admin = adminClient();
  const { data: state, error: stateError } = await admin
    .from("google_drive_oauth_states")
    .select(
      "state,organization_id,user_id,code_verifier,redirect_to,expires_at,connection_scope,sync_root_folder_id,source_profile,academic_scope,bound_class_id,class_binding_confirmed",
    )
    .eq("state", stateValue)
    .maybeSingle();
  await admin.from("google_drive_oauth_states").delete().eq("state", stateValue);
  if (
    stateError ||
    !state ||
    new Date(textValue(state.expires_at)).getTime() <= Date.now()
  ) {
    return json(req, 400, {
      code: "OAUTH_STATE_INVALID",
      error: "Estado OAuth inválido ou expirado.",
    });
  }

  const redirectTo = textValue(state.redirect_to);
  if (oauthError || !authorizationCode) {
    return redirect(
      appendOAuthResult(
        redirectTo,
        "error",
        oauthError || "authorization_code_missing",
      ),
    );
  }

  try {
    const clientId = textValue(Deno.env.get("GOOGLE_DRIVE_CLIENT_ID"));
    const clientSecret = textValue(Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET"));
    const redirectUri = textValue(Deno.env.get("GOOGLE_DRIVE_REDIRECT_URI"));
    const encryptionSecret = textValue(
      Deno.env.get("DOCUMENT_TOKEN_ENCRYPTION_KEY"),
    );
    if (!clientId || !clientSecret || !redirectUri || !encryptionSecret) {
      throw new Error("google_oauth_not_configured");
    }

    const tokens = await exchangeGoogleDriveAuthorizationCode({
      code: authorizationCode,
      codeVerifier: textValue(state.code_verifier),
      clientId,
      clientSecret,
      redirectUri,
    });
    const { data: existingConnection } = await admin
      .from("google_drive_connections")
      .select(
        "id,refresh_token_secret_id,refresh_token_ciphertext,refresh_token_iv,token_updated_at",
      )
      .eq("organization_id", state.organization_id)
      .eq("user_id", state.user_id)
      .eq("connection_scope", state.connection_scope)
      .eq("sync_root_folder_id", state.sync_root_folder_id)
      .eq("source_profile", state.source_profile)
      .maybeSingle();

    let refreshTokenCiphertext = textValue(
      existingConnection?.refresh_token_ciphertext,
    );
    let refreshTokenIv = textValue(existingConnection?.refresh_token_iv);
    let refreshTokenSecretId = textValue(
      existingConnection?.refresh_token_secret_id,
    );
    let tokenUpdatedAt: string | null = null;
    if (tokens.refreshToken) {
      const encrypted = await encryptDriveRefreshToken(
        tokens.refreshToken,
        encryptionSecret,
      );
      refreshTokenCiphertext = encrypted.ciphertext;
      refreshTokenIv = encrypted.iv;
      refreshTokenSecretId = crypto.randomUUID();
      tokenUpdatedAt = new Date().toISOString();
    }
    if (!refreshTokenCiphertext || !refreshTokenIv) {
      throw new Error("google_oauth_refresh_token_missing");
    }

    let googleAccountEmail: string | null = null;
    try {
      const aboutResponse = await fetch(
        "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)",
        {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (aboutResponse.ok) {
        const about = (await aboutResponse.json()) as {
          user?: { emailAddress?: string };
        };
        googleAccountEmail = textValue(about.user?.emailAddress) || null;
      }
    } catch {
      googleAccountEmail = null;
    }

    const nowIso = new Date().toISOString();
    const boundClassId = textValue(state.bound_class_id) || null;
    const { error: connectionError } = await admin
      .from("google_drive_connections")
      .upsert(
        {
          organization_id: state.organization_id,
          user_id: state.user_id,
          connection_scope: state.connection_scope,
          sync_root_folder_id: state.sync_root_folder_id,
          source_profile: state.source_profile,
          bound_class_id: boundClassId,
          class_binding_confirmed_at: boundClassId ? nowIso : null,
          class_binding_confirmed_by: boundClassId ? state.user_id : null,
          refresh_token_secret_id: refreshTokenSecretId,
          refresh_token_ciphertext: refreshTokenCiphertext,
          refresh_token_iv: refreshTokenIv,
          scopes: tokens.scopes.length
            ? tokens.scopes
            : [GOOGLE_DRIVE_READONLY_SCOPE],
          google_account_email: googleAccountEmail,
          expires_at: tokens.expiresAt,
          auth_strategy: "oauth_user",
          token_updated_at:
            tokenUpdatedAt ??
            (textValue(existingConnection?.token_updated_at) || nowIso),
          sync_status: "idle",
          sync_error_code: null,
          sync_error_message: null,
          updated_at: nowIso,
        },
        {
          onConflict:
            "organization_id,user_id,connection_scope,sync_root_folder_id,source_profile",
        },
      );
    if (connectionError) throw new Error("google_oauth_connection_write_failed");

    return redirect(appendOAuthResult(redirectTo, "connected"));
  } catch (error) {
    const code =
      error instanceof Error
        ? error.message.slice(0, 80)
        : "google_oauth_callback_failed";
    return redirect(appendOAuthResult(redirectTo, "error", code));
  }
};

const handleAuthenticatedRequest = async (req: Request) => {
  const token = getBearerToken(req);
  if (!token) {
    return json(req, 401, { code: "UNAUTHORIZED", error: "Sessão inválida." });
  }
  const client = userClient(token);
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser(token);
  if (userError || !user) {
    return json(req, 401, { code: "UNAUTHORIZED", error: "Sessão inválida." });
  }

  let body: OAuthRequest;
  try {
    body = (await req.json()) as OAuthRequest;
  } catch {
    return json(req, 400, { code: "BAD_REQUEST", error: "JSON inválido." });
  }
  const organizationId = textValue(body.organizationId);
  if (!organizationId) {
    return json(req, 400, {
      code: "BAD_REQUEST",
      error: "organizationId é obrigatório.",
    });
  }

  let folderId: string;
  try {
    folderId = parseGoogleDriveFolderId(
      textValue(body.folderUrl) || DEFAULT_ACADEMIC_DRIVE_FOLDER_ID,
    );
  } catch (error) {
    return json(req, 400, {
      code: "BAD_REQUEST",
      error: error instanceof Error ? error.message : "Pasta inválida.",
    });
  }
  const allowedSource = resolveAllowedSource({
    folderId,
    requestedSourceProfile: body.sourceProfile,
    requestedAcademicScope: body.academicScope,
  });
  if (!allowedSource) {
    return json(req, 403, {
      code: "FOLDER_NOT_ALLOWED",
      error: "A pasta não está autorizada para conexão.",
    });
  }

  const policy = resolveDriveSourceProfile({
    sourceProfile: allowedSource.sourceProfile,
    academicScope: allowedSource.academicScope ?? undefined,
  });
  let classBinding: ReturnType<typeof resolveExplicitClassBinding>;
  try {
    classBinding = resolveExplicitClassBinding({
      policy,
      classId: body.classId,
      classBindingConfirmed: body.classBindingConfirmed,
    });
  } catch (error) {
    return json(req, 400, {
      code: "BAD_REQUEST",
      error: error instanceof Error ? error.message : "Vínculo inválido.",
    });
  }

  const admin = adminClient();
  const { data: membership } = await admin
    .from("organization_members")
    .select("role_level")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (Number(membership?.role_level ?? 0) < policy.minimumRoleLevel) {
    return json(req, 403, {
      code: "FORBIDDEN",
      error: "Usuário sem permissão para conectar esta fonte.",
    });
  }
  if (classBinding.classId) {
    const { data: sourceClass } = await admin
      .from("classes")
      .select("id")
      .eq("id", classBinding.classId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!sourceClass?.id) {
      return json(req, 400, {
        code: "CLASS_OUT_OF_SCOPE",
        error: "A turma não pertence ao workspace informado.",
      });
    }
  }

  if (body.action === "status") {
    const { data: connection } = await admin
      .from("google_drive_connections")
      .select(
        "id,auth_strategy,refresh_token_ciphertext,refresh_token_iv,google_account_email,token_updated_at,sync_status,sync_completed_at,sync_error_code",
      )
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("connection_scope", policy.connectionScope)
      .eq("sync_root_folder_id", folderId)
      .eq("source_profile", policy.sourceProfile)
      .maybeSingle();
    const hasOAuthCredential = Boolean(
      textValue(connection?.refresh_token_ciphertext) &&
        textValue(connection?.refresh_token_iv),
    );
    const configuredStrategy = allowedSource.authStrategy;
    const serviceAccountAvailable =
      (configuredStrategy === "auto" ||
        configuredStrategy === "service_account") &&
      Boolean(textValue(Deno.env.get("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON")));
    const apiKeyAvailable =
      (configuredStrategy === "auto" || configuredStrategy === "api_key") &&
      Boolean(textValue(Deno.env.get("GOOGLE_DRIVE_API_KEY")));
    const authStrategy = hasOAuthCredential
      ? "oauth_user"
      : serviceAccountAvailable
        ? "service_account"
        : apiKeyAvailable
          ? "api_key"
          : null;
    return json(req, 200, {
      status: authStrategy ? "connected" : "not_connected",
      connection: authStrategy
        ? {
            authStrategy,
            googleAccountEmail: connection?.google_account_email ?? null,
            tokenUpdatedAt: connection?.token_updated_at ?? null,
            syncStatus: connection?.sync_status ?? "idle",
            syncCompletedAt: connection?.sync_completed_at ?? null,
            syncErrorCode: connection?.sync_error_code ?? null,
          }
        : null,
    });
  }

  const clientId = textValue(Deno.env.get("GOOGLE_DRIVE_CLIENT_ID"));
  const redirectUri = textValue(Deno.env.get("GOOGLE_DRIVE_REDIRECT_URI"));
  if (!clientId || !redirectUri) {
    return json(req, 503, {
      code: "OAUTH_NOT_CONFIGURED",
      error: "OAuth do Google Drive ainda não foi configurado.",
    });
  }

  let redirectTo: string;
  try {
    redirectTo = resolveSafeDriveReturnUrl(
      textValue(body.redirectTo) || "https://go-atleta.vercel.app/profile",
      req.headers.get("origin"),
    );
  } catch {
    return json(req, 400, {
      code: "RETURN_URL_NOT_ALLOWED",
      error: "Destino de retorno não permitido.",
    });
  }

  const state = crypto.randomUUID();
  const codeVerifier = createPkceVerifier();
  const codeChallenge = await createPkceChallenge(codeVerifier);
  await admin
    .from("google_drive_oauth_states")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .lte("expires_at", new Date().toISOString());
  const { error: stateError } = await admin
    .from("google_drive_oauth_states")
    .insert({
      state,
      organization_id: organizationId,
      user_id: user.id,
      code_verifier: codeVerifier,
      redirect_to: redirectTo,
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      connection_scope: policy.connectionScope,
      sync_root_folder_id: folderId,
      source_profile: policy.sourceProfile,
      academic_scope: policy.academicScope,
      bound_class_id: classBinding.classId,
      class_binding_confirmed: Boolean(classBinding.classId),
    });
  if (stateError) {
    return json(req, 500, {
      code: "OAUTH_STATE_WRITE_FAILED",
      error: "Não foi possível iniciar a conexão com o Drive.",
    });
  }

  const authorizationUrl = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth",
  );
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_READONLY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();

  return json(req, 200, {
    status: "authorization_required",
    authorizationUrl: authorizationUrl.toString(),
    folderId,
    sourceProfile: policy.sourceProfile,
  });
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(req, new Response("ok", { status: 200 }));
  }
  const url = new URL(req.url);
  if (
    req.method === "GET" &&
    (url.searchParams.has("state") ||
      url.searchParams.has("code") ||
      url.searchParams.has("error"))
  ) {
    return handleCallback(req);
  }
  if (req.method !== "POST") {
    return json(req, 405, {
      code: "METHOD_NOT_ALLOWED",
      error: "Método não permitido.",
    });
  }
  return handleAuthenticatedRequest(req);
});
