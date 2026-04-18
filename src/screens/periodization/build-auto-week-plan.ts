import { buildCompetitiveClassPlan } from "../../core/competitive-periodization";
import type {
    ClassCalendarException,
    ClassCompetitiveProfile,
    ClassGroup,
    ClassPlan,
} from "../../core/models";
import { resolveLearningObjectives } from "../../core/pedagogy/objective-language";
import {
    renderGameFormLabel,
    renderNextStepList,
    renderPedagogicalObjective,
    renderStageFocusSummary,
} from "../../core/pedagogy/pedagogical-renderer";
import {
    normalizeAgeBandKey,
    resolveNextPedagogicalStepFromPeriodization,
} from "../../core/pedagogy/resolve-next-pedagogical-step-from-periodization";
import { sanitizeVolleyballLanguage } from "../../core/pedagogy/volleyball-language-lexicon";
import type {
    PeriodizationModel,
    SportProfile,
} from "../../core/periodization-basics";
import { getDemandIndexForModel } from "../../core/periodization-basics";
import { buildClassPlan, getVolumeFromTargets } from "../../core/periodization-generator";
import { getPlannedLoads } from "../../core/periodization-load";
import { buildPeriodizationWeekSchedule } from "./application/build-auto-plan-for-cycle-day";

type BuildAutoWeekPlanParams = {
  selectedClass: ClassGroup | null;
  weekNumber: number;
  existing?: ClassPlan | null;
  cycleLength: number;
  activeCycleStartDate: string;
  isCompetitiveMode: boolean;
  calendarExceptions: ClassCalendarException[];
  competitiveProfile: ClassCompetitiveProfile | null;
  ageBand: "06-08" | "09-11" | "12-14";
  periodizationModel: PeriodizationModel;
  weeklySessions: number;
  sportProfile: SportProfile;
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const buildWeeklyPhysicalFocus = (params: {
  ageBand: BuildAutoWeekPlanParams["ageBand"];
  volume: ReturnType<typeof getVolumeFromTargets>;
}) => {
  const byBand = {
    "06-08": {
      baixo: "Coordenação leve, mobilidade e recuperação ativa",
      médio: "Coordenação, ritmo e deslocamento com bola",
      alto: "Velocidade curta, reação e coordenação global",
    },
    "09-11": {
      baixo: "Recuperação ativa, coordenação e mobilidade",
      médio: "Coordenação, agilidade e ritmo específico",
      alto: "Agilidade, reação e potência controlada",
    },
    "12-14": {
      baixo: "Recuperação ativa, mobilidade e controle de carga",
      médio: "Agilidade, potência controlada e ritmo específico",
      alto: "Velocidade, potência controlada e tolerância ao esforço",
    },
  } as const;

  return byBand[params.ageBand][params.volume];
};

const buildWeeklyTheme = (baseTheme: string, sessionLabels: string[]) =>
  uniqueStrings([baseTheme, sessionLabels.join(" | ")])
    .slice(0, 2)
    .join(" · ");

const buildWeeklyTechnicalFocus = (skillLabels: string[], progressionLabels: string[]) =>
  uniqueStrings([
    skillLabels.join(" / "),
    progressionLabels.length ? `Progressão em ${progressionLabels.join(" / ")}` : null,
  ])
    .slice(0, 2)
    .join(" · ");

const buildWeeklyConstraints = (params: {
  existingConstraints: string;
  weekNumber: number;
  classGoal: string;
  sessionSummary: string;
  volume: ReturnType<typeof getVolumeFromTargets>;
  pseTarget: string;
  demandIndex: number;
}) =>
  uniqueStrings([
    params.existingConstraints,
    params.sessionSummary ? `Semana ${params.weekNumber}: ${params.sessionSummary}` : null,
    params.classGoal ? `Objetivo da turma: ${params.classGoal}` : null,
    `Carga ${params.volume} · ${params.pseTarget} · Demanda ${params.demandIndex}/10`,
  ])
    .slice(0, 4)
    .join(" | ");

const buildWeekPlanMeta = (params: {
  plan: ClassPlan;
  weekNumber: number;
  weeklySessions: number;
  sportProfile: SportProfile;
  durationMinutes: number;
}) => {
  const volume = getVolumeFromTargets(params.plan.phase, params.plan.rpeTarget);
  const plannedLoads = getPlannedLoads(
    params.plan.rpeTarget,
    Math.max(15, params.durationMinutes),
    params.weeklySessions
  );

  return {
    week: params.weekNumber,
    title: params.plan.phase,
    focus: params.plan.theme,
    volume,
    notes: [params.plan.constraints, params.plan.warmupProfile].filter(Boolean),
    jumpTarget: params.plan.jumpTarget,
    PSETarget: params.plan.rpeTarget,
    plannedSessionLoad: plannedLoads.plannedSessionLoad,
    plannedWeeklyLoad: plannedLoads.plannedWeeklyLoad,
    source: params.plan.source,
  };
};

const resolveWeekMonthIndex = (cycleStartDate: string, weekNumber: number): number => {
  const baseIso = /^\d{4}-\d{2}-\d{2}$/.test(cycleStartDate) ? cycleStartDate : "";
  const base = baseIso ? new Date(`${baseIso}T00:00:00`) : new Date();
  const safeWeek = Number.isFinite(weekNumber) ? Math.max(1, weekNumber) : 1;
  const shifted = new Date(base.getTime() + (safeWeek - 1) * 7 * 24 * 60 * 60 * 1000);
  return shifted.getMonth() + 1;
};

export const buildAutoWeekPlan = (
  params: BuildAutoWeekPlanParams
): ClassPlan | null => {
  const { selectedClass, existing } = params;

  if (!selectedClass) return null;

  const plan = params.isCompetitiveMode
    ? params.competitiveProfile
      ? buildCompetitiveClassPlan({
          classId: selectedClass.id,
          weekNumber: params.weekNumber,
          cycleLength: params.cycleLength,
          cycleStartDate: params.activeCycleStartDate,
          daysOfWeek: selectedClass.daysOfWeek ?? [],
          exceptions: params.calendarExceptions,
          profile: params.competitiveProfile,
          source: "AUTO",
          existingId: existing?.id,
          existingCreatedAt: existing?.createdAt,
        })
      : null
    : buildClassPlan({
        classId: selectedClass.id,
        ageBand: params.ageBand,
        startDate: params.activeCycleStartDate,
        weekNumber: params.weekNumber,
        source: "AUTO",
        mvLevel: selectedClass.mvLevel,
        cycleLength: params.cycleLength,
        model: params.periodizationModel,
        sessionsPerWeek: params.weeklySessions,
        sport: params.sportProfile,
      });

  if (!plan) return null;

  if (!params.isCompetitiveMode) {
    const weekPlan = buildWeekPlanMeta({
      plan,
      weekNumber: params.weekNumber,
      weeklySessions: params.weeklySessions,
      sportProfile: params.sportProfile,
      durationMinutes: selectedClass.durationMinutes,
    });
    const demandIndex = getDemandIndexForModel(
      weekPlan.volume,
      params.periodizationModel,
      params.weeklySessions,
      params.sportProfile
    );
    const periodizationWeek = buildPeriodizationWeekSchedule({
      classGroup: selectedClass,
      classPlan: plan,
      weekPlan,
      cycleStartDate: params.activeCycleStartDate,
      periodizationModel: params.periodizationModel,
      sportProfile: params.sportProfile,
      weeklySessions: params.weeklySessions,
    });
    const autoPlans = periodizationWeek
      .map((item) => item.autoPlan)
      .filter((item): item is NonNullable<(typeof periodizationWeek)[number]["autoPlan"]> => Boolean(item));

    if (autoPlans.length) {
      const skillLabels = uniqueStrings(autoPlans.map((item) => item.primarySkillLabel)).slice(0, 2);
      const sessionLabels = uniqueStrings(autoPlans.map((item) => item.sessionLabel)).slice(0, 2);
      const progressionLabels = uniqueStrings(autoPlans.map((item) => item.progressionLabel)).slice(0, 2);
      const sessionSummary = autoPlans
        .slice(0, 3)
        .map((item) => `S${item.sessionIndexInWeek}: ${item.sessionLabel}`)
        .join(" | ");

      plan.theme = buildWeeklyTheme(plan.theme, sessionLabels) || plan.theme;
      plan.technicalFocus = buildWeeklyTechnicalFocus(skillLabels, progressionLabels) || plan.technicalFocus;
      plan.physicalFocus = buildWeeklyPhysicalFocus({
        ageBand: params.ageBand,
        volume: weekPlan.volume,
      });
      plan.warmupProfile = autoPlans[0]?.pedagogicalIntentLabel || plan.warmupProfile;
      plan.constraints = buildWeeklyConstraints({
        existingConstraints: plan.constraints,
        weekNumber: params.weekNumber,
        classGoal: selectedClass.goal,
        sessionSummary,
        volume: weekPlan.volume,
        pseTarget: weekPlan.PSETarget,
        demandIndex,
      });
    }

    const ageBandKey = normalizeAgeBandKey(selectedClass.ageBand ?? "") ?? normalizeAgeBandKey(params.ageBand);
    const monthIndex = resolveWeekMonthIndex(params.activeCycleStartDate, params.weekNumber);
    const nextPedagogicalStep = ageBandKey
      ? resolveNextPedagogicalStepFromPeriodization({ ageBand: ageBandKey, monthIndex })
      : null;

    if (nextPedagogicalStep) {
      const stageSummary = sanitizeVolleyballLanguage(renderStageFocusSummary(nextPedagogicalStep));
      const nextStepList = sanitizeVolleyballLanguage(renderNextStepList(nextPedagogicalStep).join(" / "));
      const objective = sanitizeVolleyballLanguage(renderPedagogicalObjective(nextPedagogicalStep));
      const gameFormLabel = sanitizeVolleyballLanguage(renderGameFormLabel(nextPedagogicalStep));

      plan.theme = stageSummary || plan.theme;
      plan.technicalFocus = nextStepList || plan.technicalFocus;
      plan.pedagogicalRule = sanitizeVolleyballLanguage(`Forma de jogo da etapa: ${gameFormLabel}.`) || plan.pedagogicalRule;
      plan.constraints = uniqueStrings([
        plan.constraints,
        `Etapa pedagógica: ${stageSummary}`,
        `Próximo foco: ${nextStepList}`,
      ])
        .slice(0, 5)
        .join(" | ");
      plan.generalObjective = objective || plan.generalObjective;
      plan.specificObjective = nextStepList || plan.specificObjective;
    }
  }

  const resolvedObjectives = resolveLearningObjectives({
    generalObjective: plan.generalObjective,
    specificObjective: plan.specificObjective || plan.technicalFocus,
    title: plan.phase,
    theme: plan.theme,
    technicalFocus: plan.technicalFocus,
    weeklyFocus: plan.theme || plan.technicalFocus,
    pedagogicalRule: plan.pedagogicalRule,
    ageBand: selectedClass.ageBand,
    sportProfile: params.sportProfile,
  });
  plan.generalObjective = sanitizeVolleyballLanguage(resolvedObjectives.generalObjective);
  plan.specificObjective = sanitizeVolleyballLanguage(resolvedObjectives.specificObjective);
  plan.theme = sanitizeVolleyballLanguage(plan.theme);
  plan.technicalFocus = sanitizeVolleyballLanguage(plan.technicalFocus);
  plan.constraints = sanitizeVolleyballLanguage(plan.constraints);
  plan.pedagogicalRule = sanitizeVolleyballLanguage(plan.pedagogicalRule ?? "") || plan.pedagogicalRule;

  if (existing) {
    plan.id = existing.id;
    plan.createdAt = existing.createdAt;
  }

  return plan;
};
