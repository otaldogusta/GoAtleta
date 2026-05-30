import type { ClassGroup, ClassPlan } from "../../../core/models";
import type { PlannedSession } from "../../../core/session-calendar-engine";
import type { WeekSessionPreview } from "../../periodization/application/build-week-session-preview";

export type MonthPlanningInsightItem = {
  plan: Pick<ClassPlan, "generationContextSnapshotJson">;
  sessions: WeekSessionPreview[];
  skippedSessions?: PlannedSession[];
};

const parseSnapshot = (raw: string | undefined) => {
  try {
    const parsed = JSON.parse(raw ?? "{}");
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const densityLabel = (value: unknown) => {
  switch (value) {
    case "small":
      return "Turma pequena";
    case "medium":
      return "Turma média";
    case "large":
      return "Turma numerosa";
    default:
      return "";
  }
};

const uniqueStrings = (values: (string | null | undefined)[]) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const pluralizeAula = (count: number) => (count === 1 ? "aula" : "aulas");
const realLabel = (count: number) => (count === 1 ? "real" : "reais");

export const buildMonthPlanningInsightBullets = (params: {
  weeklyItems: MonthPlanningInsightItem[];
  selectedClass?: Pick<ClassGroup, "ageBand" | "mvLevel" | "level" | "name"> | null;
}): string[] => {
  if (!params.weeklyItems.length) return [];

  const snapshots = params.weeklyItems.map((item) => parseSnapshot(item.plan.generationContextSnapshotJson));
  const monthlySnapshot = snapshots
    .map((snapshot) => snapshot.monthlyBlueprint)
    .find((snapshot): snapshot is Record<string, unknown> => Boolean(snapshot && typeof snapshot === "object"));
  const classContext = monthlySnapshot?.classContextSnapshot as Record<string, unknown> | undefined;
  const calendar = classContext?.calendar as Record<string, unknown> | undefined;
  const roster = classContext?.roster as Record<string, unknown> | undefined;
  const health = classContext?.health as Record<string, unknown> | undefined;
  const evidenceQuality = classContext?.evidenceQuality as Record<string, unknown> | undefined;

  const plannedCount =
    typeof calendar?.sessionCount === "number"
      ? calendar.sessionCount
      : params.weeklyItems.reduce((sum, item) => sum + item.sessions.length, 0);
  const skippedCount =
    typeof calendar?.skippedSessionCount === "number"
      ? calendar.skippedSessionCount
      : params.weeklyItems.reduce((sum, item) => sum + (item.skippedSessions?.length ?? 0), 0);

  const classProfile = params.selectedClass
    ? `Turma ${params.selectedClass.ageBand || "-"} ${params.selectedClass.mvLevel || `nível ${params.selectedClass.level}`}.`
    : null;
  const density = densityLabel(roster?.densityProfile);
  const healthIncomplete = health?.hasIncompleteHealthData === true;
  const hasWeakEvidence =
    evidenceQuality?.hasRosterData === false ||
    evidenceQuality?.hasRecentAttendanceData === false ||
    evidenceQuality?.hasRecentSessionLogs === false ||
    healthIncomplete;

  return uniqueStrings([
    `${plannedCount} ${pluralizeAula(plannedCount)} ${realLabel(plannedCount)} no mês.`,
    skippedCount > 0
      ? `${skippedCount} ${pluralizeAula(skippedCount)} removida${skippedCount === 1 ? "" : "s"} por exceção de calendário.`
      : null,
    density || classProfile,
    hasWeakEvidence ? "Dados parciais: decisão conservadora." : classProfile,
  ]).slice(0, 4);
};
