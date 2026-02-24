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

type ScheduleWindowInput = {
  daysOfWeek: number[] | null;
  startTime: string | null;
  durationMinutes: number | null;
};

export type DayScheduleStatus = "no_classes" | "in_progress" | "concluded";

type OperationalContextInput = {
  screen: string | null | undefined;
  contextTitle: string | null | undefined;
  contextSubtitle: string | null | undefined;
  signals: (CopilotSignal | null | undefined)[];
  selectedSignalId: string | null;
  regulationUpdates: (RegulationUpdate | null | undefined)[];
  regulationRuleSets: (RegulationRuleSet | null | undefined)[];
  history: (CopilotHistoryItem | null | undefined)[];
  scheduleWindows?: ScheduleWindowInput[];
  nowMs?: number;
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
  dayScheduleStatus: DayScheduleStatus;
};

export type OperationalPanelState = {
  headerTitle: string;
  headerSubtitle: string;
  attentionSignals: CopilotSignal[];
  activeRuleSetLabel: string;
  pendingRuleSetLabel: string | null;
  unreadRegulationCount: number;
  topImpactAreas: string[];
  dayScheduleStatus: DayScheduleStatus;
  dayScheduleLabel: string;
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

const isValidSeverity = (value: unknown): value is CopilotSignalSeverity =>
  value === "low" || value === "medium" || value === "high" || value === "critical";

const isValidSignal = (value: CopilotSignal | null | undefined): value is CopilotSignal => {
  if (!value || typeof value !== "object") return false;
  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    isValidSeverity(value.severity) &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.detectedAt === "string"
  );
};

const isValidRegulationUpdate = (
  value: RegulationUpdate | null | undefined
): value is RegulationUpdate => {
  if (!value || typeof value !== "object") return false;
  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    Array.isArray(value.changedTopics) &&
    Array.isArray(value.impactAreas)
  );
};

const isValidRuleSet = (
  value: RegulationRuleSet | null | undefined
): value is RegulationRuleSet => {
  if (!value || typeof value !== "object") return false;
  return (
    typeof value.id === "string" &&
    typeof value.versionLabel === "string" &&
    typeof value.updatedAt === "string" &&
    (value.status === "draft" ||
      value.status === "active" ||
      value.status === "pending_next_cycle" ||
      value.status === "archived")
  );
};

const isValidHistoryItem = (
  value: CopilotHistoryItem | null | undefined
): value is CopilotHistoryItem => {
  if (!value || typeof value !== "object") return false;
  return (
    typeof value.actionTitle === "string" &&
    (value.status === "success" || value.status === "error") &&
    typeof value.createdAt === "string"
  );
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

const parseStartTimeToMinutes = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

const resolveDayScheduleStatus = (
  scheduleWindows: ScheduleWindowInput[],
  nowMs: number
): DayScheduleStatus => {
  if (!scheduleWindows.length) return "no_classes";
  const now = new Date(nowMs);
  const weekday = now.getDay();
  const todaysWindows = scheduleWindows.filter((item) =>
    (item.daysOfWeek ?? []).includes(weekday)
  );
  if (!todaysWindows.length) return "no_classes";

  let hasPendingWindow = false;
  let hasValidWindow = false;
  for (const window of todaysWindows) {
    const startMinutes = parseStartTimeToMinutes(window.startTime);
    if (startMinutes == null) continue;
    hasValidWindow = true;
    const startAt = new Date(now);
    startAt.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    const durationMinutes = Math.max(15, Number(window.durationMinutes ?? 60));
    const graceEndsAtMs = startAt.getTime() + durationMinutes * 60_000 + 60 * 60_000;
    if (nowMs < graceEndsAtMs) {
      hasPendingWindow = true;
      break;
    }
  }

  if (!hasValidWindow) return "in_progress";
  return hasPendingWindow ? "in_progress" : "concluded";
};

const dayScheduleLabelByStatus: Record<DayScheduleStatus, string> = {
  no_classes: "Sem turmas agendadas para hoje.",
  in_progress: "Dia em andamento.",
  concluded: "Dia concluído: não há mais turmas pendentes hoje.",
};

export const buildOperationalContext = (
  input: OperationalContextInput
): OperationalContextResult => {
  const safeSignals = (input.signals ?? []).filter(isValidSignal);
  const safeRegulationUpdates = (input.regulationUpdates ?? []).filter(isValidRegulationUpdate);
  const safeRuleSets = (input.regulationRuleSets ?? []).filter(isValidRuleSet);
  const safeHistory = (input.history ?? []).filter(isValidHistoryItem);

  const dayScheduleStatus = resolveDayScheduleStatus(
    input.scheduleWindows ?? [],
    Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now()
  );
  const scoredSignals = safeSignals.map((signal) => ({
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
    safeRuleSets.find((item) => item.status === "active") ?? null;
  const pendingRuleSet =
    safeRuleSets.find((item) => item.status === "pending_next_cycle") ?? null;

  const unreadUpdates = safeRegulationUpdates.filter((item) => !item.isRead);
  const latestUpdates = [...safeRegulationUpdates]
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .slice(0, 5);

  const latestChangedTopics = unique(latestUpdates.flatMap((update) => update.changedTopics));
  const impactAreas = unique(latestUpdates.flatMap((update) => update.impactAreas ?? []));

  const recentActions = [...safeHistory]
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
    dayScheduleStatus,
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
    dayScheduleStatus: snapshot.dayScheduleStatus,
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
    dayScheduleStatus,
    dayScheduleLabel: dayScheduleLabelByStatus[dayScheduleStatus],
  };

  return { snapshot, panel };
};
