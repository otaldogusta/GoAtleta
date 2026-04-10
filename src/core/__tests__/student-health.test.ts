import { deriveStudentHealthAssessment } from "../student-health";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
  toContain: (expected: unknown) => void;
};

describe("student-health", () => {
  it("keeps students with no health flags as apto", () => {
    const assessment = deriveStudentHealthAssessment({
      healthIssue: false,
      healthIssueNotes: "",
      medicationUse: false,
      medicationNotes: "",
      healthObservations: "",
    });

    expect(assessment.level).toBe("apto");
    expect(assessment.label).toBe("Apto");
  });

  it("marks generic health notes as attention", () => {
    const assessment = deriveStudentHealthAssessment({
      healthIssue: true,
      healthIssueNotes: "Alergia leve",
      medicationUse: false,
      medicationNotes: "",
      healthObservations: "",
    });

    expect(assessment.level).toBe("atencao");
    expect(assessment.signals).toContain("health_issue");
  });

  it("marks severe observations as review", () => {
    const assessment = deriveStudentHealthAssessment({
      healthIssue: false,
      healthIssueNotes: "Dor no peito durante esforco",
      medicationUse: false,
      medicationNotes: "",
      healthObservations: "",
    });

    expect(assessment.level).toBe("revisar");
    expect(assessment.signals).toContain("cardiovascular_alert");
  });
});
