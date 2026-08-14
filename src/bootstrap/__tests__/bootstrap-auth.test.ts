import { resolveBootstrapInitialSession } from "../bootstrap-auth";

describe("resolveBootstrapInitialSession", () => {
  it("keeps auth loading while bootstrap data is unavailable", () => {
    expect(resolveBootstrapInitialSession(null)).toBeUndefined();
  });

  it("preserves the resolved signed-out and signed-in states", () => {
    expect(resolveBootstrapInitialSession({ session: null })).toBeNull();
    expect(resolveBootstrapInitialSession({})).toBeNull();

    const session = { userId: "user-1" };
    expect(resolveBootstrapInitialSession({ session })).toBe(session);
  });
});
