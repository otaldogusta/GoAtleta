import { buildNfcCheckinPendingWriteDedupKey } from "../seed";

describe("pending writes nfc", () => {
  test("dedup key keeps same bucket for events inside 20s window", () => {
    const base = "2026-02-19T10:00:00.000Z";
    const insideWindow = "2026-02-19T10:00:18.000Z";

    const a = buildNfcCheckinPendingWriteDedupKey(
      { organizationId: "org_1", tagUid: "UID123", checkedInAt: base },
      base
    );
    const b = buildNfcCheckinPendingWriteDedupKey(
      { organizationId: "org_1", tagUid: "UID123", checkedInAt: insideWindow },
      insideWindow
    );

    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });

  test("dedup key changes for events beyond 20s window", () => {
    const base = "2026-02-19T10:00:00.000Z";
    const outsideWindow = "2026-02-19T10:00:25.000Z";

    const a = buildNfcCheckinPendingWriteDedupKey(
      { organizationId: "org_1", tagUid: "UID123", checkedInAt: base },
      base
    );
    const b = buildNfcCheckinPendingWriteDedupKey(
      { organizationId: "org_1", tagUid: "UID123", checkedInAt: outsideWindow },
      outsideWindow
    );

    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });
});
