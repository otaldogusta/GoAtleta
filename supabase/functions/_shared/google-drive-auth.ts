import type { DriveAuthStrategy } from "./document-drive-source.ts";

export const GOOGLE_DRIVE_READONLY_SCOPE =
  "https://www.googleapis.com/auth/drive.readonly";

export type StoredDriveOAuthCredential = {
  refreshTokenCiphertext?: string | null;
  refreshTokenIv?: string | null;
};

export type GoogleDriveCredential = {
  strategy: Exclude<DriveAuthStrategy, "auto">;
  apiKey: string | null;
  accessToken: string | null;
  expiresAt: string | null;
};

type GoogleServiceAccount = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

const textValue = (value: unknown) => String(value ?? "").trim();

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64ToBytes = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const base64Url = (bytes: Uint8Array) =>
  bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const jsonBase64Url = (value: unknown) =>
  base64Url(new TextEncoder().encode(JSON.stringify(value)));

const deriveEncryptionKey = async (secret: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
};

export async function encryptDriveRefreshToken(
  refreshToken: string,
  secret: string,
) {
  if (!textValue(refreshToken) || textValue(secret).length < 32) {
    throw new Error("drive_token_encryption_not_configured");
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(secret);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(refreshToken),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptDriveRefreshToken(
  ciphertext: string,
  iv: string,
  secret: string,
) {
  if (
    !textValue(ciphertext) ||
    !textValue(iv) ||
    textValue(secret).length < 32
  ) {
    throw new Error("drive_token_unavailable");
  }
  const key = await deriveEncryptionKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

export const createPkceVerifier = () =>
  base64Url(crypto.getRandomValues(new Uint8Array(48)));

export const createPkceChallenge = async (verifier: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64Url(new Uint8Array(digest));
};

const parseTokenResponse = async (response: Response) => {
  if (!response.ok) {
    throw new Error(`google_oauth_${response.status}`);
  }
  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  const accessToken = textValue(payload.access_token);
  if (!accessToken) throw new Error("google_oauth_access_token_missing");
  const expiresIn = Number(payload.expires_in);
  return {
    accessToken,
    refreshToken: textValue(payload.refresh_token) || null,
    expiresAt: Number.isFinite(expiresIn)
      ? new Date(Date.now() + Math.max(30, expiresIn - 30) * 1_000).toISOString()
      : null,
    scopes: textValue(payload.scope)
      .split(/\s+/)
      .filter(Boolean),
  };
};

export async function exchangeGoogleDriveAuthorizationCode(params: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      code_verifier: params.codeVerifier,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  return parseTokenResponse(response);
}

export async function refreshGoogleDriveAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  return parseTokenResponse(response);
}

export async function revokeGoogleDriveToken(token: string) {
  const normalizedToken = textValue(token);
  if (!normalizedToken) return false;
  const response = await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: normalizedToken }),
    signal: AbortSignal.timeout(15_000),
  });
  return response.ok;
}

const pemToPkcs8 = (value: string) => {
  const normalized = value
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  return base64ToBytes(normalized);
};

