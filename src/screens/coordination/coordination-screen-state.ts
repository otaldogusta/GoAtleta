export type CoordinationScreenPhase = "loading" | "forbidden" | "ready";

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
