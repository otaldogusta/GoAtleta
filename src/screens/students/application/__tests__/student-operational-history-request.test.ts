import {
  buildStudentOperationalHistoryScopeKey,
  isStudentOperationalHistoryScopeCurrent,
} from "../student-operational-history-request";

describe("student operational history request scope", () => {
  const scopeFor = (studentId: string, includeFinancial = true) =>
    buildStudentOperationalHistoryScopeKey({
      organizationId: "org-1",
      studentId,
      includeFinancial,
    });

  it("rejects a delayed refresh captured for another student", () => {
    const capturedStudentA = scopeFor("student-a");
    const currentStudentB = scopeFor("student-b");

    expect(
      isStudentOperationalHistoryScopeCurrent(
        capturedStudentA,
        currentStudentB,
      ),
    ).toBe(false);
    expect(
      isStudentOperationalHistoryScopeCurrent(
        currentStudentB,
        currentStudentB,
      ),
    ).toBe(true);
  });

  it("invalidates the scope when financial visibility changes", () => {
    expect(
      isStudentOperationalHistoryScopeCurrent(
        scopeFor("student-a", true),
        scopeFor("student-a", false),
      ),
    ).toBe(false);
  });
});
