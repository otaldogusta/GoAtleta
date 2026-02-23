import type { Signal as CopilotSignal } from "../ai/signal-engine";
import type { RegulationRuleSet } from "../api/regulation-rule-sets";
import type { RegulationUpdate } from "../api/regulation-updates";

type CopilotHistoryItem = {
  actionTitle: string;
  status: "success" | "error";
  createdAt: string;
};

type OperationalContextInput = {
  screen: string | null | undefined;
  contextTitle: string | null | undefined;
  contextSubtitle: string | null | undefined;
  signals: CopilotSignal[];
  selectedSignalId: string | null;
  regulationUpdates: RegulationUpdate[];
  regulationRuleSets: RegulationRuleSet[];
  history: CopilotHistoryItem[];
};

type SnapshotSignal = {
  id: string;
  type: string;
  severity: string;
  title: string;
  classId: string | null;
  studentId: string | null;
};

type SnapshotAction = {
  actionTitle: string;
  status: string;
  createdAt: string;
};

type RegulationSnapshotContext = {
  activeRuleSetId: string | null;
  pendingRuleSetId: string | null;
  latestUpdateIds: string[];
  latestChangedTopics: string[];
  impactAreas: string[];
};

export type OperationalSnapshot = {
  snapshotVersion: 2;
  snapshotHash: string;
  screen: string | null;
  contextTitle: string | null;
  activeSignal: SnapshotSignal | null;
  signalsTop: SnapshotSignal[];
  recentActions: SnapshotAction[];
  regulationContext: RegulationSnapshotContext;
};

export type OperationalPanelState = {
  headerTitle: string;
  headerSubtitle: string;
  attentionSignals: CopilotSignal[];
  activeRuleSetLabel: string;
  pendingRuleSetLabel: string | null;
  unreadRegulationCount: number;
  topImpactAreas: string[];
};

export type OperationalContextResult = {
  snapshot: OperationalSnapshot;
  panel: OperationalPanelState;
};

const severityRank: Record<CopilotSignal["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const stableHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return `v2_${Math.abs(hash).toString(36)}`;
};

const toSnapshotSignal = (signal: CopilotSignal): SnapshotSignal => ({
  id: signal.id,
  type: signal.type,
  severity: signal.severity,
  title: signal.title,
  classId: signal.classId ?? null,
  studentId: signal.studentId ?? null,
});

const buildRuleSetLabel = (ruleSet: RegulationRuleSet | null) => {
  if (!ruleSet) return "Sem rule set ativo";
  const source = ruleSet.sourceAuthority ? ` (${ruleSet.sourceAuthority})` : "";
  return `${ruleSet.versionLabel}${source}`;
};

export const buildOperationalContext = (
  input: OperationalContextInput
): OperationalContextResult => {
  const sortedSignals = [...input.signals].sort((left, right) => {
    const bySeverity = severityRank[left.severity] - severityRank[right.severity];
    if (bySeverity !== 0) return bySeverity;
    return String(right.detectedAt).localeCompare(String(left.detectedAt));
  });
  const attentionSignals = sortedSignals.slice(0, 3);
  const activeSignal =
    sortedSignals.find((signal) => signal.id === input.selectedSignalId) ??
    sortedSignals[0] ??
    null;

  const activeRuleSet =
    input.regulationRuleSets.find((item) => item.status === "active") ?? null;
  const pendingRuleSet =
    input.regulationRuleSets.find((item) => item.status === "pending_next_cycle") ??
    null;
  const unreadUpdates = input.regulationUpdates.filter((item) => !item.isRead);
  const latestUpdates = [...input.regulationUpdates]
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, 5);

  const latestChangedTopics = unique(
    latestUpdates.flatMap((update) => update.changedTopics).slice(0, 8)
  );
  const impactAreas = unique(
    latestUpdates.flatMap((update) => update.impactAreas ?? []).slice(0, 6)
  );

  const snapshot: OperationalSnapshot = {
    snapshotVersion: 2,
    snapshotHash: "",
    screen: input.screen ?? null,
    contextTitle: input.contextTitle ?? null,
    activeSignal: activeSignal ? toSnapshotSignal(activeSignal) : null,
    signalsTop: sortedSignals.slice(0, 5).map(toSnapshotSignal),
    recentActions: input.history.slice(0, 3).map((item) => ({
      actionTitle: item.actionTitle,
      status: item.status,
      createdAt: item.createdAt,
    })),
    regulationContext: {
      activeRuleSetId: activeRuleSet?.id ?? null,
      pendingRuleSetId: pendingRuleSet?.id ?? null,
      latestUpdateIds: latestUpdates.map((item) => item.id),
      latestChangedTopics,
      impactAreas,
    },
  };

  const hashPayload = JSON.stringify({
    screen: snapshot.screen,
    title: snapshot.contextTitle,
    activeSignal: snapshot.activeSignal?.id ?? null,
    signalsTop: snapshot.signalsTop.map((signal) => ({
      id: signal.id,
      severity: signal.severity,
      detectedAt: sortedSignals.find((item) => item.id === signal.id)?.detectedAt ?? "",
    })),
    recentActions: snapshot.recentActions,
    regulationContext: snapshot.regulationContext,
  });
  snapshot.snapshotHash = stableHash(hashPayload);

  const headerTitle =
    (input.contextTitle ?? "").trim() ||
    (input.screen ?? "").trim() ||
    "Contexto atual";

  const panel: OperationalPanelState = {
    headerTitle,
    headerSubtitle: (input.contextSubtitle ?? "").trim() || "Visão operacional",
    attentionSignals,
    activeRuleSetLabel: buildRuleSetLabel(activeRuleSet),
    pendingRuleSetLabel: pendingRuleSet ? buildRuleSetLabel(pendingRuleSet) : null,
    unreadRegulationCount: unreadUpdates.length,
    topImpactAreas: impactAreas.slice(0, 4),
  };

  return { snapshot, panel };
};
