import type { ClassGroup, ClassPlan } from "../../../core/models";
import { resolveLearningObjectives } from "../../../core/pedagogy/objective-language";
import {
    listDailyLessonPlansByWeekIds,
    updateClassPlan,
    upsertDailyLessonPlan
} from "../../../db/seed";
import { buildWeekSessionPreview } from "../../periodization/application/build-week-session-preview";
import { generateMonthlyBlueprint } from "./generate-monthly-blueprint";
import { regenerateDailyLessonPlanFromWeek } from "./regenerate-daily-lesson-plan";

export interface MonthRegenerationProgress {
  stage: "blueprint" | "weeklies" | "dailies" | "complete";
  currentIndex?: number;
  total?: number;
  message: string;
}

export interface RegenerateMonthPlansParams {
  classGroup: ClassGroup;
  monthKey: string; // "YYYY-MM"
  classPlans: ClassPlan[];
  activeCycleStartDate?: string;
  activeCycleEndDate?: string;
  onProgress?: (progress: MonthRegenerationProgress) => void;
}

/**
 * Orchestrate full-month regeneration:
 * 1. Generate monthly blueprint (context for weekly generation)
 * 2. Regenerate all weekly plans for the month (bump versions, preserve edits)
 * 3. Regenerate all daily lesson plans for the month (preserve overrides)
 *
 * All operations are local-first (SQLite) with progress callbacks for UI feedback.
 */
export const regenerateMonthPlans = async (params: RegenerateMonthPlansParams): Promise<void> => {
  const { classGroup, monthKey, classPlans, activeCycleStartDate, activeCycleEndDate, onProgress } = params;
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  // Filter to monthly plans
  const monthlyPlans = classPlans.filter((plan) => {
    if (!plan.startDate) return false;
    const startDate = new Date(plan.startDate);
    return startDate.getFullYear() === year && startDate.getMonth() + 1 === month;
  });

  if (!monthlyPlans.length) {
    onProgress?.({ stage: "complete", message: "Nenhum plano semanal neste mês" });
    return;
  }

  // === Stage 1: Generate monthly blueprint ===
  onProgress?.({ stage: "blueprint", message: "Gerando blueprint mensal..." });
  const blueprint = generateMonthlyBlueprint({
    classGroup,
    monthKey,
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

    // Rebuild sessions for this week (same logic as UI)
    const weekSessionPreviews = buildWeekSessionPreview({
      startDate: weekPlan.startDate || "",
      daysOfWeek: weekPlan.daysOfWeek ? JSON.parse(weekPlan.daysOfWeek) : [],
      weeklySessions: weekPlan.weeklySessions || 0,
    });

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
        weeklyPlan,
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
    syncStatus: "in_sync",
    outOfSyncReasonsJson: "[]",
    lastAutoGeneratedAt: nowIso,
    updatedAt: nowIso,
  };
}
