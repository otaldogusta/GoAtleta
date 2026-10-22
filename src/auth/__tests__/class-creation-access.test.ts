import { canCreateClasses } from "../class-creation-access";
import { DEFAULT_INVITE_PERMISSION_KEYS } from "../../screens/coordination/application/invite-form";

const member = {
  organizationId: "org-a",
  roleLevel: 10,
  permissionsLoading: false,
  memberPermissions: { classes: true },
};

describe("class creation access", () => {
  it("does not infer creation from access to classes or invite defaults", () => {
    expect(canCreateClasses(member)).toBe(false);
    expect(DEFAULT_INVITE_PERMISSION_KEYS).not.toContain("classes_create");
  });

  it("requires both explicit creation and access to classes", () => {
    expect(canCreateClasses({ ...member, memberPermissions: { classes: true, classes_create: true } })).toBe(true);
    expect(canCreateClasses({ ...member, memberPermissions: { classes: false, classes_create: true } })).toBe(false);
    expect(canCreateClasses({ ...member, memberPermissions: { classes: true, classes_create: false } })).toBe(false);
  });

  it("fails closed while permissions load or organization is absent", () => {
    const allowed = { ...member, memberPermissions: { classes: true, classes_create: true } };
    expect(canCreateClasses({ ...allowed, permissionsLoading: true })).toBe(false);
    expect(canCreateClasses({ ...allowed, organizationId: null })).toBe(false);
  });

  it("retains coordination and owner access within the selected institution", () => {
    expect(canCreateClasses({ ...member, roleLevel: 50, permissionsLoading: true })).toBe(true);
    expect(canCreateClasses({ ...member, roleLevel: 100 })).toBe(true);
    expect(canCreateClasses({ ...member, roleLevel: 100, organizationId: null })).toBe(false);
  });
});
