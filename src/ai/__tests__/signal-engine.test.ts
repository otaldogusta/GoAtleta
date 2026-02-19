/* eslint-disable import/first */
const listAdminPendingSessionLogsMock = jest.fn();
const getClassesMock = jest.fn();
const getStudentsMock = jest.fn();
const getAttendanceAllMock = jest.fn();
const getSessionLogsByRangeMock = jest.fn();
const listCheckinsByRangeMock = jest.fn();

jest.mock("../../api/reports", () => ({
  listAdminPendingSessionLogs: (...args: unknown[]) =>
    listAdminPendingSessionLogsMock(...args),
}));

jest.mock("../../db/seed", () => ({
  getClasses: (...args: unknown[]) => getClassesMock(...args),
  getStudents: (...args: unknown[]) => getStudentsMock(...args),
  getAttendanceAll: (...args: unknown[]) => getAttendanceAllMock(...args),
  getSessionLogsByRange: (...args: unknown[]) =>
    getSessionLogsByRangeMock(...args),
}));

jest.mock("../../data/attendance-checkins", () => ({
  listCheckinsByRange: (...args: unknown[]) => listCheckinsByRangeMock(...args),
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
    getClassesMock.mockResolvedValue([
      { id: "c_1", name: "Sub 12-14" },
      { id: "c_2", name: "Sub 17-19" },
    ]);
    getStudentsMock.mockResolvedValue([
      { id: "s_1", name: "Aluno 1", classId: "c_1" },
      { id: "s_2", name: "Aluno 2", classId: "c_1" },
      { id: "s_3", name: "Aluno 3", classId: "c_1" },
      { id: "s_4", name: "Aluno 4", classId: "c_1" },
      { id: "s_5", name: "Aluno 5", classId: "c_2" },
      { id: "s_6", name: "Aluno 6", classId: "c_2" },
    ]);
    getAttendanceAllMock.mockResolvedValue([]);
    getSessionLogsByRangeMock.mockResolvedValue([]);
    listAdminPendingSessionLogsMock.mockResolvedValue([]);
    listCheckinsByRangeMock.mockResolvedValue([]);
  });

  test("creates attendance_drop when recent average declines with threshold", async () => {
    getSessionLogsByRangeMock.mockResolvedValue([
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
    getAttendanceAllMock.mockResolvedValue([
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

  test("creates report_delay severity by 7/14 day windows", async () => {
    listAdminPendingSessionLogsMock.mockResolvedValue([
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
    listCheckinsByRangeMock.mockResolvedValue([
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
    getSessionLogsByRangeMock.mockResolvedValue([
      { classId: "c_1", attendance: 0.92, createdAt: "2026-01-24T12:00:00.000Z" },
      { classId: "c_1", attendance: 0.9, createdAt: "2026-01-30T12:00:00.000Z" },
      { classId: "c_1", attendance: 0.6, createdAt: "2026-02-14T12:00:00.000Z" },
      { classId: "c_1", attendance: 0.58, createdAt: "2026-02-18T12:00:00.000Z" },
      { classId: "c_2", attendance: 0.88, createdAt: "2026-01-24T12:00:00.000Z" },
      { classId: "c_2", attendance: 0.86, createdAt: "2026-01-30T12:00:00.000Z" },
      { classId: "c_2", attendance: 0.61, createdAt: "2026-02-13T12:00:00.000Z" },
      { classId: "c_2", attendance: 0.59, createdAt: "2026-02-18T12:00:00.000Z" },
    ]);
    listAdminPendingSessionLogsMock.mockResolvedValue([
      { classId: "c_1", className: "Sub 12-14", unit: "Rede", periodStart: "2026-02-01", lastReportAt: "2026-02-10T00:00:00.000Z" },
      { classId: "c_2", className: "Sub 17-19", unit: "Rede", periodStart: "2026-02-01", lastReportAt: "2026-02-10T00:00:00.000Z" },
      { classId: "c_3", className: "Sub 10-12", unit: "Rede", periodStart: "2026-02-01", lastReportAt: null },
    ]);

    const signals = await getSignals({ organizationId: "org_1", nowIso });
    const engagement = signals.find((item) => item.type === "engagement_risk");
    expect(engagement).toBeTruthy();
    expect(engagement?.severity).toBe("critical");
    expect(signals[0].type).toBe("engagement_risk");
  });
});
