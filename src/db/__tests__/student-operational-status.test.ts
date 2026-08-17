const mockSupabasePatch = jest.fn();
const mockGetSessionUserId = jest.fn();

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
  supabaseGet: jest.fn(),
  supabasePatch: (...args: unknown[]) => mockSupabasePatch(...args),
  supabasePost: jest.fn(),
  writeCache: jest.fn(),
}));

jest.mock("../../auth/session", () => ({
  getSessionUserId: () => mockGetSessionUserId(),
}));

import {
  STUDENT_OPERATIONAL_SELECT,
  updateStudentOperationalStatus,
} from "../students";

const inactiveStudentRow = {
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
  health_issue: false,
  medication_use: false,
  membership_status: "inactive",
  financial_status: "regular",
  inactivated_at: "2026-08-14T12:00:00.000Z",
  inactivated_by: "user-1",
  inactivation_reason: "Mudança de cidade",
  createdat: "2026-01-01T12:00:00.000Z",
};

describe("updateStudentOperationalStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionUserId.mockResolvedValue("user-1");
    mockSupabasePatch.mockResolvedValue([inactiveStudentRow]);
  });

  it("returns only a status confirmed by Supabase", async () => {
    const updated = await updateStudentOperationalStatus(
      "student-1",
      {
        membershipStatus: "inactive",
        inactivationReason: "Mudança de cidade",
      },
      { organizationId: "org-1" },
    );

    expect(mockSupabasePatch).toHaveBeenCalledWith(
      `/students?select=${STUDENT_OPERATIONAL_SELECT}&id=eq.student-1&organization_id=eq.org-1`,
      expect.objectContaining({
        membership_status: "inactive",
        inactivated_by: "user-1",
        inactivation_reason: "Mudança de cidade",
      }),
      { Prefer: "return=representation" },
    );
    expect(updated.membershipStatus).toBe("inactive");
    expect(updated.inactivatedAt).toBe("2026-08-14T12:00:00.000Z");
  });

  it("rejects a successful HTTP response that updated no row", async () => {
    mockSupabasePatch.mockResolvedValue([]);

    await expect(
      updateStudentOperationalStatus(
        "student-1",
        { membershipStatus: "inactive" },
        { organizationId: "org-1" },
      ),
    ).rejects.toThrow("não foi atualizada");
  });

  it("rejects a response that does not confirm the requested status", async () => {
    mockSupabasePatch.mockResolvedValue([
      { ...inactiveStudentRow, membership_status: "active", inactivated_at: null },
    ]);

    await expect(
      updateStudentOperationalStatus(
        "student-1",
        { membershipStatus: "inactive" },
        { organizationId: "org-1" },
      ),
    ).rejects.toThrow("não confirmou");
  });
});
