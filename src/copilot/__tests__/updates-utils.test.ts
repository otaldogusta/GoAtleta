import {
  buildCentralSnapshot,
  countUnreadFromSnapshot,
  hasSnapshotChanged,
} from "../updates-utils";

describe("copilot updates utils", () => {
  test("countUnreadFromSnapshot returns 0 when snapshots are equal", () => {
    const snapshot = buildCentralSnapshot({
      screenKey: "coordination",
      signals: [{ id: "s1", detectedAt: "2026-02-19T10:00:00.000Z" }],
      actions: [{ id: "a1" }],
      historyHead: { id: "h1", createdAt: "2026-02-19T10:01:00.000Z" },
    });

    expect(countUnreadFromSnapshot(snapshot, snapshot)).toBe(0);
    expect(hasSnapshotChanged(snapshot, snapshot)).toBe(false);
  });

  test("detects unread signals/actions and history updates", () => {
    const lastSeen = buildCentralSnapshot({
      screenKey: "coordination",
      signals: [{ id: "s1", detectedAt: "2026-02-19T10:00:00.000Z" }],
      actions: [{ id: "a1" }],
      historyHead: { id: "h1", createdAt: "2026-02-19T10:01:00.000Z" },
    });

    const current = buildCentralSnapshot({
      screenKey: "coordination",
      signals: [
        { id: "s1", detectedAt: "2026-02-19T10:00:00.000Z" },
        { id: "s2", detectedAt: "2026-02-19T11:00:00.000Z" },
      ],
      actions: [{ id: "a1" }, { id: "a2" }],
      historyHead: { id: "h2", createdAt: "2026-02-19T11:10:00.000Z" },
    });

    expect(hasSnapshotChanged(lastSeen, current)).toBe(true);
    expect(countUnreadFromSnapshot(lastSeen, current)).toBe(3);
  });

  test("returns 0 for first load without last seen snapshot", () => {
    const current = buildCentralSnapshot({
      screenKey: "coordination",
      signals: [{ id: "s1", detectedAt: "2026-02-19T10:00:00.000Z" }],
      actions: [{ id: "a1" }],
      historyHead: null,
    });

    expect(countUnreadFromSnapshot(null, current)).toBe(0);
    expect(hasSnapshotChanged(null, current)).toBe(true);
  });

  test("counts unread when same signal changes severity", () => {
    const previous = buildCentralSnapshot({
      screenKey: "coordination",
      signals: [
        {
          id: "s1",
          severity: "medium",
          detectedAt: "2026-02-19T10:00:00.000Z",
        },
      ],
      actions: [],
      historyHead: null,
    });

    const current = buildCentralSnapshot({
      screenKey: "coordination",
      signals: [
        {
          id: "s1",
          severity: "high",
          detectedAt: "2026-02-19T10:00:00.000Z",
        },
      ],
      actions: [],
      historyHead: null,
    });

    expect(hasSnapshotChanged(previous, current)).toBe(true);
    expect(countUnreadFromSnapshot(previous, current)).toBe(1);
  });

  test("counts unread when a regulation update key changes", () => {
    const previous = buildCentralSnapshot({
      screenKey: "coordination",
      signals: [],
      ruleUpdates: [
        {
          id: "ru_1",
          publishedAt: "2026-02-19T10:00:00.000Z",
          createdAt: "2026-02-19T10:01:00.000Z",
          checksum: "abc",
        },
      ],
      actions: [],
      historyHead: null,
    });

    const current = buildCentralSnapshot({
      screenKey: "coordination",
      signals: [],
      ruleUpdates: [
        {
          id: "ru_1",
          publishedAt: "2026-02-19T10:00:00.000Z",
          createdAt: "2026-02-19T10:01:00.000Z",
          checksum: "def",
        },
      ],
      actions: [],
      historyHead: null,
    });

    expect(hasSnapshotChanged(previous, current)).toBe(true);
    expect(countUnreadFromSnapshot(previous, current)).toBe(1);
  });

  test("counts unread when snapshot hash changes without structural diff", () => {
    const previous = buildCentralSnapshot({
      screenKey: "coordination",
      snapshotHash: "v2_hash_old",
      signals: [],
      actions: [],
      historyHead: null,
    });

    const current = buildCentralSnapshot({
      screenKey: "coordination",
      snapshotHash: "v2_hash_new",
      signals: [],
      actions: [],
      historyHead: null,
    });

    expect(hasSnapshotChanged(previous, current)).toBe(true);
    expect(countUnreadFromSnapshot(previous, current)).toBe(1);
  });

  test("keeps snapshot stable when arrays only change order", () => {
    const previous = buildCentralSnapshot({
      screenKey: "coordination",
      snapshotHash: "v2_hash_same",
      signals: [
        { id: "s2", severity: "high", detectedAt: "2026-02-20T10:00:00.000Z" },
        { id: "s1", severity: "medium", detectedAt: "2026-02-20T11:00:00.000Z" },
      ],
      ruleUpdates: [
        {
          id: "ru2",
          publishedAt: "2026-02-20T09:00:00.000Z",
          createdAt: "2026-02-20T09:10:00.000Z",
          checksum: "b",
        },
        {
          id: "ru1",
          publishedAt: "2026-02-20T08:00:00.000Z",
          createdAt: "2026-02-20T08:10:00.000Z",
          checksum: "a",
        },
      ],
      actions: [{ id: "a2" }, { id: "a1" }],
      historyHead: { id: "h1", createdAt: "2026-02-20T11:10:00.000Z" },
    });

    const current = buildCentralSnapshot({
      screenKey: "coordination",
      snapshotHash: "v2_hash_same",
      signals: [
        { id: "s1", severity: "medium", detectedAt: "2026-02-20T11:00:00.000Z" },
        { id: "s2", severity: "high", detectedAt: "2026-02-20T10:00:00.000Z" },
      ],
      ruleUpdates: [
        {
          id: "ru1",
          publishedAt: "2026-02-20T08:00:00.000Z",
          createdAt: "2026-02-20T08:10:00.000Z",
          checksum: "a",
        },
        {
          id: "ru2",
          publishedAt: "2026-02-20T09:00:00.000Z",
          createdAt: "2026-02-20T09:10:00.000Z",
          checksum: "b",
        },
      ],
      actions: [{ id: "a1" }, { id: "a2" }],
      historyHead: { id: "h1", createdAt: "2026-02-20T11:10:00.000Z" },
    });

    expect(hasSnapshotChanged(previous, current)).toBe(false);
    expect(countUnreadFromSnapshot(previous, current)).toBe(0);
  });
});
