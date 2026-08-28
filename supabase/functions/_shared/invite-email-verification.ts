type InviteIdentity = {
  email?: string | null;
  is_anonymous?: boolean | null;
  app_metadata?: Record<string, unknown> | null;
};

const TRUSTED_EXTERNAL_PROVIDERS = new Set(["google", "apple", "facebook"]);

export const hasTrustedInviteIdentity = (user?: InviteIdentity | null) => {
  if (!user || user.is_anonymous === true) return false;
  if (!String(user.email ?? "").trim()) return false;

  const appMetadata = user.app_metadata ?? {};
  const providers = [
    ...(Array.isArray(appMetadata.providers) ? appMetadata.providers : []),
    appMetadata.provider,
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean);
  const hasTrustedExternalProvider = providers.some((provider) =>
    TRUSTED_EXTERNAL_PROVIDERS.has(provider)
  );
  const hybridProof = appMetadata.email_verified_hybrid_at;

  return hasTrustedExternalProvider
    || (typeof hybridProof === "string" && Boolean(hybridProof.trim()));
};
