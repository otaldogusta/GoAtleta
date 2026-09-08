/* eslint-disable import/first */
const mockSupabaseRestGet = jest.fn();
const mockAddBreadcrumb = jest.fn();

jest.mock("@sentry/react-native", () => ({
  addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args),
}));

jest.mock("../rest", () => ({
  supabaseRestGet: (...args: unknown[]) => mockSupabaseRestGet(...args),
}));

import { listAdminPendingAttendance, listAdminPendingSessionLogs } from "../reports";

describe("reports api", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseRestGet.mockResolvedValue([]);
  });

  test("shares the class schedule request across concurrent dashboard loads", async () => {
    await Promise.all([
      listAdminPendingAttendance({ organizationId: "org_1" }),
      listAdminPendingSessionLogs({ organizationId: "org_1" }),
    ]);

    const classScheduleCalls = mockSupabaseRestGet.mock.calls.filter(([path]) =>
      String(path).startsWith("/classes?")
    );

    expect(classScheduleCalls).toHaveLength(1);
    expect(classScheduleCalls[0]?.[0]).toContain(
      "select=id,days,daysperweek,starttime,end_time,duration,gender"
    );
  });

  test("does not request attendance for an explicitly suspended lesson", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 7, 20));
    mockSupabaseRestGet.mockImplementation(async (path: string) => {
      if (path.startsWith("/classes?")) return [{ id: "paused", days: [1], starttime: "09:00", end_time: "10:00", duration: 60 }];
      if (path.startsWith("/class_calendar_exceptions?")) return [{ class_id: "paused", date: "2026-09-07" }];
      if (path.startsWith("/v_admin_pending_attendance?")) return [{ organization_id: "holiday-org", class_id: "paused", class_name: "Turma", target_date: "2026-09-07" }];
      return [];
    });
    try { expect(await listAdminPendingAttendance({ organizationId: "holiday-org" })).toEqual([]); }
    finally { jest.useRealTimers(); }
  });
});
