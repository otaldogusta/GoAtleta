import {
  canManageFinanceFromFamilyAccess,
  canOpenFamilyAccessFromFinance,
} from "../finance-permissions";

describe("finance family-access permission", () => {
  it("allows an organization administrator", () => {
    expect(
      canOpenFamilyAccessFromFinance({
        roleLevel: 50,
        canManageStudents: false,
        permissionsLoading: false,
      }),
    ).toBe(true);
  });

  it("allows a staff member with students permission", () => {
    expect(
      canOpenFamilyAccessFromFinance({
        roleLevel: 10,
        canManageStudents: true,
        permissionsLoading: false,
      }),
    ).toBe(true);
  });

  it("never exposes the route while access is unknown or denied", () => {
    expect(
      canOpenFamilyAccessFromFinance({
        roleLevel: 10,
        canManageStudents: true,
        permissionsLoading: true,
      }),
    ).toBe(false);
    expect(
      canOpenFamilyAccessFromFinance({
        roleLevel: 10,
        canManageStudents: false,
        permissionsLoading: false,
      }),
    ).toBe(false);
  });
});

describe("family-access financial permission", () => {
  it("allows financial linking only for admins or financial staff", () => {
    expect(
      canManageFinanceFromFamilyAccess({
        roleLevel: 50,
        canManageFinancial: false,
        permissionsLoading: false,
      }),
    ).toBe(true);
    expect(
      canManageFinanceFromFamilyAccess({
        roleLevel: 10,
        canManageFinancial: true,
        permissionsLoading: false,
      }),
    ).toBe(true);
  });

  it("keeps students-only staff out of financial RPCs", () => {
    expect(
      canManageFinanceFromFamilyAccess({
        roleLevel: 10,
        canManageFinancial: false,
        permissionsLoading: false,
      }),
    ).toBe(false);
    expect(
      canManageFinanceFromFamilyAccess({
        roleLevel: 10,
        canManageFinancial: true,
        permissionsLoading: true,
      }),
    ).toBe(false);
  });
});
