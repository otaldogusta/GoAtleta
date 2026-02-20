export type CentralSnapshot = {
  screenKey: string;
  signalKeys: string[];
  ruleUpdateKeys: string[];
  actionKeys: string[];
  historyHeadKey: string;
  serialized: string;
};

type SnapshotInput = {
  screenKey?: string | null;
  signals: { id: string; severity?: string | null; detectedAt?: string | null }[];
  ruleUpdates?: {
    id: string;
    publishedAt?: string | null;
    createdAt?: string | null;
    checksum?: string | null;
  }[];
  actions: { id: string }[];
  historyHead?: { id: string; createdAt?: string | null } | null;
};

const NONE = "__none__";

const sortUnique = (values: string[]) => Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));

export const buildCentralSnapshot = (input: SnapshotInput): CentralSnapshot => {
  const screenKey = input.screenKey ?? NONE;
  const signalKeys = sortUnique(
    input.signals.map(
      (item) => `${item.id}:${item.severity ?? NONE}:${item.detectedAt ?? NONE}`
    )
  );
  const ruleUpdateKeys = sortUnique(
    (input.ruleUpdates ?? []).map(
      (item) =>
        `${item.id}:${item.publishedAt ?? NONE}:${item.createdAt ?? NONE}:${item.checksum ?? NONE}`
    )
  );
  const actionKeys = sortUnique(input.actions.map((item) => item.id));
  const historyHeadKey = input.historyHead
    ? `${input.historyHead.id}:${input.historyHead.createdAt ?? NONE}`
    : NONE;
  const serialized = [
    screenKey,
    signalKeys.join(","),
    ruleUpdateKeys.join(","),
    actionKeys.join(","),
    historyHeadKey,
  ].join("|");

  return {
    screenKey,
    signalKeys,
    ruleUpdateKeys,
    actionKeys,
    historyHeadKey,
    serialized,
  };
};

export const hasSnapshotChanged = (
  previousSnapshot: CentralSnapshot | null,
  currentSnapshot: CentralSnapshot
) => {
  if (!previousSnapshot) return true;
  return previousSnapshot.serialized !== currentSnapshot.serialized;
};

export const countUnreadFromSnapshot = (
  lastSeenSnapshot: CentralSnapshot | null,
  currentSnapshot: CentralSnapshot
) => {
  if (!lastSeenSnapshot) return 0;
  if (lastSeenSnapshot.serialized === currentSnapshot.serialized) return 0;

  const lastSignals = new Set(lastSeenSnapshot.signalKeys);
  const lastRuleUpdates = new Set(lastSeenSnapshot.ruleUpdateKeys ?? []);
  const lastActions = new Set(lastSeenSnapshot.actionKeys);

  let unread = 0;
  unread += currentSnapshot.signalKeys.filter((item) => !lastSignals.has(item)).length;
  unread += (currentSnapshot.ruleUpdateKeys ?? []).filter((item) => !lastRuleUpdates.has(item)).length;
  unread += currentSnapshot.actionKeys.filter((item) => !lastActions.has(item)).length;

  if (
    currentSnapshot.historyHeadKey !== NONE &&
    currentSnapshot.historyHeadKey !== lastSeenSnapshot.historyHeadKey
  ) {
    unread += 1;
  }

  return unread;
};
