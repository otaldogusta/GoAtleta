/* eslint-disable import/first */
const mockSupabaseRestRequest = jest.fn();
const mockSupabaseRestGet = jest.fn();
const mockQueueNfcCheckinWrite = jest.fn();

jest.mock("../../api/rest", () => ({
  supabaseRestRequest: (...args: unknown[]) => mockSupabaseRestRequest(...args),
  supabaseRestGet: (...args: unknown[]) => mockSupabaseRestGet(...args),
}));

jest.mock("../../db/seed", () => ({
  queueNfcCheckinWrite: (...args: unknown[]) => mockQueueNfcCheckinWrite(...args),
}));

import {
  buildCheckinIdempotencyKey,
  createCheckinWithFallback,
  listCheckinsByRange,
  shouldQueueNfcCheckinError,
} from "../attendance-checkins";

describe("attendance checkins", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("remote success returns synced status", async () => {
    mockSupabaseRestRequest.mockResolvedValue([
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
    expect(mockQueueNfcCheckinWrite).not.toHaveBeenCalled();
  });

  test("network failure enqueues and returns pending", async () => {
    mockSupabaseRestRequest.mockRejectedValue(new Error("Failed to fetch"));
    mockQueueNfcCheckinWrite.mockResolvedValue(undefined);

    const result = await createCheckinWithFallback({
      organizationId: "org_1",
      classId: "c_1",
      studentId: "s_1",
      tagUid: "ABC123",
      checkedInAt: "2026-02-19T10:00:00.000Z",
    });

    expect(result.status).toBe("pending");
    expect(result.checkin.id.startsWith("queue_nfc_")).toBe(true);
    expect(mockQueueNfcCheckinWrite).toHaveBeenCalledTimes(1);
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

  test("listCheckinsByRange applies org/class/range filters", async () => {
    mockSupabaseRestGet.mockResolvedValue([
      {
        id: "row_2",
        organization_id: "org_1",
        class_id: "c_1",
        student_id: "s_2",
        tag_uid: "UID999",
        source: "nfc",
        checked_in_at: "2026-02-19T12:00:00.000Z",
      },
    ]);

    const rows = await listCheckinsByRange({
      organizationId: "org_1",
      classId: "c_1",
      fromIso: "2026-02-10T00:00:00.000Z",
      toIso: "2026-02-20T00:00:00.000Z",
      limit: 20,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].studentId).toBe("s_2");
    expect(mockSupabaseRestGet).toHaveBeenCalledWith(
      expect.stringContaining("/attendance_checkins?")
    );
    expect(mockSupabaseRestGet).toHaveBeenCalledWith(
      expect.stringContaining("organization_id=eq.org_1")
    );
    expect(mockSupabaseRestGet).toHaveBeenCalledWith(
      expect.stringContaining("class_id=eq.c_1")
    );
    expect(mockSupabaseRestGet).toHaveBeenCalledWith(
      expect.stringContaining("checked_in_at=gte.")
    );
    expect(mockSupabaseRestGet).toHaveBeenCalledWith(
      expect.stringContaining("checked_in_at=lt.")
    );
  });
});

