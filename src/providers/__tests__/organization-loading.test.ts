import { resolvePermissionsLoading } from "../organization-loading";

describe("resolvePermissionsLoading", () => {
  it("keeps the organization context loading until its permissions resolve", () => {
    expect(
      resolvePermissionsLoading({
        currentRequestKey: "user-1:org-1",
        resolvedRequestKey: "",
        fetchLoading: false,
      }),
    ).toBe(true);
  });

  it("finishes only for the current organization context", () => {
    expect(
      resolvePermissionsLoading({
        currentRequestKey: "user-1:org-2",
        resolvedRequestKey: "user-1:org-1",
        fetchLoading: false,
      }),
    ).toBe(true);
    expect(
      resolvePermissionsLoading({
        currentRequestKey: "user-1:org-2",
        resolvedRequestKey: "user-1:org-2",
        fetchLoading: false,
      }),
    ).toBe(false);
  });

  it("does not wait for permissions without an active organization", () => {
    expect(
      resolvePermissionsLoading({
        currentRequestKey: "",
        resolvedRequestKey: "user-1:org-1",
        fetchLoading: false,
      }),
    ).toBe(false);
  });
});
