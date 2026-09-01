import { renderHook } from "@testing-library/react-native";

import { isOrganizationAsyncIdentityCurrent } from "../../core/organization-async-identity";
import { useOrganizationAsyncIdentity } from "../use-organization-async-identity";

describe("useOrganizationAsyncIdentity", () => {
  it("keeps the async ref current across A to B to A and invalidates it on unmount", () => {
    const { result, rerender, unmount } = renderHook(
      ({ organizationId }: { organizationId: string }) =>
        useOrganizationAsyncIdentity(organizationId),
      { initialProps: { organizationId: "org-a" } },
    );
    const identityRef = result.current.identityRef;
    const firstOrgA = result.current.identity;

    rerender({ organizationId: "org-b" });
    expect(result.current.identity).toEqual({
      organizationId: "org-b",
      generation: 1,
    });
    expect(identityRef.current).toBe(result.current.identity);

    rerender({ organizationId: "org-a" });
    const secondOrgA = result.current.identity;
    expect(secondOrgA).toEqual({ organizationId: "org-a", generation: 2 });
    expect(isOrganizationAsyncIdentityCurrent(secondOrgA, firstOrgA)).toBe(
      false,
    );

    unmount();
    expect(
      isOrganizationAsyncIdentityCurrent(identityRef.current, secondOrgA),
    ).toBe(false);
  });
});
