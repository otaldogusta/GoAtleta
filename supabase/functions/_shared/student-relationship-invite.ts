const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const toHex = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const toBase64Url = (bytes: Uint8Array) => {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

export const generateStudentRelationshipInviteToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return toBase64Url(bytes);
};

export const normalizeStudentRelationshipInviteToken = (
  value: unknown,
): string | null => {
  const token = String(value ?? "").trim();
  return TOKEN_PATTERN.test(token) ? token : null;
};

export const hashStudentRelationshipInviteToken = async (token: string) => {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
};

export const buildStudentRelationshipInviteUrl = (
  token: string,
  configuredBaseUrl: string,
) => {
  const fallback = "https://goatleta.com";
  let base: URL;
  try {
    base = new URL(configuredBaseUrl.trim() || fallback);
  } catch {
    base = new URL(fallback);
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    base = new URL(fallback);
  }

  const inviteUrl = new URL(
    `/family-invite/${encodeURIComponent(token)}`,
    base.origin,
  );
  return inviteUrl.toString();
};
