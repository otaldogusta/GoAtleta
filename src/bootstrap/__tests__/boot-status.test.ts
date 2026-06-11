import { resolveBootStatus } from "../boot-status";

const base = {
  bootstrapLoading: false,
  authLoading: false,
  navReady: true,
  roleLoading: false,
  organizationLoading: false,
  permissionsLoading: false,
  hasSession: true,
  role: "trainer",
};

describe("resolveBootStatus", () => {
  it("prioritizes blocking bootstrap phases", () => {
    expect(resolveBootStatus({ ...base, bootstrapLoading: true }).phase).toBe("bootstrap");
    expect(resolveBootStatus({ ...base, authLoading: true }).phase).toBe("auth");
    expect(resolveBootStatus({ ...base, navReady: false }).phase).toBe("navigation");
  });

  it("reports non-blocking role and organization phases", () => {
    expect(resolveBootStatus({ ...base, roleLoading: true })).toMatchObject({
      phase: "role",
      blocking: false,
    });
    expect(resolveBootStatus({ ...base, organizationLoading: true })).toMatchObject({
      phase: "organization",
      blocking: false,
    });
    expect(resolveBootStatus({ ...base, permissionsLoading: true })).toMatchObject({
      phase: "permissions",
      blocking: false,
    });
  });

  it("returns ready when no boot phase is active", () => {
    expect(resolveBootStatus(base)).toMatchObject({ phase: "ready", blocking: false });
  });
});
