/* eslint-disable import/first */
const supabaseRestRequestMock = jest.fn();
const supabaseRestGetMock = jest.fn();
const queueNfcCheckinWriteMock = jest.fn();

jest.mock("../../api/rest", () => ({
  supabaseRestRequest: (...args: unknown[]) => supabaseRestRequestMock(...args),
  supabaseRestGet: (...args: unknown[]) => supabaseRestGetMock(...args),
}));

jest.mock("../../db/seed", () => ({
  queueNfcCheckinWrite: (...args: unknown[]) => queueNfcCheckinWriteMock(...args),
}));

import {
  buildCheckinIdempotencyKey,
  createCheckinWithFallback,
  shouldQueueNfcCheckinError,
} from "../attendance-checkins";

describe("attendance checkins", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("remote success returns synced status", async () => {
    supabaseRestRequestMock.mockResolvedValue([
      {
        id: "row_1",
        organization_id: "org_1",
        class_id: "c_1",
        student_id: "s_1",
        tag_uid: "ABC123",
        source: "nfc",
        checked_in_at: "2026-02-19T10:00:00.000Z",
      },
    ]);

    const result = await createCheckinWithFallback({
      organizationId: "org_1",
      classId: "c_1",
      studentId: "s_1",
      tagUid: "ABC123",
    });

    expect(result.status).toBe("synced");
    expect(result.checkin.id).toBe("row_1");
    expect(queueNfcCheckinWriteMock).not.toHaveBeenCalled();
  });

  test("network failure enqueues and returns pending", async () => {
    supabaseRestRequestMock.mockRejectedValue(new Error("Failed to fetch"));
    queueNfcCheckinWriteMock.mockResolvedValue(undefined);

    const result = await createCheckinWithFallback({
      organizationId: "org_1",
      classId: "c_1",
      studentId: "s_1",
      tagUid: "ABC123",
      checkedInAt: "2026-02-19T10:00:00.000Z",
    });

    expect(result.status).toBe("pending");
    expect(result.checkin.id.startsWith("queue_nfc_")).toBe(true);
    expect(queueNfcCheckinWriteMock).toHaveBeenCalledTimes(1);
  });

  test("idempotency key is scoped by day", () => {
    const key = buildCheckinIdempotencyKey({
      organizationId: "org_1",
      classId: "c_1",
      studentId: "s_1",
      checkedInAt: "2026-02-19T10:30:00.000Z",
    });
    expect(key).toBe("org_1:c_1:s_1:2026-02-19");
  });

  test("permission style error is not queued", () => {
    expect(shouldQueueNfcCheckinError(new Error("permission denied"))).toBe(false);
  });
});
