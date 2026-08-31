import {
  normalizeRelationshipPermissions,
  permissionsForRelationshipKind,
} from "../relationship-presets";

describe("relationship permission presets", () => {
  it("lets an athlete or guardian access only the implemented journey", () => {
    expect(permissionsForRelationshipKind("athlete")).toMatchObject({
      canViewSchedule: true,
      canViewAttendance: true,
      canViewHealth: false,
      canSignConsents: false,
      canViewFinancial: true,
      canPay: true,
    });
    expect(permissionsForRelationshipKind("guardian")).toMatchObject({
      canViewHealth: false,
      canSignConsents: false,
    });
  });

  it("keeps a payer inside the financial surface", () => {
    expect(permissionsForRelationshipKind("payer")).toEqual({
      canViewProfile: false,
      canViewSchedule: false,
      canViewAttendance: false,
      canViewProgress: false,
      canViewHealth: false,
      canSignConsents: false,
      canViewFinancial: true,
      canPay: true,
    });
  });

  it("never permits payment without financial visibility", () => {
    expect(
      normalizeRelationshipPermissions({
        ...permissionsForRelationshipKind("viewer"),
        canPay: true,
      }).canViewFinancial,
    ).toBe(true);
  });

  it("does not send permissions for unfinished health and consent surfaces", () => {
    expect(
      normalizeRelationshipPermissions({
        ...permissionsForRelationshipKind("guardian"),
        canViewHealth: true,
        canSignConsents: true,
      }),
    ).toMatchObject({
      canViewHealth: false,
      canSignConsents: false,
    });
  });
});
