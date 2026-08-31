import type { FamilyStudentContext } from "../../api/family-access";
import {
  resolveAvailableUserRoles,
  resolvePreferredActiveRole,
  resolveSelectedFamilyStudent,
} from "../role-resolution";

const familyContext = (
  studentId: string,
  overrides: Partial<FamilyStudentContext> = {},
): FamilyStudentContext => ({
  relationshipId: `rel-${studentId}`,
  relationshipType: "guardian",
  relationshipLabel: "Responsável",
  studentId,
  studentName: `Atleta ${studentId}`,
  studentPhotoUrl: null,
  organizationId: "org-1",
  organizationName: "Instituição",
  classId: null,
  className: null,
  isFinancialResponsible: false,
  canViewAgenda: false,
  canViewAttendance: false,
  canViewProgress: false,
  canViewFinance: false,
  canPay: false,
  ...overrides,
});

describe("role resolution", () => {
  it("keeps trainer, student and family on a hybrid account", () => {
    expect(
      resolveAvailableUserRoles({
        isTrainer: true,
        hasStudent: true,
        familyContexts: [familyContext("student-1")],
      }),
    ).toEqual(["trainer", "student", "family"]);
  });

  it("does not create a family role from the athlete's self relationship", () => {
    const athleteContext = familyContext("student-1", {
      relationshipType: "self",
      relationshipLabel: "Atleta",
      canViewFinance: true,
      canPay: true,
    });

    expect(
      resolveAvailableUserRoles({
        isTrainer: false,
        hasStudent: true,
        familyContexts: [athleteContext],
      }),
    ).toEqual(["student"]);
    expect(
      resolveSelectedFamilyStudent({
        familyContexts: [athleteContext],
        preferredStudentId: athleteContext.studentId,
      }),
    ).toMatchObject({
      relationshipType: "self",
      canViewFinance: true,
      canPay: true,
    });
  });

  it("keeps family available when a non-self relationship also exists", () => {
    expect(
      resolveAvailableUserRoles({
        isTrainer: false,
        hasStudent: true,
        familyContexts: [
          familyContext("self", { relationshipType: "self" }),
          familyContext("dependent", { relationshipType: "payer" }),
        ],
      }),
    ).toEqual(["student", "family"]);
  });

  it("uses only a preferred role that remains server-authorized", () => {
    expect(
      resolvePreferredActiveRole({
        availableRoles: ["trainer", "family"],
        preferredRole: "student",
      }),
    ).toBe("trainer");
    expect(
      resolvePreferredActiveRole({
        availableRoles: ["trainer", "family"],
        preferredRole: "family",
      }),
    ).toBe("family");
  });

  it("validates the selected athlete against live family contexts", () => {
    const contexts = [familyContext("student-1"), familyContext("student-2")];
    expect(
      resolveSelectedFamilyStudent({
        familyContexts: contexts,
        preferredStudentId: "student-2",
      })?.studentId,
    ).toBe("student-2");
    expect(
      resolveSelectedFamilyStudent({
        familyContexts: contexts,
        preferredStudentId: "removed-student",
      })?.studentId,
    ).toBe("student-1");
  });
});
