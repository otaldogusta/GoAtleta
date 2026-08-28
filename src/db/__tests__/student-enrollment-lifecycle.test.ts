const mockSupabaseGet = jest.fn();
const mockSupabasePatch = jest.fn();
const mockSupabasePost = jest.fn();

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock("../client", () => ({
  CACHE_KEYS: { attendanceRecords: "attendance", students: "students" },
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

// eslint-disable-next-line import/first -- load the module only after its Jest dependencies are mocked
import {
  linkExistingStudentByIdentity,
  moveStudentsToClass,
} from "../students";

const studentRow = {
  id: "student-1",
  name: "Ana",
  organization_id: "org-1",
  classid: "class-old",
  age: 12,
  phone: "",
  login_email: "ana@example.com",
  guardian_name: "",
  guardian_phone: "",
  guardian_relation: "",
  health_issue: false,
  medication_use: false,
  membership_status: "active",
  financial_status: "unknown",
  createdat: "2026-01-01T12:00:00.000Z",
};

describe("student enrollment lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reactivates an existing inactive enrollment instead of duplicating it", async () => {
    mockSupabaseGet.mockImplementation((path: string) => {
      if (path.startsWith("/students?")) return Promise.resolve([studentRow]);
      if (path.startsWith("/student_class_enrollments?")) {
        return Promise.resolve([
          {
            id: "enrollment-1",
            organization_id: "org-1",
            student_id: "student-1",
            class_id: "class-new",
            modality: "voleibol",
            status: "inactive",
          },
        ]);
      }
      return Promise.resolve([]);
    });
    mockSupabasePatch.mockResolvedValue([]);

    await expect(
      linkExistingStudentByIdentity({
        organizationId: "org-1",
        classId: "class-new",
        ra: "20260001",
        modality: "voleibol",
      }),
    ).resolves.toEqual(
      expect.objectContaining({ status: "linked", matchedBy: "ra" }),
    );

    expect(mockSupabasePatch).toHaveBeenCalledWith(
      "/student_class_enrollments?id=eq.enrollment-1&organization_id=eq.org-1",
      expect.objectContaining({ status: "active", modality: "voleibol" }),
    );
    expect(mockSupabasePost).not.toHaveBeenCalled();
  });

  it("reactivates the enrollment even when the legacy primary class already matches", async () => {
    mockSupabaseGet.mockImplementation((path: string) => {
      if (path.startsWith("/students?")) {
        return Promise.resolve([{ ...studentRow, classid: "class-new" }]);
      }
      if (path.startsWith("/student_class_enrollments?")) {
        return Promise.resolve([
          {
            id: "enrollment-legacy",
            organization_id: "org-1",
            student_id: "student-1",
            class_id: "class-new",
            modality: "voleibol",
            status: "inactive",
          },
        ]);
      }
      return Promise.resolve([]);
    });
    mockSupabasePatch.mockResolvedValue([]);

    await expect(
      linkExistingStudentByIdentity({
        organizationId: "org-1",
        classId: "class-new",
        ra: "20260001",
        modality: "voleibol",
      }),
    ).resolves.toEqual(expect.objectContaining({ status: "linked" }));

    expect(mockSupabasePatch).toHaveBeenCalledWith(
      "/student_class_enrollments?id=eq.enrollment-legacy&organization_id=eq.org-1",
      expect.objectContaining({ status: "active" }),
    );
  });

  it("moves students through the atomic RPC without deleting enrollments", async () => {
    mockSupabasePost.mockResolvedValue([{ moved_count: 2 }]);

    await moveStudentsToClass(
      ["student-1", "student-2"],
      "class-old",
      "class-new",
      "org-1",
    );

    expect(mockSupabasePost).toHaveBeenCalledWith(
      "/rpc/move_students_to_class",
      {
        p_org_id: "org-1",
        p_student_ids: ["student-1", "student-2"],
        p_from_class_id: "class-old",
        p_to_class_id: "class-new",
      },
      { Prefer: "return=representation" },
    );
  });

  it("rejects a partial move receipt", async () => {
    mockSupabasePost.mockResolvedValue([{ moved_count: 1 }]);

    await expect(
      moveStudentsToClass(
        ["student-1", "student-2"],
        "class-old",
        "class-new",
        "org-1",
      ),
    ).rejects.toThrow("não confirmou a movimentação de todos os alunos");
  });
});
