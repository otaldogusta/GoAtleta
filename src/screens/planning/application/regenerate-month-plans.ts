import type {
  AttendanceRecord,
  ClassCalendarException,
  ClassGroup,
  ClassPlan,
  SessionLog,
  Student,
} from "../../../core/models";
import { resolveLearningObjectives } from "../../../core/pedagogy/objective-language";
import { resolveSportProfile } from "../../../core/periodization-basics";
import { resolvePlanBand, toClassPlans } from "../../../core/periodization-generator";
import {
    parseWeeklyPeriodizationSnapshot,
    serializeWeeklyPeriodizationSnapshot,
} from "../../../core/periodization-snapshots";
import {
    listDailyLessonPlansByWeekIds,
    saveClassPlans,
    updateClassPlan,
    upsertDailyLessonPlan
} from "../../../db/seed";
import { generateMonthlyBlueprint } from "./generate-monthly-blueprint";
import { buildPlanSessionCalendar, filterClassPlansBySessionMonth } from "./monthly-plan-calendar";
import { regenerateDailyLessonPlanFromWeek } from "./regenerate-daily-lesson-plan";

export interface MonthRegenerationProgress {
  stage: "blueprint" | "weeklies" | "dailies" | "complete";
  currentIndex?: number;
  total?: number;
  message: string;
}

export type MonthRegenerationResult =
  | { status: "regenerated"; weeklyPlanCount: number }
  | { status: "outside_cycle"; weeklyPlanCount: 0 };

export interface RegenerateMonthPlansParams {
  classGroup: ClassGroup;
  monthKey: string; // "YYYY-MM"
  classPlans: ClassPlan[];
  activeCycleId?: string;
  activeCycleStartDate?: string;
  activeCycleEndDate?: string;
  calendarExceptions?: ClassCalendarException[];
  students?: Student[];
  recentAttendance?: AttendanceRecord[];
  recentSessionLogs?: SessionLog[];
  onProgress?: (progress: MonthRegenerationProgress) => void;
}

export const buildInitialMonthPlans = (params: {
  classGroup: ClassGroup;
  monthKey: string;
  classPlans: ClassPlan[];
  activeCycleId?: string;
  activeCycleStartDate?: string;
  calendarExceptions?: ClassCalendarException[];
}): ClassPlan[] => {
  const { classGroup, monthKey, classPlans } = params;
  const planBand = resolvePlanBand(classGroup.ageBand);
  const generatedCycle = toClassPlans({
    classId: classGroup.id,
    ageBand: planBand,
    cycleLength: Math.max(1, classGroup.cycleLengthWeeks),
    startDate: params.activeCycleStartDate || classGroup.cycleStartDate,
    mvLevel: classGroup.mvLevel,
    model: planBand === "12-14" ? "formacao" : "iniciacao",
    sessionsPerWeek: Math.max(1, classGroup.daysOfWeek.length || classGroup.daysPerWeek || 1),
    sport: resolveSportProfile(classGroup.modality),
  }).map((plan) => ({ ...plan, cycleId: params.activeCycleId }));
  const existingKeys = new Set(
    classPlans.map((plan) => `${plan.weekNumber}|${plan.startDate}`)
  );
  return filterClassPlansBySessionMonth(
    generatedCycle,
    classGroup,
    params.calendarExceptions ?? [],
    monthKey
  ).filter((plan) => !existingKeys.has(`${plan.weekNumber}|${plan.startDate}`));
};

/**
 * Orchestrate full-month regeneration:
 * 1. Generate monthly blueprint (context for weekly generation)
 * 2. Regenerate all weekly plans for the month (bump versions, preserve edits)
 * 3. Regenerate all daily lesson plans for the month (preserve overrides)
 *
 * All operations are local-first (SQLite) with progress callbacks for UI feedback.
 */
