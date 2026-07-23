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
});
