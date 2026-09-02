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

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const deriveEncryptionKey = async (masterSecret: string) => {
  const normalized = textValue(masterSecret);
  if (normalized.length < 32) {
    throw new Error("provider_secret_encryption_not_configured");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
};

const contextBytes = (context: string) =>
  new TextEncoder().encode(textValue(context));

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}

export async function encryptProviderSecret(params: {
  plaintext: string;
  masterSecret: string;
  context: string;
}) {
  const plaintext = textValue(params.plaintext);
  const context = textValue(params.context);
  if (!plaintext || !context) throw new Error("provider_secret_invalid");

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(params.masterSecret);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: contextBytes(context),
    },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
    fingerprint: await sha256Hex(plaintext),
  };
}

export async function decryptProviderSecret(params: {
  ciphertext: string;
  iv: string;
  masterSecret: string;
  context: string;
}) {
  const context = textValue(params.context);
  if (!textValue(params.ciphertext) || !textValue(params.iv) || !context) {
    throw new Error("provider_secret_unavailable");
  }
  const key = await deriveEncryptionKey(params.masterSecret);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(params.iv),
      additionalData: contextBytes(context),
    },
    key,
    base64ToBytes(params.ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}

export function providerSecretContext(params: {
  organizationId: string;
  provider: string;
  environment: string;
}) {
  const organizationId = textValue(params.organizationId);
  const provider = textValue(params.provider).toLowerCase();
  const environment = textValue(params.environment).toLowerCase();
  if (!organizationId || !provider || !environment) {
    throw new Error("provider_secret_context_invalid");
  }
  return `${organizationId}:${provider}:${environment}`;
}

export function createSecureWebhookToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(36));
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