export const regenerateMonthPlans = async (
  params: RegenerateMonthPlansParams
): Promise<MonthRegenerationResult> => {
  const { classGroup, monthKey, classPlans, activeCycleStartDate, activeCycleEndDate, onProgress } = params;

  let monthlyPlans = filterClassPlansBySessionMonth(
    classPlans,
    classGroup,
    params.calendarExceptions ?? [],
    monthKey
  );

  if (!monthlyPlans.length) {
    onProgress?.({ stage: "weeklies", message: "Criando semanas do mês..." });
    monthlyPlans = buildInitialMonthPlans({
      classGroup,
      monthKey,
      classPlans,
      activeCycleId: params.activeCycleId,
      activeCycleStartDate,
      calendarExceptions: params.calendarExceptions,
    });

    if (!monthlyPlans.length) {
      onProgress?.({
        stage: "complete",
        message: "Este mês está fora do ciclo ativo da turma",
      });
      return { status: "outside_cycle", weeklyPlanCount: 0 };
    }
    await saveClassPlans(monthlyPlans, { organizationId: classGroup.organizationId });
  }

  // === Stage 1: Generate monthly blueprint ===
  onProgress?.({ stage: "blueprint", message: "Gerando blueprint mensal..." });
  const blueprint = generateMonthlyBlueprint({
    classGroup,
    monthKey,
    calendarExceptions: params.calendarExceptions,
    students: params.students,
    recentAttendance: params.recentAttendance,
    recentSessionLogs: params.recentSessionLogs,
  });
  // Note: Blueprint storage deferred to backend sync phase; for now, keep in context

  // === Stage 2: Regenerate weeklies ===
  onProgress?.({ stage: "weeklies", message: "Regenerando planos semanais...", total: monthlyPlans.length });

  for (let i = 0; i < monthlyPlans.length; i++) {
    const weekPlan = monthlyPlans[i];

    onProgress?.({
      stage: "weeklies",
      currentIndex: i + 1,
      total: monthlyPlans.length,
      message: `Atualizando semana ${i + 1}/${monthlyPlans.length}`,
    });

    // Auto-regenerate weekly: bump version, mark in_sync
    const regeneratedWeekly = regenerateWeeklyPlanFromBlueprint({
      existing: weekPlan,
      blueprint,
    });

    await updateClassPlan(regeneratedWeekly);
    monthlyPlans[i] = regeneratedWeekly;
  }

  // === Stage 3: Regenerate dailies ===
  onProgress?.({ stage: "dailies", message: "Regenerando planos diários...", total: monthlyPlans.length });

  const weekIds = monthlyPlans.map((p) => p.id);
  const existingDailies = await listDailyLessonPlansByWeekIds(weekIds);

  for (let i = 0; i < monthlyPlans.length; i++) {
    const weekPlan = monthlyPlans[i];
    const weekSessionPreviews = buildPlanSessionCalendar({
      plan: weekPlan,
      classGroup,
      exceptions: params.calendarExceptions,
      monthKey,
    }).sessions.map((session, index) => ({
      sessionIndex: index + 1,
      weekday: session.weekday,
      weekdayLabel: "",
      date: session.date,
      dateLabel: session.date.split("-").reverse().join("/"),
      shortLabel: session.date.slice(5),
    }));

    onProgress?.({
      stage: "dailies",
      currentIndex: i + 1,
      total: monthlyPlans.length,
      message: `Aulas: ${existingDailies.filter((d) => d.weeklyPlanId === weekPlan.id).length} aulas da semana ${i + 1}`,
    });

    for (const session of weekSessionPreviews) {
      const existingDaily = existingDailies.find(
        (d) => d.weeklyPlanId === weekPlan.id && d.date === session.date
      );

      const regeneratedDaily = regenerateDailyLessonPlanFromWeek({
        existing: existingDaily ?? null,
        weeklyPlan: weekPlan,
        session,
        context: {
          className: classGroup.name,
          ageBand: classGroup.ageBand,
          durationMinutes: classGroup.durationMinutes,
          cycleStartDate: activeCycleStartDate,
          cycleEndDate: activeCycleEndDate,
          classGroup,
          recentPlans: existingDailies,
        },
      });

      await upsertDailyLessonPlan(regeneratedDaily);
    }
  }

  onProgress?.({ stage: "complete", message: "Mês regenerado com sucesso!" });
  return { status: "regenerated", weeklyPlanCount: monthlyPlans.length };
};

