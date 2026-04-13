import type { OperationalPanelState } from "./operational-context";
import type { CentralSnapshot } from "./updates-utils";
import { countUnreadFromSnapshot, hasSnapshotChanged } from "./updates-utils";

export type CopilotFabHint = {
  kind: "signal" | "regulation" | "impact";
  message: string;
};

type UnreadStateResolution = {
  nextSeenSnapshot: CentralSnapshot | null;
  statePatch: {
    hasUnreadUpdates: boolean;
    unreadCount: number;
  } | null;
};

type ResolveUnreadStateParams = {
  previousSnapshot: CentralSnapshot | null;
  currentSnapshot: CentralSnapshot;
  lastSeenSnapshot: CentralSnapshot | null;
  isOpen: boolean;
  hasUnreadUpdates: boolean;
  unreadCount: number;
};

type ResolveFabHintParams = {
  showFab: boolean;
  panel: Pick<
    OperationalPanelState,
    "attentionSignals" | "unreadRegulationCount" | "topImpactAreas"
  >;
};

type ResolvePulseParams = {
  fabHint: CopilotFabHint | null;
  hasUnreadUpdates: boolean;
  isOpen: boolean;
};

export const resolveUnreadState = (
  params: ResolveUnreadStateParams
): UnreadStateResolution => {
  if (params.isOpen) {
    return {
      nextSeenSnapshot: params.currentSnapshot,
      statePatch:
        params.hasUnreadUpdates || params.unreadCount > 0
          ? { hasUnreadUpdates: false, unreadCount: 0 }
          : null,
    };
  }

  const changed = hasSnapshotChanged(params.previousSnapshot, params.currentSnapshot);
  if (!changed) {
    return {
      nextSeenSnapshot: params.lastSeenSnapshot,
      statePatch: null,
    };
  }

  const unread = countUnreadFromSnapshot(
    params.lastSeenSnapshot,
    params.currentSnapshot
  );

  if (unread <= 0) {
    return {
      nextSeenSnapshot: params.lastSeenSnapshot,
      statePatch: null,
    };
  }

  if (params.hasUnreadUpdates && params.unreadCount === unread) {
    return {
      nextSeenSnapshot: params.lastSeenSnapshot,
      statePatch: null,
    };
  }

  return {
    nextSeenSnapshot: params.lastSeenSnapshot,
    statePatch: {
      hasUnreadUpdates: true,
      unreadCount: unread,
    },
  };
};

export const resolveCopilotFabHint = (
  params: ResolveFabHintParams
): CopilotFabHint | null => {
  if (!params.showFab) return null;

  const primarySignal = params.panel.attentionSignals[0];
  if (primarySignal?.title) {
    return {
      kind: "signal",
      message: primarySignal.title,
    };
  }

  if (params.panel.unreadRegulationCount > 0) {
    const count = params.panel.unreadRegulationCount;
    return {
      kind: "regulation",
      message:
        count === 1
          ? "1 atualização de regulamento pendente."
          : `${count} atualizações de regulamento pendentes.`,
    };
  }

  const primaryImpactArea = params.panel.topImpactAreas[0];
  if (primaryImpactArea) {
    return {
      kind: "impact",
      message: `Impacto recente em ${primaryImpactArea}.`,
    };
  }

  return null;
};

export const shouldPulseCopilotFab = (params: ResolvePulseParams) =>
  Boolean(params.fabHint) && params.hasUnreadUpdates && !params.isOpen;
