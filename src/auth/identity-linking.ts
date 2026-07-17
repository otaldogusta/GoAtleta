export type LinkedIdentity = {
  id?: string | null;
  identity_id?: string | null;
  identityId?: string | null;
  identity_id_pk?: string | null;
  provider?: string | null;
};

const normalizeProvider = (provider: string | null | undefined) =>
  String(provider ?? "").trim().toLowerCase();

export const canSafelyUnlinkProvider = (
  identities: readonly LinkedIdentity[],
  provider: string
) => {
  const targetProvider = normalizeProvider(provider);
  if (!targetProvider) return false;

  const hasTarget = identities.some(
    (identity) => normalizeProvider(identity.provider) === targetProvider
  );
  const hasAlternative = identities.some((identity) => {
    const identityProvider = normalizeProvider(identity.provider);
    return Boolean(identityProvider) && identityProvider !== targetProvider;
  });

  return hasTarget && hasAlternative;
};
