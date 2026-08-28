import type { AttendanceRecord, ClassGroup } from "../../core/models";

const mockSupabaseDelete = jest.fn();
const mockSupabasePatch = jest.fn();
const mockSupabasePost = jest.fn();

jest.mock("../client", () => ({
  getActiveOrganizationId: jest.fn(() => Promise.resolve("org-1")),
  isAuthError: jest.fn(() => false),
  isMissingRelation: jest.fn(() => false),
  isNetworkError: jest.fn(() => false),
  supabaseDelete: (...args: unknown[]) => mockSupabaseDelete(...args),
  supabaseGet: jest.fn(() => Promise.resolve([])),
  supabasePatch: (...args: unknown[]) => mockSupabasePatch(...args),
  supabasePost: (...args: unknown[]) => mockSupabasePost(...args),
}));

// eslint-disable-next-line import/first -- client persistence is mocked before loading the module
import {
  syncTrainingSessionFromAttendance,
  syncTrainingSessionFromReport,
  upsertTrainingSession,
} from "../training-sessions";

type StoredRow = Record<string, unknown>;

const classInfo = {
  id: "class-1",
  organizationId: "org-1",
  name: "Águias",
  startTime: "18:00",
  durationMinutes: 60,
} as ClassGroup;

const attendanceRecord = {
  id: "attendance-1",
  classId: classInfo.id,
  studentId: "student-1",
  date: "2026-08-25",
  status: "presente",
  note: "Participou normalmente",
  painScore: 0,
  createdAt: "2026-08-25T21:00:00.000Z",
} as AttendanceRecord;

const baseSession = {
  classIds: [classInfo.id],
  startAt: "2026-08-25T21:00:00.000Z",
  endAt: "2026-08-25T22:00:00.000Z",
  title: classInfo.name,
  description: "Descrição da sessão",
  organizationId: "org-1",
} as const;

