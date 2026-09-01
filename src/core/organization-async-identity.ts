export type OrganizationAsyncIdentity = Readonly<{
  organizationId: string;
  generation: number;
}>;

const normalizeOrganizationId = (organizationId: string) =>
  organizationId.trim();

export const createOrganizationAsyncIdentity = (
  organizationId: string,
): OrganizationAsyncIdentity => ({
  organizationId: normalizeOrganizationId(organizationId),
  generation: 0,
});

export const rotateOrganizationAsyncIdentity = (
  current: OrganizationAsyncIdentity,
  organizationId: string,
): OrganizationAsyncIdentity => {
  const normalizedOrganizationId = normalizeOrganizationId(organizationId);
  if (current.organizationId === normalizedOrganizationId) return current;

  return {
    organizationId: normalizedOrganizationId,
    generation: current.generation + 1,
  };
};

export const captureOrganizationAsyncIdentity = (
  current: OrganizationAsyncIdentity,
  expected: OrganizationAsyncIdentity,
): OrganizationAsyncIdentity | null =>
  current.organizationId === expected.organizationId &&
  current.generation === expected.generation
    ? expected
    : null;

export const isOrganizationAsyncIdentityCurrent = (
  current: OrganizationAsyncIdentity,
  captured: OrganizationAsyncIdentity,
) =>
  current.organizationId === captured.organizationId &&
  current.generation === captured.generation;

export const invalidateOrganizationAsyncIdentity = (
  current: OrganizationAsyncIdentity,
): OrganizationAsyncIdentity => ({
  organizationId: current.organizationId,
  generation: current.generation + 1,
});
