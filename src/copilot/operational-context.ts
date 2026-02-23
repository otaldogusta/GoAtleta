export type CopilotSignalSeverity = "low" | "medium" | "high" | "critical";

export type CopilotSignal = {
  id: string;
  type: string;
  severity: CopilotSignalSeverity;
  classId?: string | null;
  studentId?: string | null;
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  recommendedActionIds: string[];
  detectedAt: string;
};

export type RegulationRuleSet = {
  id: string;
  versionLabel: string;
  status: "draft" | "active" | "pending_next_cycle" | "archived";
  sourceAuthority: string;
  updatedAt: string;
};

export type RegulationUpdate = {
  id: string;
  publishedAt: string | null;
  changedTopics: string[];
  createdAt: string;
  isRead: boolean;
  impactAreas: string[];
};

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

const severityWeightBySignal: Record<CopilotSignal["severity"], number> = {
  critical: 100,
  high: 75,
  medium: 50,
  low: 25,
};
const MAX_ATTENTION_ITEMS = 3;
const MAX_SIGNALS_TOP = 5;
const MAX_RECENT_ACTIONS = 3;

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const sortStrings = (values: string[]) =>
  [...values].sort((left, right) => left.localeCompare(right));

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
  if (!ruleSet) return "Sem ruleset ativo";
  const source = ruleSet.sourceAuthority ? ` (${ruleSet.sourceAuthority})` : "";
  return `${ruleSet.versionLabel}${source}`;
};

const resolveRecencyBoost = (detectedAt: string) => {
  const parsed = Date.parse(detectedAt);
  if (!Number.isFinite(parsed)) return 0;
  const ageHours = Math.max(0, (Date.now() - parsed) / 36e5);
  if (ageHours <= 24) return 30;
  if (ageHours <= 72) return 20;
  if (ageHours <= 24 * 7) return 10;
  return 0;
};

const resolveScreenRelevanceBoost = (screen: string | null | undefined, signal: CopilotSignal) => {
  const normalizedScreen = String(screen ?? "").toLowerCase();
  let boost = 0;

  if (normalizedScreen.startsWith("coordination")) {
    if (signal.type === "report_delay") boost = 20;
    if (signal.type === "attendance_drop") boost = 20;
    if (signal.type === "repeated_absence") boost = 15;
  } else if (normalizedScreen.startsWith("events")) {
    if (signal.type === "engagement_risk") boost = 20;
    if (signal.type === "attendance_drop") boost = 10;
  } else if (normalizedScreen.startsWith("classes") || normalizedScreen.startsWith("class")) {
    if (signal.type === "repeated_absence") boost = 20;
    if (signal.type === "attendance_drop") boost = 15;
    if (signal.type === "report_delay") boost = 10;
  } else if (normalizedScreen.startsWith("periodization")) {
    if (signal.type === "attendance_drop") boost = 20;
    if (signal.type === "engagement_risk") boost = 15;
  } else if (normalizedScreen.startsWith("nfc")) {
    if (signal.type === "unusual_presence_pattern") boost = 25;
    if (signal.type === "repeated_absence") boost = 10;
  }

  return Math.min(25, Math.max(0, boost));
};

const scoreSignal = (screen: string | null | undefined, signal: CopilotSignal) => {
  const severityWeight = severityWeightBySignal[signal.severity] ?? 25;
  const recencyBoost = resolveRecencyBoost(signal.detectedAt);
  const screenRelevanceBoost = resolveScreenRelevanceBoost(screen, signal);
  return severityWeight * 2 + recencyBoost + screenRelevanceBoost;
};

export const buildOperationalContext = (
  input: OperationalContextInput
): OperationalContextResult => {
  const scoredSignals = input.signals.map((signal) => ({
    signal,
    score: scoreSignal(input.screen, signal),
  }));

  const sortedSignals = scoredSignals
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      const rightDetectedAt = Date.parse(right.signal.detectedAt);
      const leftDetectedAt = Date.parse(left.signal.detectedAt);
      if (Number.isFinite(rightDetectedAt) && Number.isFinite(leftDetectedAt)) {
        if (rightDetectedAt !== leftDetectedAt) return rightDetectedAt - leftDetectedAt;
      }
      return left.signal.id.localeCompare(right.signal.id);
    })
    .map((entry) => entry.signal);

  const attentionSignals = sortedSignals.slice(0, MAX_ATTENTION_ITEMS);
  const activeSignal =
    sortedSignals.find((signal) => signal.id === input.selectedSignalId) ??
    sortedSignals[0] ??
    null;

  const activeRuleSet =
    input.regulationRuleSets.find((item) => item.status === "active") ?? null;
  const pendingRuleSet =
    input.regulationRuleSets.find((item) => item.status === "pending_next_cycle") ?? null;

  const unreadUpdates = input.regulationUpdates.filter((item) => !item.isRead);
  const latestUpdates = [...input.regulationUpdates]
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, 5);

  const latestChangedTopics = unique(latestUpdates.flatMap((update) => update.changedTopics));
  const impactAreas = unique(latestUpdates.flatMap((update) => update.impactAreas ?? []));

  const recentActions = [...input.history]
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, MAX_RECENT_ACTIONS)
    .map((item) => ({
      actionTitle: item.actionTitle,
      status: item.status,
      createdAt: item.createdAt,
    }));

  const snapshot: OperationalSnapshot = {
    snapshotVersion: 2,
    snapshotHash: "",
    screen: input.screen ?? null,
    contextTitle: input.contextTitle ?? null,
    activeSignal: activeSignal ? toSnapshotSignal(activeSignal) : null,
    signalsTop: sortedSignals.slice(0, MAX_SIGNALS_TOP).map(toSnapshotSignal),
    recentActions,
    regulationContext: {
      activeRuleSetId: activeRuleSet?.id ?? null,
      pendingRuleSetId: pendingRuleSet?.id ?? null,
      latestUpdateIds: sortStrings(latestUpdates.map((item) => item.id)),
      latestChangedTopics: sortStrings(latestChangedTopics),
      impactAreas: sortStrings(impactAreas),
    },
  };

  const hashPayload = JSON.stringify({
    screen: snapshot.screen,
    title: snapshot.contextTitle,
    activeSignal: snapshot.activeSignal?.id ?? null,
    signalsTop: [...snapshot.signalsTop]
      .map((signal) => ({
        id: signal.id,
        severity: signal.severity,
        detectedAt:
          sortedSignals.find((item) => item.id === signal.id)?.detectedAt ?? "",
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    recentActions: [...snapshot.recentActions].sort((left, right) => {
      const byDate = String(right.createdAt).localeCompare(String(left.createdAt));
      if (byDate !== 0) return byDate;
      return left.actionTitle.localeCompare(right.actionTitle);
    }),
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
    topImpactAreas: sortStrings(impactAreas).slice(0, 4),
  };

  return { snapshot, panel };
};
