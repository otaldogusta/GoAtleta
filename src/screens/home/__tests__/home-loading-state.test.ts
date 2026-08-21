import {
  resolveHomeScheduleRequestKey,
  shouldShowInitialHomeLoading,
} from "../home-loading-state";

describe("home loading state", () => {
  it("keeps the coordination home loading until its schedule request resolves", () => {
    const requestKey = resolveHomeScheduleRequestKey({
      userId: "user-1",
      role: "trainer",
      organizationId: "org-1",
      contextLoading: false,
      adminMode: true,
    });

    expect(requestKey).toBe("user-1:org-1:coord");
    expect(
      shouldShowInitialHomeLoading({
        contextLoading: false,
        requestKey,
        resolvedRequestKey: null,
      })
    ).toBe(true);
    expect(
      shouldShowInitialHomeLoading({
        contextLoading: false,
        requestKey,
        resolvedRequestKey: requestKey,
      })
    ).toBe(false);
  });

  it("returns to loading immediately when the organization changes", () => {
    const previousKey = "user-1:org-1:coord";
    const nextKey = resolveHomeScheduleRequestKey({
      userId: "user-1",
      role: "trainer",
      organizationId: "org-2",
      contextLoading: false,
      adminMode: true,
    });

    expect(
      shouldShowInitialHomeLoading({
        contextLoading: false,
        requestKey: nextKey,
        resolvedRequestKey: previousKey,
      })
    ).toBe(true);
  });
});
