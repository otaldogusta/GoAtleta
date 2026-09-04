export type CoordinationScreenPhase = "loading" | "forbidden" | "ready";

// A development preview may reduce access, but must never grant real operations.
export function hasCoordinationAccess(
  memberships: readonly { id: string; role_level: number }[],
  displayedOrganization: { id: string; role_level: number } | null,
) {
  if (!displayedOrganization || displayedOrganization.role_level < 50) return false;
  return (memberships.find((membership) => membership.id === displayedOrganization.id)?.role_level ?? 0) >= 50;
}

type ResolveCoordinationScreenPhaseParams = {
  organizationLoading: boolean;
  organizationId: string | null;
  loadedOrganizationId: string | null;
  isAdmin: boolean;
};

export function resolveCoordinationScreenPhase({
  organizationLoading,
  organizationId,
  loadedOrganizationId,
  isAdmin,
}: ResolveCoordinationScreenPhaseParams): CoordinationScreenPhase {
  if (organizationLoading) return "loading";
  if (!isAdmin || !organizationId) return "forbidden";
  if (loadedOrganizationId !== organizationId) return "loading";
  return "ready";
}
