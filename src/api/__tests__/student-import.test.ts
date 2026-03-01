/* eslint-disable import/first */
const mockGetValidAccessToken = jest.fn();
const mockForceRefreshAccessToken = jest.fn();
const mockMeasureAsync = jest.fn();
const mockSupabaseRestGet = jest.fn();
const mockAddBreadcrumb = jest.fn();

jest.mock("../../auth/session", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
  forceRefreshAccessToken: (...args: unknown[]) => mockForceRefreshAccessToken(...args),
}));

jest.mock("../../observability/perf", () => ({
  measureAsync: (...args: unknown[]) => mockMeasureAsync(...args),
}));

jest.mock("@sentry/react-native", () => ({
  addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args),
}));

jest.mock("../config", () => ({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
}));

jest.mock("../rest", () => ({
  supabaseRestGet: (...args: unknown[]) => mockSupabaseRestGet(...args),
}));

import {
  applyStudentsImport,
  getStudentImportRunLogs,
  listStudentImportRuns,
  previewStudentsImport,
} from "../student-import";

describe("student import api", () => {
  const originalFetch = global.fetch;
  const jwtToken = "header.payload.signature";

  beforeEach(() => {
    jest.clearAllMocks();
    mockMeasureAsync.mockImplementation((_name: string, fn: () => Promise<unknown>) => fn());
    mockForceRefreshAccessToken.mockResolvedValue("");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("previewStudentsImport calls function endpoint", async () => {
    mockGetValidAccessToken.mockResolvedValue(jwtToken);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          status: "preview",
          mode: "preview",
          runId: "run_preview_1",
          sourceSha256: "sha123",
          summary: {
            totalRows: 1,
            create: 1,
            update: 0,
            conflict: 0,
            skip: 0,
            error: 0,
            confidenceHigh: 1,
            confidenceMedium: 0,
            confidenceLow: 0,
            flags: {},
          },
          rows: [],
          idempotent: false,
        }),
    } as Response);

    const result = await previewStudentsImport({
      organizationId: "org_1",
      policy: "misto",
      rows: [{ name: "Aluno 1", className: "Turma 10-12" }],
    });

    expect(result.status).toBe("preview");
    expect(result.runId).toBe("run_preview_1");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://project.supabase.co/functions/v1/students-import",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Bearer ${jwtToken}`,
          apikey: "anon-key",
        }),
      })
    );
  });

  test("applyStudentsImport surfaces server error", async () => {
    mockGetValidAccessToken.mockResolvedValue(jwtToken);
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ error: "Forbidden" }),
    } as Response);

    await expect(
      applyStudentsImport({
        organizationId: "org_1",
        policy: "misto",
        rows: [{ name: "Aluno 1" }],
      })
    ).rejects.toThrow("Forbidden");
  });

  test("previewStudentsImport retries once after 401 with refreshed token", async () => {
    mockGetValidAccessToken.mockResolvedValue("bad-token");
    mockForceRefreshAccessToken.mockResolvedValue(jwtToken);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: "Invalid JWT" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: "preview",
            mode: "preview",
            runId: "run_preview_retry",
            sourceSha256: "sha456",
            summary: {
              totalRows: 1,
              create: 1,
              update: 0,
              conflict: 0,
              skip: 0,
              error: 0,
              confidenceHigh: 1,
              confidenceMedium: 0,
              confidenceLow: 0,
              flags: {},
            },
            rows: [],
            idempotent: false,
          }),
      } as Response);

    const result = await previewStudentsImport({
      organizationId: "org_1",
      policy: "misto",
      rows: [{ name: "Aluno 1" }],
    });

    expect(result.runId).toBe("run_preview_retry");
    expect(mockForceRefreshAccessToken).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("applyStudentsImport maps Invalid JWT to friendly auth message", async () => {
    mockGetValidAccessToken.mockResolvedValue(jwtToken);
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: "Invalid JWT" }),
    } as Response);

    await expect(
      applyStudentsImport({
        organizationId: "org_1",
        policy: "misto",
        rows: [{ name: "Aluno 1" }],
      })
    ).rejects.toThrow("Sessao expirada. Faca login novamente.");
  });

  test("listStudentImportRuns maps rows", async () => {
    mockSupabaseRestGet.mockResolvedValue([
      {
        id: "run_1",
        organization_id: "org_1",
        created_by: "user_1",
        source_filename: "file.csv",
        source_sha256: "sha",
        mode: "preview",
        policy: "misto",
        status: "preview",
        summary: null,
        created_at: "2026-02-28T10:00:00.000Z",
        applied_at: null,
      },
    ]);

    const runs = await listStudentImportRuns("org_1", 5);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      id: "run_1",
      organizationId: "org_1",
      createdBy: "user_1",
    });
  });

  test("getStudentImportRunLogs maps logs", async () => {
    mockSupabaseRestGet.mockResolvedValue([
      {
        id: "log_1",
        run_id: "run_1",
        row_number: 10,
        action: "conflict",
        matched_by: "name+birthdate",
        confidence: "low",
        student_id: null,
        class_id: null,
        incoming: { name: "Aluno 1" },
        patch: null,
        conflicts: { birthdate: { incoming: "1980-01-01" } },
        flags: ["BIRTHDATE_CONFLICT"],
        error_message: null,
        created_at: "2026-02-28T10:00:00.000Z",
      },
    ]);

    const logs = await getStudentImportRunLogs("run_1", 20, 0);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      id: "log_1",
      runId: "run_1",
      rowNumber: 10,
      action: "conflict",
      flags: ["BIRTHDATE_CONFLICT"],
    });
  });
});