const createServiceAccountAssertion = async (
  serviceAccount: GoogleServiceAccount,
) => {
  const email = textValue(serviceAccount.client_email);
  const privateKey = textValue(serviceAccount.private_key);
  const tokenUri =
    textValue(serviceAccount.token_uri) || "https://oauth2.googleapis.com/token";
  if (!email || !privateKey) {
    throw new Error("google_service_account_invalid");
  }
  const now = Math.floor(Date.now() / 1_000);
  const unsigned = `${jsonBase64Url({ alg: "RS256", typ: "JWT" })}.${jsonBase64Url(
    {
      iss: email,
      scope: GOOGLE_DRIVE_READONLY_SCOPE,
      aud: tokenUri,
      iat: now,
      exp: now + 3_600,
    },
  )}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  return {
    assertion: `${unsigned}.${base64Url(new Uint8Array(signature))}`,
    tokenUri,
  };
};

export async function createServiceAccountDriveAccessToken(
  serviceAccountJson: string,
) {
  let serviceAccount: GoogleServiceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as GoogleServiceAccount;
  } catch {
    throw new Error("google_service_account_invalid");
  }
  const { assertion, tokenUri } =
    await createServiceAccountAssertion(serviceAccount);
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  return parseTokenResponse(response);
}

export async function resolveGoogleDriveCredential(params: {
  requestedStrategy: DriveAuthStrategy;
  storedOAuth?: StoredDriveOAuthCredential | null;
  encryptionSecret?: string | null;
  oauthClientId?: string | null;
  oauthClientSecret?: string | null;
  serviceAccountJson?: string | null;
  apiKey?: string | null;
}): Promise<GoogleDriveCredential> {
  const requested = params.requestedStrategy;
  const allowed = (strategy: GoogleDriveCredential["strategy"]) =>
    requested === "auto" || requested === strategy;

  if (
    allowed("oauth_user") &&
    textValue(params.storedOAuth?.refreshTokenCiphertext) &&
    textValue(params.storedOAuth?.refreshTokenIv) &&
    textValue(params.encryptionSecret) &&
    textValue(params.oauthClientId) &&
    textValue(params.oauthClientSecret)
  ) {
    try {
      const refreshToken = await decryptDriveRefreshToken(
        textValue(params.storedOAuth?.refreshTokenCiphertext),
        textValue(params.storedOAuth?.refreshTokenIv),
        textValue(params.encryptionSecret),
      );
      const token = await refreshGoogleDriveAccessToken({
        refreshToken,
        clientId: textValue(params.oauthClientId),
        clientSecret: textValue(params.oauthClientSecret),
      });
      return {
        strategy: "oauth_user",
        apiKey: null,
        accessToken: token.accessToken,
        expiresAt: token.expiresAt,
      };
    } catch (error) {
      if (requested !== "auto") throw error;
    }
  }

  if (allowed("service_account") && textValue(params.serviceAccountJson)) {
    const token = await createServiceAccountDriveAccessToken(
      textValue(params.serviceAccountJson),
    );
    return {
      strategy: "service_account",
      apiKey: null,
      accessToken: token.accessToken,
      expiresAt: token.expiresAt,
    };
  }

  if (allowed("api_key") && textValue(params.apiKey)) {
    return {
      strategy: "api_key",
      apiKey: textValue(params.apiKey),
      accessToken: null,
      expiresAt: null,
    };
  }

  if (requested === "oauth_user") throw new Error("google_oauth_required");
  if (requested === "service_account") {
    throw new Error("google_service_account_not_configured");
  }
  if (requested === "api_key") throw new Error("google_api_key_not_configured");
  throw new Error("google_drive_credentials_not_configured");
}

export function buildGoogleDriveResourceKeyHeader(
  values: { fileId: string; resourceKey?: string | null }[],
) {
  return values
    .map(({ fileId, resourceKey }) => ({
      fileId: textValue(fileId),
      resourceKey: textValue(resourceKey),
    }))
    .filter(({ fileId, resourceKey }) => fileId && resourceKey)
    .map(({ fileId, resourceKey }) => `${fileId}/${resourceKey}`)
    .join(",");
}

export function buildGoogleDriveHeaders(params: {
  credential: GoogleDriveCredential;
  accept?: string;
  resourceKeys?: { fileId: string; resourceKey?: string | null }[];
}) {
  const headers = new Headers({
    Accept: params.accept ?? "application/json, text/plain, */*",
  });
  if (params.credential.accessToken) {
    headers.set("Authorization", `Bearer ${params.credential.accessToken}`);
  }
  const resourceKeys = buildGoogleDriveResourceKeyHeader(
    params.resourceKeys ?? [],
  );
  if (resourceKeys) {
    headers.set("X-Goog-Drive-Resource-Keys", resourceKeys);
  }
  return headers;
}

export function resolveSafeDriveReturnUrl(
  value: string,
  _requestOrigin?: string | null,
) {
  const url = new URL(value);
  const allowedProductionOrigins = new Set([
    "https://go-atleta.vercel.app",
    "https://goatleta.com",
    "https://www.goatleta.com",
  ]);
  const isLocal =
    /^http:\/\/localhost(?::\d+)?$/.test(url.origin) ||
    /^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(url.origin);
  const isPreview =
    url.protocol === "https:" && url.hostname.endsWith(".vercel.app");
  if (
    !allowedProductionOrigins.has(url.origin) &&
    !isLocal &&
    !isPreview
  ) {
    throw new Error("drive_oauth_return_url_not_allowed");
  }
  url.hash = "";
  return url.toString();
}
