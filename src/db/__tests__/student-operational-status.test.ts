const mockSupabasePatch = jest.fn();
const mockSupabaseGet = jest.fn();
const mockSupabasePost = jest.fn();
const mockGetSessionUserId = jest.fn();
const mockReadCache = jest.fn();
const mockWriteCache = jest.fn();
const mockIsNetworkError = jest.fn();

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
  isNetworkError: (...args: unknown[]) => mockIsNetworkError(...args),
  readCache: (...args: unknown[]) => mockReadCache(...args),
  supabaseDelete: jest.fn(),
  supabaseGet: (...args: unknown[]) => mockSupabaseGet(...args),
  supabasePatch: (...args: unknown[]) => mockSupabasePatch(...args),
  supabasePost: (...args: unknown[]) => mockSupabasePost(...args),
  writeCache: (...args: unknown[]) => mockWriteCache(...args),
}));

jest.mock("../../auth/session", () => ({
  getSessionUserId: () => mockGetSessionUserId(),
}));

// eslint-disable-next-line import/first -- load the module only after its Jest dependencies are mocked
import {
  getStudents,
  inactivateStudents,
  saveStudent,
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
    mockSupabaseGet.mockResolvedValue([]);
    mockSupabasePost.mockResolvedValue([]);
    mockReadCache.mockResolvedValue(null);
    mockWriteCache.mockResolvedValue(undefined);
    mockIsNetworkError.mockReturnValue(false);
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
      "/students?id=eq.student-1&organization_id=eq.org-1",
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
        { membershipStatus: "inactive", inactivationReason: "Pausa" },
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
        { membershipStatus: "inactive", inactivationReason: "Pausa" },
        { organizationId: "org-1" },
      ),
    ).rejects.toThrow("não confirmou");
  });

  it("requires a reason before sending an inactivation", async () => {
    await expect(
      updateStudentOperationalStatus(
        "student-1",
        { membershipStatus: "inactive", inactivationReason: "  " },
        { organizationId: "org-1" },
      ),
    ).rejects.toThrow("Informe o motivo da inativação");
    expect(mockSupabasePatch).not.toHaveBeenCalled();
  });

  it("preserves an unknown financial state instead of coercing it to regular", async () => {
    mockSupabasePost.mockResolvedValue([
      {
        student_id: "student-1",
        organization_id: "org-1",
        status: "unknown",
        updated_at: "2026-08-14T12:00:00.000Z",
        updated_by: "user-1",
      },
    ]);
    mockSupabaseGet.mockResolvedValue([
      { ...inactiveStudentRow, financial_status: "unknown" },
    ]);

    await expect(
      updateStudentOperationalStatus(
        "student-1",
        { financialStatus: "unknown" },
        { organizationId: "org-1" },
      ),
    ).resolves.toEqual(expect.objectContaining({ financialStatus: "unknown" }));
    expect(mockSupabasePatch).not.toHaveBeenCalled();
    expect(mockSupabasePost).toHaveBeenCalledWith(
      "/rpc/set_student_financial_status",
      {
        p_org_id: "org-1",
        p_student_id: "student-1",
        p_status: "unknown",
      },
    );
  });
});

