const mockSupabaseGet = jest.fn();
const mockSupabasePost = jest.fn();
const mockSupabasePatch = jest.fn();

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock("../client", () => ({
  CACHE_KEYS: {
    attendanceRecords: "attendance",
    students: "students",
  },
  getActiveOrganizationId: jest.fn(() => Promise.resolve("org-1")),
  getScopedOrganizationId: jest.fn((value: string | null | undefined) =>
    Promise.resolve(value ?? "org-1"),
  ),
  isAuthError: jest.fn(() => false),
  isMissingColumnInSchemaCache: jest.fn(() => false),
  isMissingRelation: jest.fn(() => false),
  isNetworkError: jest.fn(() => false),
  readCache: jest.fn(() => Promise.resolve(null)),
  supabaseDelete: jest.fn(),
  supabaseGet: (...args: unknown[]) => mockSupabaseGet(...args),
  supabasePatch: (...args: unknown[]) => mockSupabasePatch(...args),
  supabasePost: (...args: unknown[]) => mockSupabasePost(...args),
  writeCache: jest.fn(),
}));

jest.mock("../../auth/session", () => ({
  getSessionUserId: jest.fn(() => Promise.resolve("user-1")),
}));

import type { Student } from "../../core/models";
import {
  STUDENT_OPERATIONAL_SELECT,
  getStudentById,
  getStudents,
  updateStudent,
} from "../students";

const studentRow = {
  id: "student-1",
  name: "Aluno Teste",
  organization_id: "org-1",
  classid: "class-1",
  age: 12,
  phone: "",
  login_email: "",
  guardian_name: "",
  guardian_phone: "",
  guardian_relation: "",
  membership_status: "active",
  financial_status: "regular",
  createdat: "2026-01-01T12:00:00.000Z",
};

const student: Student = {
  id: "student-1",
  name: "Aluno Teste",
  organizationId: "org-1",
  classId: "class-1",
  age: 12,
  phone: "",
  loginEmail: "",
  guardianName: "",
  guardianPhone: "",
  guardianRelation: "",
  healthIssue: true,
  healthIssueNotes: "Alergia",
  medicationUse: true,
  medicationNotes: "Medicamento",
  healthObservations: "Acompanhar",
  positionPrimary: "indefinido",
  positionSecondary: "indefinido",
  athleteObjective: "base",
  learningStyle: "misto",
  birthDate: "",
  membershipStatus: "active",
  financialStatus: "regular",
  createdAt: "2026-01-01T12:00:00.000Z",
};

describe("student health boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseGet.mockResolvedValue([studentRow]);
    mockSupabasePatch.mockResolvedValue([]);
    mockSupabasePost.mockResolvedValue([]);
  });

  it("loads operational columns separately from audited health data", async () => {
    mockSupabasePost.mockResolvedValueOnce([
      {
        student_id: "student-1",
        health_issue: true,
        health_issue_notes: "Alergia",
        medication_use: true,
        medication_notes: "Medicamento",
        health_observations: "Acompanhar",
      },
    ]);

    const result = await getStudentById("student-1", { organizationId: "org-1" });

    expect(mockSupabaseGet).toHaveBeenCalledWith(
      `/students?select=${STUDENT_OPERATIONAL_SELECT}&id=eq.student-1&organization_id=eq.org-1`,
    );
    expect(STUDENT_OPERATIONAL_SELECT).not.toContain("health_issue");
    expect(mockSupabasePost).toHaveBeenCalledWith(
      "/rpc/get_student_health_profiles",
      expect.objectContaining({
        p_student_ids: ["student-1"],
        p_source: "student-detail",
      }),
    );
    expect(result).toEqual(expect.objectContaining({
      healthIssue: true,
      healthIssueNotes: "Alergia",
      medicationUse: true,
      medicationNotes: "Medicamento",
      healthObservations: "Acompanhar",
    }));
  });

  it("keeps bulk student lists free from health reads", async () => {
    const result = await getStudents();

    expect(mockSupabaseGet).toHaveBeenCalledWith(
      `/students?select=${STUDENT_OPERATIONAL_SELECT}&organization_id=eq.org-1&order=name.asc`,
    );
    expect(mockSupabasePost).not.toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({ id: "student-1", name: "Aluno Teste" }),
    ]);
  });

  it("writes health data only through the audited RPC", async () => {
    await updateStudent(student);

    const operationalPayload = mockSupabasePatch.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(operationalPayload).not.toHaveProperty("health_issue");
    expect(operationalPayload).not.toHaveProperty("medication_use");
    expect(operationalPayload).not.toHaveProperty("health_observations");
    expect(mockSupabasePost).toHaveBeenCalledWith(
      "/rpc/upsert_student_health_profile",
      expect.objectContaining({
        p_student_id: "student-1",
        p_health_issue: true,
        p_medication_use: true,
        p_source: "student-update",
      }),
    );
  });
});