describe("training session attendance and report composition", () => {
  let storedSession: StoredRow | null;
  let storedAttendance: StoredRow[];

  beforeEach(() => {
    jest.clearAllMocks();
    storedSession = null;
    storedAttendance = [];

    mockSupabasePost.mockImplementation(
      async (path: string, body: unknown, headers?: Record<string, string>) => {
        const rows = body as StoredRow[];
        if (path === "/training_sessions?on_conflict=id") {
          const next = rows[0];
          if (!storedSession) {
            storedSession = { ...next };
          } else if (headers?.Prefer === "resolution=merge-duplicates") {
            storedSession = { ...storedSession, ...next };
          }
        } else if (path === "/training_session_attendance") {
          storedAttendance = rows.map((row) => ({ ...row }));
        }
        return [];
      },
    );
    mockSupabasePatch.mockImplementation(async (path: string, body: unknown) => {
      if (path.startsWith("/training_sessions?id=eq.")) {
        storedSession = { ...(storedSession ?? {}), ...(body as StoredRow) };
      }
      return [];
    });
    mockSupabaseDelete.mockImplementation(async (path: string) => {
      if (path.startsWith("/training_session_attendance?")) {
        storedAttendance = [];
      }
    });
  });

  it("preserves attendance when the patch omits it", async () => {
    storedAttendance = [{ student_id: "student-existing" }];

    await upsertTrainingSession(baseSession);

    expect(storedAttendance).toEqual([{ student_id: "student-existing" }]);
    expect(
      mockSupabaseDelete.mock.calls.filter(([path]) =>
        String(path).startsWith("/training_session_attendance?"),
      ),
    ).toHaveLength(0);
  });

  it("clears attendance only when an explicit empty array is provided", async () => {
    storedAttendance = [{ student_id: "student-existing" }];

    await upsertTrainingSession({ ...baseSession, attendance: [] });

    expect(storedAttendance).toEqual([]);
    expect(mockSupabaseDelete).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/training_session_attendance\?session_id=eq\.[^&]+&organization_id=eq\.org-1$/,
      ),
    );
    expect(
      mockSupabasePost.mock.calls.filter(
        ([path]) => path === "/training_session_attendance",
      ),
    ).toHaveLength(0);
  });

  it("replaces attendance and keeps the organization scope in filter and rows", async () => {
    storedAttendance = [{ student_id: "student-existing" }];

    await upsertTrainingSession({
      ...baseSession,
      attendance: [
        {
          id: attendanceRecord.id,
          sessionId: "",
          studentId: attendanceRecord.studentId,
          classId: attendanceRecord.classId,
          organizationId: "org-1",
          status: "present",
          note: attendanceRecord.note,
          painScore: attendanceRecord.painScore ?? 0,
          createdAt: attendanceRecord.createdAt,
          updatedAt: attendanceRecord.createdAt,
        },
      ],
    });

    expect(storedAttendance).toEqual([
      expect.objectContaining({
        student_id: attendanceRecord.studentId,
        organization_id: "org-1",
        status: "present",
      }),
    ]);
    expect(mockSupabaseDelete).toHaveBeenCalledWith(
      expect.stringContaining("&organization_id=eq.org-1"),
    );
  });

  it("persists an empty attendance note as an empty string", async () => {
    await syncTrainingSessionFromAttendance({
      classInfo,
      date: attendanceRecord.date,
      records: [{ ...attendanceRecord, note: "   " }],
      organizationId: "org-1",
    });

    expect(storedAttendance).toEqual([
      expect.objectContaining({
        student_id: attendanceRecord.studentId,
        note: "",
      }),
    ]);
  });

  it("keeps report description and attendance when attendance is saved first", async () => {
    await syncTrainingSessionFromAttendance({
      classInfo,
      date: attendanceRecord.date,
      records: [attendanceRecord],
      organizationId: "org-1",
    });
    await syncTrainingSessionFromReport({
      classInfo,
      createdAt: "2026-08-25T12:00:00.000Z",
      report: {
        activity: "Jogo reduzido com recepção",
        conclusion: "A turma sustentou três contatos",
        attendance: 100,
      },
      organizationId: "org-1",
    });

    expect(storedSession?.description).toBe(
      "Jogo reduzido com recepção • A turma sustentou três contatos • Presença 100%",
    );
    expect(storedAttendance).toHaveLength(1);
  });

  it("does not let a later attendance save overwrite the report description", async () => {
    await syncTrainingSessionFromReport({
      classInfo,
      createdAt: "2026-08-25T12:00:00.000Z",
      report: {
        activity: "Circuito técnico",
        conclusion: "Evolução na manchete",
      },
      organizationId: "org-1",
    });
    await syncTrainingSessionFromAttendance({
      classInfo,
      date: attendanceRecord.date,
      records: [attendanceRecord],
      organizationId: "org-1",
    });

    expect(storedSession?.description).toBe(
      "Circuito técnico • Evolução na manchete",
    );
    expect(storedAttendance).toHaveLength(1);
    expect(mockSupabasePatch).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/training_sessions\?id=eq\.[^&]+&organization_id=eq\.org-1$/,
      ),
      expect.not.objectContaining({ description: expect.anything() }),
    );
  });

  it("keeps report authority when report and attendance overlap", async () => {
    await Promise.all([
      syncTrainingSessionFromAttendance({
        classInfo,
        date: attendanceRecord.date,
        records: [attendanceRecord],
        organizationId: "org-1",
      }),
      syncTrainingSessionFromReport({
        classInfo,
        createdAt: "2026-08-25T12:00:00.000Z",
        report: { activity: "Aula realizada", conclusion: "Objetivo confirmado" },
        organizationId: "org-1",
      }),
    ]);

    expect(storedSession?.description).toBe(
      "Aula realizada • Objetivo confirmado",
    );
    expect(storedAttendance).toHaveLength(1);
    expect(
      mockSupabasePost.mock.calls.find(
        ([path, , headers]) =>
          path === "/training_sessions?on_conflict=id" &&
          headers?.Prefer === "resolution=ignore-duplicates",
      ),
    ).toBeDefined();
  });
});