/**
 * Regenerate a weekly plan from monthly blueprint context.
 * - Bumps generationVersion
 * - Uses blueprint context for theme/pedagogicalRule if not manually edited
 * - Preserves other field overrides via existing manualOverrideMaskJson
 */
function regenerateWeeklyPlanFromBlueprint(params: {
  existing: ClassPlan;
  blueprint: ReturnType<typeof generateMonthlyBlueprint>;
}): ClassPlan {
  const { existing, blueprint } = params;
  const nowIso = new Date().toISOString();

  // Extract week index from start date
  const startDate = new Date(existing.startDate || "");
  const monthStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const weekIndex = Math.floor((startDate.getTime() - monthStartDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

  // Extract weekly focus from blueprint
  let weeklyFocus = "";
  try {
    const distribution = JSON.parse(blueprint.weeklyFocusDistributionJson);
    weeklyFocus = distribution[weekIndex] || distribution[0] || "Foco da semana";
  } catch {
    weeklyFocus = "Foco da semana";
  }

  // If theme not manually overridden, update from blueprint
  const isThemeManuallyOverridden = existing.manualOverrideMaskJson
    ?.includes("theme");
  const newTheme = isThemeManuallyOverridden ? existing.theme : weeklyFocus;
  const isGeneralObjectiveManuallyOverridden = existing.manualOverrideMaskJson?.includes("generalObjective");
  const isSpecificObjectiveManuallyOverridden = existing.manualOverrideMaskJson?.includes("specificObjective");

  const resolvedObjectives = resolveLearningObjectives({
    generalObjective: isGeneralObjectiveManuallyOverridden ? existing.generalObjective : "",
    specificObjective: isSpecificObjectiveManuallyOverridden ? existing.specificObjective : existing.technicalFocus,
    title: existing.phase,
    theme: newTheme,
    technicalFocus: existing.technicalFocus,
    weeklyFocus: newTheme || existing.technicalFocus,
    pedagogicalRule: existing.pedagogicalRule,
    ageBand: "",
    sportProfile: "",
  });

  const newVersion = (existing.generationVersion ?? 0) + 1;
  const existingSnapshot = parseWeeklyPeriodizationSnapshot(existing.generationContextSnapshotJson);
  const blueprintSnapshot = (() => {
    try {
      return JSON.parse(blueprint.contextSnapshotJson);
    } catch {
      return null;
    }
  })();
  const decisionReasons = [
    ...existingSnapshot.decisionReasons,
    ...((blueprintSnapshot?.decisionReasons ?? []) as typeof existingSnapshot.decisionReasons),
    {
      kind: "pedagogy" as const,
      source: "periodization" as const,
      confidence: "high" as const,
      message: "Semana atualizada a partir do blueprint mensal persistido.",
      evidence: blueprint.title,
    },
  ];

  return {
    ...existing,
    theme: newTheme,
    generalObjective: isGeneralObjectiveManuallyOverridden
      ? existing.generalObjective
      : resolvedObjectives.generalObjective,
    specificObjective: isSpecificObjectiveManuallyOverridden
      ? existing.specificObjective
      : resolvedObjectives.specificObjective,
    generationVersion: newVersion,
    derivedFromBlueprintVersion: blueprint.generationVersion,
    generationContextSnapshotJson: serializeWeeklyPeriodizationSnapshot({
      ...existingSnapshot,
      monthlyBlueprint: blueprintSnapshot,
      decisionReasons,
    }),
    syncStatus: "in_sync",
    outOfSyncReasonsJson: "[]",
    lastAutoGeneratedAt: nowIso,
    updatedAt: nowIso,
  };
}
