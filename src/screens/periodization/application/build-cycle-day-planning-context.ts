import { buildCycleDayPlanningContext } from "../../../core/cycle-day-planning/build-cycle-day-planning-context";
import { resolveSessionIndexInWeek } from "../../../core/cycle-day-planning/resolve-session-index-in-week";
import type {
    ClassGroup,
    ClassPlan,
    CycleDayPlanningContext,
    RecentSessionSummary,
    WeeklyOperationalDecision,
} from "../../../core/models";
import type { PeriodizationModel, SportProfile, VolumeLevel } from "../../../core/periodization-basics";
import { getDemandIndexForModel } from "../../../core/periodization-basics";

type PeriodizationWeekPlanInput = {
  week: number;
  title: string;
  focus: string;
  volume: VolumeLevel;
  notes: string[];
  jumpTarget: string;
  PSETarget: string;
  plannedSessionLoad: number;
  plannedWeeklyLoad: number;
  source: "AUTO" | "MANUAL";
};

export type BuildPeriodizationCycleDayPlanningContextParams = {
  classGroup: ClassGroup;
  classPlan?: ClassPlan | null;
  weekPlan: PeriodizationWeekPlanInput;
  sessionDate: string;
  periodizationModel: PeriodizationModel;
  sportProfile: SportProfile;
  weeklySessions: number;
  dominantBlock?: string;
  macroLabel?: string;
  mesoLabel?: string;
  recentSessions?: RecentSessionSummary[] | null;
  weeklyOperationalDecision?: WeeklyOperationalDecision;
};

export type PeriodizationCycleDayPlanningContext = {
  cycleContext: CycleDayPlanningContext;
  sessionIndexInWeek: number;
  demandIndex: number;
  plannedSessionLoad: number;
  plannedWeeklyLoad: number;
  dominantBlock?: string;
  macroLabel?: string;
  mesoLabel?: string;
  volume: VolumeLevel;
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const buildEffectiveClassPlan = (params: BuildPeriodizationCycleDayPlanningContextParams): ClassPlan => {
  const nowIso = params.classPlan?.updatedAt ?? new Date().toISOString();
  const constraintParts = uniqueStrings([
    params.classGroup.goal,
    params.classPlan?.constraints,
    ...params.weekPlan.notes,
    params.dominantBlock ? `Bloco dominante: ${params.dominantBlock}` : null,
    params.macroLabel ? `Macro: ${params.macroLabel}` : null,
    params.mesoLabel ? `Meso: ${params.mesoLabel}` : null,
    `Demanda: ${getDemandIndexForModel(
      params.weekPlan.volume,
      params.periodizationModel,
      params.weeklySessions,
      params.sportProfile
    )}/10`,
    `Carga sessao: ${Math.round(params.weekPlan.plannedSessionLoad)}`,
    `Carga semana: ${Math.round(params.weekPlan.plannedWeeklyLoad)}`,
  ]);

  return {
    id: params.classPlan?.id ?? `periodization_${params.classGroup.id}_${params.weekPlan.week}`,
    classId: params.classGroup.id,
    startDate: params.classPlan?.startDate ?? params.classGroup.cycleStartDate,
    weekNumber: params.weekPlan.week,
    phase: params.classPlan?.phase || params.weekPlan.title,
    theme: params.classPlan?.theme || params.weekPlan.focus,
    technicalFocus: params.classPlan?.technicalFocus || params.weekPlan.focus,
    physicalFocus: params.classPlan?.physicalFocus || params.dominantBlock || params.weekPlan.title,
    constraints: constraintParts.join(" | "),
    mvFormat: params.classPlan?.mvFormat || "",
    warmupProfile: params.classPlan?.warmupProfile || params.weekPlan.notes[0] || params.dominantBlock || "",
    jumpTarget: params.classPlan?.jumpTarget || params.weekPlan.jumpTarget,
    rpeTarget: params.weekPlan.PSETarget || params.classPlan?.rpeTarget || "",
    source: params.classPlan?.source ?? params.weekPlan.source,
    createdAt: params.classPlan?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
};

export const buildPeriodizationCycleDayPlanningContext = (
  params: BuildPeriodizationCycleDayPlanningContextParams
): PeriodizationCycleDayPlanningContext => {
  const sessionIndexInWeek = resolveSessionIndexInWeek({
    daysOfWeek: params.classGroup.daysOfWeek,
    sessionDate: params.sessionDate,
  });
  const effectiveClassPlan = buildEffectiveClassPlan(params);
  const baseContext = buildCycleDayPlanningContext({
    classGroup: params.classGroup,
    classPlan: effectiveClassPlan,
    sessionDate: params.sessionDate,
    recentSessions: params.recentSessions,
    sessionIndexInWeek,
  });
  const demandIndex = getDemandIndexForModel(
    params.weekPlan.volume,
    params.periodizationModel,
    params.weeklySessions,
    params.sportProfile
  );

  return {
    cycleContext: {
      ...baseContext,
      dominantBlock: params.dominantBlock ?? baseContext.dominantBlock,
      constraints: uniqueStrings([
        ...baseContext.constraints,
        params.dominantBlock ? `Bloco dominante: ${params.dominantBlock}` : null,
        params.macroLabel ? `Macro: ${params.macroLabel}` : null,
        params.mesoLabel ? `Meso: ${params.mesoLabel}` : null,
        `Demanda prevista ${demandIndex}/10`,
        `Carga planejada ${Math.round(params.weekPlan.plannedSessionLoad)}`,
      ]),
      targetPse:
        baseContext.targetPse ??
        (Number.isFinite(Number(params.weekPlan.PSETarget.match(/(\d+)/)?.[1]))
          ? Number(params.weekPlan.PSETarget.match(/(\d+)/)?.[1])
          : undefined),
      weeklyOperationalDecision:
        params.weeklyOperationalDecision ?? baseContext.weeklyOperationalDecision,
    },
    sessionIndexInWeek,
    demandIndex,
    plannedSessionLoad: params.weekPlan.plannedSessionLoad,
    plannedWeeklyLoad: params.weekPlan.plannedWeeklyLoad,
    dominantBlock: params.dominantBlock,
    macroLabel: params.macroLabel,
    mesoLabel: params.mesoLabel,
    volume: params.weekPlan.volume,
  };
};
