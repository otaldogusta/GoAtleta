type EmailVerificationUser = {
  app_metadata?: {
    provider?: string | null;
    providers?: string[] | null;
    email_verified_hybrid_at?: string | null;
    [key: string]: unknown;
  };
  identities?: { provider?: string | null }[] | null;
};

const TRUSTED_OAUTH_PROVIDERS = new Set(["google", "apple", "facebook"]);
const PUBLIC_LEGAL_ROUTES = new Set(["/privacy", "/terms", "/data-deletion"]);

export const hasVerifiedEmailAccess = (user?: EmailVerificationUser | null) => {
  if (!user) return false;

  const hybridVerifiedAt = user.app_metadata?.email_verified_hybrid_at;
  if (typeof hybridVerifiedAt === "string" && hybridVerifiedAt.trim()) {
    return true;
  }

  const providers = [
    ...(user.app_metadata?.providers ?? []),
    ...(user.identities?.map((identity) => identity.provider ?? "") ?? []),
    user.app_metadata?.provider ?? "",
  ];

  return providers.some((provider) =>
    TRUSTED_OAUTH_PROVIDERS.has(String(provider).toLowerCase().trim()),
  );
};

export const shouldRestrictToEmailVerification = ({
  user,
  pathname,
  isInviteRoute,
}: {
  user?: EmailVerificationUser | null;
  pathname: string;
  isInviteRoute: boolean;
}) =>
  Boolean(user) &&
  !hasVerifiedEmailAccess(user) &&
  !PUBLIC_LEGAL_ROUTES.has(pathname) &&
  pathname !== "/verify-email" &&
  pathname !== "/reset-password" &&
  !isInviteRoute;
