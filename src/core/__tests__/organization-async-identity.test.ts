import {
  captureOrganizationAsyncIdentity,
  createOrganizationAsyncIdentity,
  invalidateOrganizationAsyncIdentity,
  isOrganizationAsyncIdentityCurrent,
  rotateOrganizationAsyncIdentity,
} from "../organization-async-identity";

describe("organization async identity", () => {
  it("keeps the same immutable identity while the organization is unchanged", () => {
    const identity = createOrganizationAsyncIdentity(" org-a ");

    expect(rotateOrganizationAsyncIdentity(identity, "org-a")).toBe(identity);
    expect(captureOrganizationAsyncIdentity(identity, identity)).toBe(identity);
  });

  it("rotates the generation and rejects callbacks captured by the old organization", () => {
    const orgA = createOrganizationAsyncIdentity("org-a");
    const orgB = rotateOrganizationAsyncIdentity(orgA, "org-b");

    expect(orgB).toEqual({ organizationId: "org-b", generation: 1 });
    expect(captureOrganizationAsyncIdentity(orgB, orgA)).toBeNull();
    expect(isOrganizationAsyncIdentityCurrent(orgB, orgA)).toBe(false);
    expect(isOrganizationAsyncIdentityCurrent(orgB, orgB)).toBe(true);
  });

  it("invalidates an older generation even when returning to the same organization", () => {
    const firstOrgA = createOrganizationAsyncIdentity("org-a");
    const orgB = rotateOrganizationAsyncIdentity(firstOrgA, "org-b");
    const secondOrgA = rotateOrganizationAsyncIdentity(orgB, "org-a");

    expect(secondOrgA).toEqual({ organizationId: "org-a", generation: 2 });
    expect(isOrganizationAsyncIdentityCurrent(secondOrgA, firstOrgA)).toBe(
      false,
    );
  });

  it("invalidates callbacks captured by an unmounted organization scope", () => {
    const mounted = createOrganizationAsyncIdentity("org-a");
    const unmounted = invalidateOrganizationAsyncIdentity(mounted);

    expect(unmounted).toEqual({ organizationId: "org-a", generation: 1 });
    expect(isOrganizationAsyncIdentityCurrent(unmounted, mounted)).toBe(false);
    expect(captureOrganizationAsyncIdentity(unmounted, mounted)).toBeNull();
  });

});
