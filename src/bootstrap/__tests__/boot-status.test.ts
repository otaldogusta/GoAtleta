import { resolveBootStatus, shouldMaskBootContent } from "../boot-status";

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
  });

  it("renders the route tree while navigation becomes ready", () => {
    expect(resolveBootStatus({ ...base, navReady: false })).toMatchObject({
      phase: "navigation",
      blocking: false,
    });
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

  it("masks every incomplete boot phase while keeping the route tree mounted", () => {
    expect(shouldMaskBootContent(resolveBootStatus({ ...base, navReady: false }))).toBe(true);
    expect(shouldMaskBootContent(resolveBootStatus({ ...base, roleLoading: true }))).toBe(true);
    expect(
      shouldMaskBootContent(resolveBootStatus({ ...base, organizationLoading: true })),
    ).toBe(true);
    expect(
      shouldMaskBootContent(resolveBootStatus({ ...base, permissionsLoading: true })),
    ).toBe(true);
    expect(shouldMaskBootContent(resolveBootStatus(base))).toBe(false);
  });
});
