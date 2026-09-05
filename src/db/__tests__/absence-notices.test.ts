import { createAbsenceNotice, updateAbsenceNoticeStatus } from "../students";

const mockSupabasePost = jest.fn();
const mockSupabasePatch = jest.fn();
const mockSupabaseGet = jest.fn();
const mockListClassHeadsByClassIds = jest.fn();
const mockCreateNotification = jest.fn();
const mockGetSessionUserId = jest.fn();
const mockGetClasses = jest.fn();

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
    Promise.resolve(value ?? "org-1")
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

jest.mock("../classes", () => ({
  getClassById: jest.fn(),
  getClasses: (...args: unknown[]) => mockGetClasses(...args),
}));

jest.mock("../../api/class-responsibles", () => ({
  listClassHeadsByClassIds: (...args: unknown[]) => mockListClassHeadsByClassIds(...args),
}));

jest.mock("../../api/notifications", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

jest.mock("../../auth/session", () => ({
  getSessionUserId: () => mockGetSessionUserId(),
}));

jest.mock("../nfc-sync", () => ({
  enqueueWrite: jest.fn(),
}));

const absenceRow = {
  id: "notice-1",
  student_id: "student-1",
  class_id: "class-1",
  organization_id: "org-1",
  session_date: "2026-07-09",
  reason: "Doença",
  note: "detalhe privado",
  status: "pending",
  created_at: "2026-07-09T12:00:00.000Z",
};

const studentRow = {
  id: "student-1",
  name: "Gustavo Ribeiro",
  organization_id: "org-1",
  classid: "class-1",
  age: 12,
  phone: "",
  createdat: "2026-07-01T12:00:00.000Z",
};

const classItem = {
  id: "class-1",
  name: "Turma 10-12",
  unit: "Rede Esportes Pinhais",
};

describe("absence notice notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabasePost.mockResolvedValue([absenceRow]);
    mockSupabasePatch.mockResolvedValue([]);
    mockSupabaseGet.mockImplementation((path: string) => {
      if (path.startsWith("/students")) return Promise.resolve([studentRow]);
      if (path.startsWith("/absence_notices")) return Promise.resolve([absenceRow]);
      return Promise.resolve([]);
    });
    mockGetClasses.mockResolvedValue([classItem]);
    mockListClassHeadsByClassIds.mockResolvedValue([
      {
        classId: "class-1",
        userId: "trainer-1",
        className: "Turma 10-12",
        unit: "Rede Esportes Pinhais",
        displayName: "Professor",
        email: "prof@example.com",
      },
    ]);
    mockCreateNotification.mockResolvedValue({ id: "notification-1" });
    mockGetSessionUserId.mockResolvedValue("guardian-1");
  });

  test("creates absence notice notification for the class responsible without exposing note", async () => {
    await createAbsenceNotice({
      studentId: "student-1",
      classId: "class-1",
      date: "2026-07-09",
      reason: "Doença",
      note: "detalhe privado",
    });

    expect(mockSupabasePost).toHaveBeenCalledWith(
      "/absence_notices",
      expect.arrayContaining([
        expect.objectContaining({
          student_id: "student-1",
          class_id: "class-1",
          note: "detalhe privado",
        }),
      ]),
      { Prefer: "return=representation" }
    );
    expect(mockListClassHeadsByClassIds).toHaveBeenCalledWith({
      organizationId: "org-1",
      classIds: ["class-1"],
    });
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        recipientUserId: "trainer-1",
        type: "absence_notice_created",
        title: "Novo aviso de ausência",
        sourceType: "absence_notice",
        sourceId: "notice-1",
        actionUrl: "/prof/absence-notices",
        sendPush: true,
        dedupe: true,
      })
    );
    const notificationInput = mockCreateNotification.mock.calls[0][0];
    expect(notificationInput.body).toContain("Gustavo Ribeiro");
    expect(notificationInput.body).toContain("Turma 10-12");
    expect(notificationInput.body).not.toContain("detalhe privado");
  });

  test("does not create fake notification when the class has no responsible", async () => {
    mockListClassHeadsByClassIds.mockResolvedValue([]);

    await createAbsenceNotice({
      studentId: "student-1",
      classId: "class-1",
      date: "2026-07-09",
      reason: "Doença",
    });

    expect(mockSupabasePost).toHaveBeenCalled();
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  test("does not notify or push to the acting user when they are also responsible", async () => {
    mockGetSessionUserId.mockResolvedValue("trainer-1");

    await createAbsenceNotice({
      studentId: "student-1",
      classId: "class-1",
      date: "2026-07-09",
      reason: "Doença",
    });

    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  test("keeps absence creation successful when notification or push fails", async () => {
    mockCreateNotification.mockRejectedValue(new Error("push failed"));

    await expect(
      createAbsenceNotice({
        studentId: "student-1",
        classId: "class-1",
        date: "2026-07-09",
        reason: "Doença",
      })
    ).resolves.toBeUndefined();

    expect(mockSupabasePost).toHaveBeenCalled();
  });

  test("status update skips the acting user and deduplicates responsible notification", async () => {
    mockGetSessionUserId.mockResolvedValue("trainer-1");
    mockListClassHeadsByClassIds.mockResolvedValue([
      {
        classId: "class-1",
        userId: "trainer-1",
        className: "Turma 10-12",
        unit: "Rede Esportes Pinhais",
        displayName: "Professor 1",
        email: null,
      },
      {
        classId: "class-1",
        userId: "trainer-2",
        className: "Turma 10-12",
        unit: "Rede Esportes Pinhais",
        displayName: "Professor 2",
        email: null,
      },
      {
        classId: "class-1",
        userId: "trainer-2",
        className: "Turma 10-12",
        unit: "Rede Esportes Pinhais",
        displayName: "Professor 2",
        email: null,
      },
    ]);

    await updateAbsenceNoticeStatus("notice-1", "confirmed");

    expect(mockSupabasePatch).toHaveBeenCalledWith(
      "/absence_notices?id=eq.notice-1&organization_id=eq.org-1",
      { status: "confirmed" }
    );
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "trainer-2",
        type: "absence_notice_status_changed",
        sourceId: "notice-1",
        dedupe: true,
      })
    );
  });
});