describe("inactivateStudents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionUserId.mockResolvedValue("user-1");
  });

  it("inactivates a unique batch with one server-confirmed update", async () => {
    mockSupabasePatch.mockResolvedValue([
      {
        ...inactiveStudentRow,
        inactivation_reason: "Encerramento do vínculo",
      },
      {
        ...inactiveStudentRow,
        id: "student-2",
        name: "Segundo Aluno",
        inactivation_reason: "Encerramento do vínculo",
      },
    ]);

    const updated = await inactivateStudents(
      ["student-1", "student-2", "student-1"],
      "  Encerramento do vínculo  ",
      { organizationId: "org-1" },
    );

    expect(mockSupabasePatch).toHaveBeenCalledTimes(1);
    expect(mockSupabasePatch).toHaveBeenCalledWith(
      "/students?organization_id=eq.org-1&id=in.(student-1,student-2)",
      expect.objectContaining({
        membership_status: "inactive",
        inactivated_by: "user-1",
        inactivation_reason: "Encerramento do vínculo",
      }),
      { Prefer: "return=representation" },
    );
    expect(updated).toHaveLength(2);
    expect(updated.every((student) => student.membershipStatus === "inactive")).toBe(true);
  });

  it("keeps the request unsent when the reason is blank", async () => {
    await expect(
      inactivateStudents(["student-1"], "   ", { organizationId: "org-1" }),
    ).rejects.toThrow("Informe o motivo da inativação");
    expect(mockSupabasePatch).not.toHaveBeenCalled();
  });

  it("rejects a partial server receipt", async () => {
    mockSupabasePatch.mockResolvedValue([inactiveStudentRow]);

    await expect(
      inactivateStudents(
        ["student-1", "student-2"],
        "Pausa solicitada",
        { organizationId: "org-1" },
      ),
    ).rejects.toThrow("não confirmou a inativação de todos");
  });
});

describe("student financial hydration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadCache.mockResolvedValue(null);
    mockWriteCache.mockResolvedValue(undefined);
    mockIsNetworkError.mockReturnValue(false);
  });

  it("creates every athlete with a protected initial status of unknown", async () => {
    mockSupabasePost.mockResolvedValue(undefined);

    await saveStudent({
      id: "student-new",
      name: "Novo Aluno",
      organizationId: "org-1",
      classId: "class-1",
      age: 12,
      phone: "",
      loginEmail: "",
      guardianName: "",
      guardianPhone: "",
      guardianRelation: "",
      birthDate: "",
      healthIssue: false,
      healthIssueNotes: "",
      medicationUse: false,
      medicationNotes: "",
      healthObservations: "",
      positionPrimary: "indefinido",
      positionSecondary: "indefinido",
      athleteObjective: "base",
      learningStyle: "misto",
      membershipStatus: "active",
      financialStatus: "delinquent",
      createdAt: "2026-08-25T12:00:00.000Z",
    });

    expect(mockSupabasePost).toHaveBeenCalledWith(
      "/students",
      [expect.objectContaining({ financial_status: "unknown" })],
    );
  });

  it("hydrates an authorized status without writing it to the shared cache", async () => {
    mockSupabaseGet.mockImplementation((path: string) => {
      if (path.startsWith("/student_financial_statuses")) {
        return Promise.resolve([
          { student_id: "student-1", status: "delinquent" },
        ]);
      }
      return Promise.resolve([
        { ...inactiveStudentRow, financial_status: "regular" },
      ]);
    });

    const students = await getStudents({ organizationId: "org-1" });

    expect(students[0]?.financialStatus).toBe("delinquent");
    expect(mockWriteCache).toHaveBeenCalledWith(
      "students_org-1",
      [expect.objectContaining({ financialStatus: "unknown" })],
    );
  });

  it("never falls back to the sensitive legacy column when RLS returns no row", async () => {
    mockSupabaseGet.mockImplementation((path: string) => {
      if (path.startsWith("/student_financial_statuses")) {
        return Promise.resolve([]);
      }
      return Promise.resolve([
        { ...inactiveStudentRow, financial_status: "delinquent" },
      ]);
    });

    const students = await getStudents({ organizationId: "org-1" });

    expect(students[0]?.financialStatus).toBe("unknown");
  });

  it("sanitizes financial values left by an older app in the offline cache", async () => {
    mockSupabaseGet.mockRejectedValue(new Error("offline"));
    mockIsNetworkError.mockReturnValue(true);
    mockReadCache.mockResolvedValue([
      {
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
        birthDate: "",
        membershipStatus: "active",
        financialStatus: "delinquent",
        createdAt: "2026-01-01T12:00:00.000Z",
      },
    ]);

    const students = await getStudents({ organizationId: "org-1" });

    expect(students[0]?.financialStatus).toBe("unknown");
    expect(mockWriteCache).toHaveBeenCalledWith(
      "students_org-1",
      [expect.objectContaining({ financialStatus: "unknown" })],
    );
  });
});
