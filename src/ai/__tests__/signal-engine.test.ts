/* eslint-disable import/first */
const mockListAdminPendingSessionLogs = jest.fn();
const mockGetClasses = jest.fn();
const mockGetClassStudentRecords = jest.fn();
const mockGetAttendanceSignalRecords = jest.fn();
const mockGetSessionLogsByRange = jest.fn();
const mockListCheckinsByRange = jest.fn();
let mockIdentity = { userId: "user-a", generation: 1 };
let mockActiveOrganization = "org_1";
let mockCacheGeneration = 1;

jest.mock("../../auth/session", () => ({
  getSessionIdentity: () => ({ ...mockIdentity }),
  assertSessionIdentity: (identity: typeof mockIdentity) => {
    if (identity.userId !== mockIdentity.userId || identity.generation !== mockIdentity.generation) throw new Error("Session changed");
  },
  SessionIdentityChangedError: class extends Error {},
}));
jest.mock("../../db/client", () => ({
  getActiveOrganizationId: async () => mockActiveOrganization,
  getReadCacheGeneration: () => mockCacheGeneration,
}));

jest.mock("../../api/reports", () => ({
  listAdminPendingSessionLogs: (...args: unknown[]) =>
    mockListAdminPendingSessionLogs(...args),
}));

jest.mock("../../db/seed", () => ({
  getClasses: (...args: unknown[]) => mockGetClasses(...args),
  getClassStudentRecords: (...args: unknown[]) => mockGetClassStudentRecords(...args),
  getAttendanceSignalRecords: (...args: unknown[]) => mockGetAttendanceSignalRecords(...args),
  getSessionLogsByRange: (...args: unknown[]) =>
    mockGetSessionLogsByRange(...args),
}));

jest.mock("../../data/attendance-checkins", () => ({
  listCheckinsByRange: (...args: unknown[]) => mockListCheckinsByRange(...args),
}));

import {
  __clearSignalEngineCacheForTests,
  getSignals,
} from "../signal-engine";

const nowIso = "2026-02-19T12:00:00.000Z";

describe("signal engine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __clearSignalEngineCacheForTests();
    mockIdentity = { userId: "user-a", generation: 1 };
    mockActiveOrganization = "org_1";
    mockCacheGeneration = 1;
    mockGetClasses.mockResolvedValue([
      { id: "c_1", name: "Sub 12-14" },
      { id: "c_2", name: "Sub 17-19" },
    ]);
    mockGetClassStudentRecords.mockResolvedValue([
      { id: "s_1", name: "Aluno 1", classId: "c_1" },
      { id: "s_2", name: "Aluno 2", classId: "c_1" },
      { id: "s_3", name: "Aluno 3", classId: "c_1" },
      { id: "s_4", name: "Aluno 4", classId: "c_1" },
      { id: "s_5", name: "Aluno 5", classId: "c_2" },
      { id: "s_6", name: "Aluno 6", classId: "c_2" },
    ]);
    mockGetAttendanceSignalRecords.mockResolvedValue([]);
    mockGetSessionLogsByRange.mockResolvedValue([]);
    mockListAdminPendingSessionLogs.mockResolvedValue([]);
    mockListCheckinsByRange.mockResolvedValue([]);
  });
  afterEach(() => jest.restoreAllMocks());

  test("the five-field student projection preserves signal output without full profiles", async () => {
    const full = [{ id: "s_1", name: "Aluno 1", classId: "c_1", organizationId: "org_1", photoUrl: "fixture.jpg", healthIssueNotes: "Informação não consumida" }];
    mockGetClassStudentRecords.mockResolvedValue(full);
    mockGetAttendanceSignalRecords.mockResolvedValue([18, 17, 16].map(day => ({ studentId: "s_1", date: `2026-02-${day}`, status: "faltou", createdAt: `2026-02-${day}T12:00:00Z` })));
    const reference = await getSignals({ organizationId: "org_1", nowIso });
    expect(reference.some(signal => signal.type === "repeated_absence")).toBe(true);
    __clearSignalEngineCacheForTests();
    mockGetClassStudentRecords.mockResolvedValue(full.map(({ id, name, classId, organizationId, photoUrl }) => ({ id, name, classId, organizationId, photoUrl })));
    expect(await getSignals({ organizationId: "org_1", nowIso })).toEqual(reference);
    expect(mockGetClassStudentRecords).toHaveBeenLastCalledWith({ organizationId: "org_1" });
  });

  test("creates attendance_drop when recent average declines with threshold", async () => {
    mockGetSessionLogsByRange.mockResolvedValue([
      { classId: "c_1", attendance: 0.9, createdAt: "2026-01-23T12:00:00.000Z" },
      { classId: "c_1", attendance: 0.86, createdAt: "2026-01-29T12:00:00.000Z" },
      { classId: "c_1", attendance: 0.62, createdAt: "2026-02-13T12:00:00.000Z" },
      { classId: "c_1", attendance: 0.58, createdAt: "2026-02-18T12:00:00.000Z" },
    ]);

    const signals = await getSignals({ organizationId: "org_1", nowIso });
    const target = signals.find((item) => item.type === "attendance_drop");
    expect(target).toBeTruthy();
    expect(target?.severity).toBe("high");
    expect(target?.classId).toBe("c_1");
  });

  test("creates repeated_absence for 3 latest absences within 30 days", async () => {
    mockGetAttendanceSignalRecords.mockResolvedValue([
      { studentId: "s_1", classId: "c_1", status: "faltou", date: "2026-02-18", createdAt: "2026-02-18T10:00:00.000Z" },
      { studentId: "s_1", classId: "c_1", status: "faltou", date: "2026-02-17", createdAt: "2026-02-17T10:00:00.000Z" },
      { studentId: "s_1", classId: "c_1", status: "faltou", date: "2026-02-16", createdAt: "2026-02-16T10:00:00.000Z" },
      { studentId: "s_1", classId: "c_1", status: "faltou", date: "2026-02-15", createdAt: "2026-02-15T10:00:00.000Z" },
      { studentId: "s_1", classId: "c_1", status: "presente", date: "2026-02-14", createdAt: "2026-02-14T10:00:00.000Z" },
    ]);

    const signals = await getSignals({ organizationId: "org_1", nowIso });
    const target = signals.find((item) => item.type === "repeated_absence");
    expect(target).toBeTruthy();
    expect(target?.severity).toBe("high");
    expect(target?.studentId).toBe("s_1");
  });

  test("minimal attendance fields produce identical signals, retaining history beyond 42 days and same-day createdAt ordering", async () => {
    const full = [
      { id: "a", studentId: "s_1", date: "2026-02-18", status: "presente", createdAt: "2026-02-18T08:00:00Z" },
      ...[12, 13, 14].map(hour => ({ id: `b${hour}`, studentId: "s_1", date: "2026-02-18", status: "faltou", createdAt: `2026-02-18T${hour}:00:00Z` })),
      ...[18, 17, 16].map(day => ({ id: `c${day}`, studentId: "s_2", date: `2026-02-${day}`, status: "faltou", createdAt: `2026-02-${day}T10:00:00Z` })),
      { id: "old", studentId: "s_2", date: "2026-01-01", status: "faltou", createdAt: "2026-01-01T10:00:00Z" },
    ].map(item => ({ ...item, classId: "c_1", note: "Nota fictícia não usada pelo sinal", painScore: 2 }));
    mockGetAttendanceSignalRecords.mockResolvedValue(full);
    const reference = await getSignals({ organizationId: "org_1", nowIso });
    expect(reference.find(signal => signal.studentId === "s_1" && signal.type === "repeated_absence")?.severity).toBe("medium");
    expect(reference.find(signal => signal.studentId === "s_2" && signal.type === "repeated_absence")?.severity).toBe("high");
    __clearSignalEngineCacheForTests();
    mockGetAttendanceSignalRecords.mockResolvedValue(full.map(({ id, studentId, date, status, createdAt }) => ({ id, studentId, date, status, createdAt })));
    expect(await getSignals({ organizationId: "org_1", nowIso })).toEqual(reference);
    expect(mockGetAttendanceSignalRecords).toHaveBeenLastCalledWith({ organizationId: "org_1" });
  });

  test("creates report_delay severity by 7/14 day windows", async () => {
    mockListAdminPendingSessionLogs.mockResolvedValue([
      {
        classId: "c_1",
        className: "Sub 12-14",
        unit: "Rede",
        periodStart: "2026-02-01",
        lastReportAt: "2026-02-10T00:00:00.000Z",
      },
      {
        classId: "c_2",
        className: "Sub 17-19",
        unit: "Rede",
        periodStart: "2026-02-01",
        lastReportAt: "2026-02-03T00:00:00.000Z",
      },
    ]);

    const signals = await getSignals({ organizationId: "org_1", nowIso });
    const medium = signals.find(
      (item) => item.type === "report_delay" && item.classId === "c_1"
    );
    const high = signals.find(
      (item) => item.type === "report_delay" && item.classId === "c_2"
    );
    expect(medium?.severity).toBe("medium");
    expect(high?.severity).toBe("high");
  });

  test("builds unusual_presence_pattern using NFC check-ins", async () => {
    mockListCheckinsByRange.mockResolvedValue([
      { classId: "c_1", checkedInAt: "2026-02-16T10:00:00.000Z" },
      { classId: "c_1", checkedInAt: "2026-02-16T10:01:00.000Z" },
      { classId: "c_1", checkedInAt: "2026-02-16T10:02:00.000Z" },
      { classId: "c_1", checkedInAt: "2026-02-16T10:03:00.000Z" },
      { classId: "c_1", checkedInAt: "2026-02-16T10:04:00.000Z" },
      { classId: "c_1", checkedInAt: "2026-02-16T10:05:00.000Z" },
      { classId: "c_1", checkedInAt: "2026-02-17T10:00:00.000Z" },
      { classId: "c_1", checkedInAt: "2026-02-17T10:01:00.000Z" },
      { classId: "c_1", checkedInAt: "2026-02-17T10:02:00.000Z" },
      { classId: "c_1", checkedInAt: "2026-02-17T10:03:00.000Z" },
      { classId: "c_1", checkedInAt: "2026-02-17T10:04:00.000Z" },
      { classId: "c_1", checkedInAt: "2026-02-17T10:05:00.000Z" },
      { classId: "c_1", checkedInAt: "2026-02-18T10:00:00.000Z" },
      { classId: "c_1", checkedInAt: "2026-02-18T10:01:00.000Z" },
    ]);

    const signals = await getSignals({ organizationId: "org_1", nowIso });
    const target = signals.find(
      (item) => item.type === "unusual_presence_pattern"
    );
    expect(target).toBeTruthy();
    expect(target?.severity).toBe("high");
  });

  test("creates engagement_risk as critical when multiple strong conditions match", async () => {
    mockGetSessionLogsByRange.mockResolvedValue([
      { classId: "c_1", attendance: 0.92, createdAt: "2026-01-24T12:00:00.000Z" },
      { classId: "c_1", attendance: 0.9, createdAt: "2026-01-30T12:00:00.000Z" },
      { classId: "c_1", attendance: 0.6, createdAt: "2026-02-14T12:00:00.000Z" },
      { classId: "c_1", attendance: 0.58, createdAt: "2026-02-18T12:00:00.000Z" },
      { classId: "c_2", attendance: 0.88, createdAt: "2026-01-24T12:00:00.000Z" },
      { classId: "c_2", attendance: 0.86, createdAt: "2026-01-30T12:00:00.000Z" },
      { classId: "c_2", attendance: 0.61, createdAt: "2026-02-13T12:00:00.000Z" },
      { classId: "c_2", attendance: 0.59, createdAt: "2026-02-18T12:00:00.000Z" },
    ]);
    mockListAdminPendingSessionLogs.mockResolvedValue([
      { classId: "c_1", className: "Sub 12-14", unit: "Rede", periodStart: "2026-02-01", lastReportAt: "2026-02-10T00:00:00.000Z" },
      { classId: "c_2", className: "Sub 17-19", unit: "Rede", periodStart: "2026-02-01", lastReportAt: "2026-02-10T00:00:00.000Z" },
      { classId: "c_3", className: "Sub 10-12", unit: "Rede", periodStart: "2026-02-01", lastReportAt: null },
    ]);

    const signals = await getSignals({ organizationId: "org_1", nowIso });
    const engagement = signals.find((item) => item.type === "engagement_risk");
    expect(engagement).toBeTruthy();
    expect(engagement?.severity).toBe("critical");
    expect(engagement?.title).toBe("Risco geral de engajamento");
    expect(engagement?.summary).toContain("combinação de faltas");
    expect(signals[0].type).toBe("engagement_risk");
  });

  test("four concurrent consumers share one full read and the settled TTL result", async () => {
    let release!: (rows: unknown[]) => void;
    mockGetAttendanceSignalRecords.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const requests = Array.from({ length: 4 }, () => getSignals({ organizationId: "org_1" }));
    for (let tick = 0; tick < 15; tick++) await Promise.resolve();
    expect(mockGetAttendanceSignalRecords).toHaveBeenCalledTimes(1);
    expect(mockGetAttendanceSignalRecords).toHaveBeenCalledWith({ organizationId: "org_1" });
    expect(mockGetClassStudentRecords).toHaveBeenCalledWith({ organizationId: "org_1" });
    release([]);
    const signals = await Promise.all(requests);
    expect(signals.every(value => value === signals[0])).toBe(true);
    expect(await getSignals({ organizationId: "org_1" })).toBe(signals[0]);
    expect(mockGetAttendanceSignalRecords).toHaveBeenCalledTimes(1);
  });

  test("TTL expires by wall time even with a fixed explicit historical analysis time", async () => {
    const clock = jest.spyOn(Date, "now").mockReturnValue(100_000);
    await getSignals({ organizationId: "org_1", nowIso });
    clock.mockReturnValue(159_999);
    await getSignals({ organizationId: "org_1", nowIso });
    expect(mockGetAttendanceSignalRecords).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(160_000);
    await getSignals({ organizationId: "org_1", nowIso });
    expect(mockGetAttendanceSignalRecords).toHaveBeenCalledTimes(2);
  });

  test("explicit analysis times and requested organizations never coalesce", async () => {
    await Promise.all([
      getSignals({ organizationId: "org_1", nowIso }),
      getSignals({ organizationId: "org_1", nowIso: "2026-02-20T12:00:00Z" }),
      getSignals({ organizationId: "org-authorized-other", nowIso }),
    ]);
    expect(mockGetAttendanceSignalRecords).toHaveBeenCalledTimes(3);
    expect(mockGetAttendanceSignalRecords).toHaveBeenCalledWith({ organizationId: "org-authorized-other" });
  });

  test.each(["user", "session", "organization", "generation", "round trip"])("a pending %s change rejects every consumer and cannot populate the current cache", async kind => {
    let release!: (rows: unknown[]) => void;
    mockGetAttendanceSignalRecords.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const requests = [getSignals({ organizationId: "org_1", nowIso }), getSignals({ organizationId: "org_1", nowIso })];
    const settled = Promise.allSettled(requests);
    for (let tick = 0; tick < 15; tick++) await Promise.resolve();
    expect(mockGetAttendanceSignalRecords).toHaveBeenCalledTimes(1);
    if (kind === "user") mockIdentity.userId = "user-b";
    if (kind === "session") mockIdentity.generation++;
    if (kind === "organization") mockActiveOrganization = "org-b";
    if (kind === "generation") mockCacheGeneration++;
    if (kind === "round trip") mockCacheGeneration += 2;
    await getSignals({ organizationId: "org_1", nowIso });
    release([]);
    expect((await settled).every(value => value.status === "rejected")).toBe(true);
    expect(mockGetAttendanceSignalRecords).toHaveBeenCalledTimes(2);
    await getSignals({ organizationId: "org_1", nowIso });
    expect(mockGetAttendanceSignalRecords).toHaveBeenCalledTimes(2);
  });

  test("a failed shared load rejects all consumers and the next call retries", async () => {
    const error = new Error("read failed");
    mockGetAttendanceSignalRecords.mockRejectedValueOnce(error);
    const results = await Promise.allSettled([getSignals({ organizationId: "org_1", nowIso }), getSignals({ organizationId: "org_1", nowIso })]);
    expect(results.every(value => value.status === "rejected" && value.reason === error)).toBe(true);
    expect(mockGetAttendanceSignalRecords).toHaveBeenCalledTimes(1);
    await getSignals({ organizationId: "org_1", nowIso });
    expect(mockGetAttendanceSignalRecords).toHaveBeenCalledTimes(2);
  });

  test("an expired session never reads data or serves the previous user's cached result", async () => {
    await getSignals({ organizationId: "org_1", nowIso });
    mockIdentity = { userId: "", generation: 2 };
    await expect(getSignals({ organizationId: "org_1", nowIso })).rejects.toThrow("Sessão expirada");
    expect(mockGetAttendanceSignalRecords).toHaveBeenCalledTimes(1);
  });
});

