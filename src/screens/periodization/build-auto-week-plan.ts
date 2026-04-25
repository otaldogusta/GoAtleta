import { buildCompetitiveClassPlan } from "../../core/competitive-periodization";
import type {
    ClassCalendarException,
    ClassCompetitiveProfile,
    ClassGroup,
    ClassPlan,
    DailyLessonPlan,
    SessionPrimaryComponent,
    TeamTrainingContext,
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
import { buildWeeklyIntegratedContext } from "../../core/resistance/resolve-session-environment";
import { resolveTeamTrainingContext } from "../../core/resistance/training-context";
import { buildPeriodizationWeekSchedule } from "./application/build-auto-plan-for-cycle-day";
import {
    resolveWeekStrategyFromCycleContext,
    toWeeklyOperationalStrategySnapshot,
} from "./application/resolve-week-strategy-from-cycle-context";

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
  recentDailyLessonPlans?: DailyLessonPlan[];
  /** Optional: pass when caller already has a resolved TeamTrainingContext */
  teamTrainingContext?: TeamTrainingContext;
};

const uniqueStrings = (values: (string | null | undefined)[]) =>
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

const deriveSessionPrimaryComponent = (params: {
  sessionEnvironment?: string;
  sessionComponents?: { type?: string }[];
}): SessionPrimaryComponent | undefined => {
  if (params.sessionComponents?.some((item) => item.type === "academia_resistido")) {
    if (params.sessionComponents.some((item) => item.type === "quadra_tecnico_tatico")) {
      return "misto_transferencia";
    }
    return "resistido";
  }

  if (params.sessionComponents?.some((item) => item.type === "preventivo")) {
    return "preventivo";
  }

  if (params.sessionEnvironment === "quadra") return "tecnico_tatico";
  if (params.sessionEnvironment === "mista") return "misto_transferencia";
  if (params.sessionEnvironment === "preventiva") return "preventivo";
  if (params.sessionEnvironment === "academia") return "resistido";
  return undefined;
};

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

const normalizeSignalText = (value: string | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const hasManualOverrideSignal = (plan: DailyLessonPlan) => {
  try {
    const parsed = JSON.parse(plan.manualOverrideMaskJson ?? "[]");
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
};

const extractWeeklyPedagogicalSignals = (plans: DailyLessonPlan[] | undefined) => {
  const recentConfirmedSkills: string[] = [];
  const recentContexts: string[] = [];
  const recentTeacherOverrides: string[] = [];
  const stageIds: string[] = [];

  for (const plan of (plans ?? []).slice(0, 6)) {
    try {
      const parsed = JSON.parse(plan.generationContextSnapshotJson ?? "{}") as {
        nextPedagogicalStep?: {
          stageId?: string;
          nextStep?: string[];
          alreadyIntroduced?: string[];
          alreadyPracticedContexts?: string[];
          blockRecommendations?: {
            main?: { contexts?: string[] };
          };
        };
      };

      const stageId = parsed?.nextPedagogicalStep?.stageId;
      if (stageId) {
        stageIds.push(stageId);
      }

      for (const skill of parsed?.nextPedagogicalStep?.nextStep ?? []) {
        if (!recentConfirmedSkills.includes(skill)) {
          recentConfirmedSkills.push(skill);
        }
      }

      for (const skill of parsed?.nextPedagogicalStep?.alreadyIntroduced ?? []) {
        if (!recentConfirmedSkills.includes(skill)) {
          recentConfirmedSkills.push(skill);
        }
      }

      for (const context of parsed?.nextPedagogicalStep?.alreadyPracticedContexts ?? []) {
        if (!recentContexts.includes(context)) {
          recentContexts.push(context);
        }
      }

      for (const context of parsed?.nextPedagogicalStep?.blockRecommendations?.main?.contexts ?? []) {
        if (!recentContexts.includes(context)) {
          recentContexts.push(context);
        }
      }
    } catch {
      // Ignore malformed legacy snapshots.
    }

    const freeText = normalizeSignalText(
      [plan.title, plan.warmup, plan.mainPart, plan.cooldown, plan.observations].join(" ")
    );
    if (/(revis|retom|segur|manter simples|base)/.test(freeText)) {
      recentTeacherOverrides.push("revisar e consolidar fundamentos da turma");
    }
    if (/(avanc|progred|autonom|mais desafio|subir nivel)/.test(freeText)) {
      recentTeacherOverrides.push("avançar com autonomia progressiva");
    }
    if (hasManualOverrideSignal(plan)) {
      recentTeacherOverrides.push("ajustar progressão conforme intervenção docente recente");
    }
  }

  const hasRepeatedStage = stageIds.length >= 2 && new Set(stageIds).size < stageIds.length;

  let historicalConfidence = 0.5;
  if (recentConfirmedSkills.length >= 2 || recentContexts.length >= 2) {
    historicalConfidence = 0.7;
  }
  if (hasRepeatedStage) {
    historicalConfidence = 0.85;
  }
  if (recentConfirmedSkills.length >= 4 || recentContexts.length >= 4) {
    historicalConfidence = Math.max(historicalConfidence, 0.9);
  }

  return {
    recentConfirmedSkills: recentConfirmedSkills.slice(0, 6),
    recentContexts: recentContexts.slice(0, 6),
    recentTeacherOverrides: uniqueStrings(recentTeacherOverrides).slice(0, 3),
    historicalConfidence,
  };
};

const parseSnapshot = (value: string | undefined) => {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const buildAutoWeekPlan = (
  params: BuildAutoWeekPlanParams
): ClassPlan | null => {
  const { selectedClass, existing } = params;

  if (!selectedClass) return null;

  const plan: ClassPlan | null = params.isCompetitiveMode
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
    const ageBandKey = normalizeAgeBandKey(selectedClass.ageBand ?? "") ?? normalizeAgeBandKey(params.ageBand);
    const monthIndex = resolveWeekMonthIndex(params.activeCycleStartDate, params.weekNumber);
    const weeklySignals = extractWeeklyPedagogicalSignals(params.recentDailyLessonPlans);
    const nextPedagogicalStep = ageBandKey
      ? resolveNextPedagogicalStepFromPeriodization({
          ageBand: ageBandKey,
          monthIndex,
          recentConfirmedSkills: weeklySignals.recentConfirmedSkills,
          recentContexts: weeklySignals.recentContexts,
          teacherOverrides: weeklySignals.recentTeacherOverrides,
          historicalConfidence: weeklySignals.historicalConfidence,
        })
      : null;
    const weeklyOperationalStrategy = resolveWeekStrategyFromCycleContext({
      ageBand: ageBandKey,
      monthIndex,
      weeklySessions: params.weeklySessions,
      weeklyVolume: weekPlan.volume,
      historicalConfidence: weeklySignals.historicalConfidence,
      recentTeacherOverrides: weeklySignals.recentTeacherOverrides,
      nextPedagogicalStep,
    });

    const periodizationWeek = buildPeriodizationWeekSchedule({
      classGroup: selectedClass,
      classPlan: plan,
      weekPlan,
      cycleStartDate: params.activeCycleStartDate,
      periodizationModel: params.periodizationModel,
      sportProfile: params.sportProfile,
      weeklySessions: params.weeklySessions,
      weeklyOperationalDecisions: weeklyOperationalStrategy.decisions,
    });
    const autoPlans = periodizationWeek
      .map((item) => item.autoPlan)
      .filter((item): item is NonNullable<(typeof periodizationWeek)[number]["autoPlan"]> => Boolean(item));
    const decisionsWithEnvironment = weeklyOperationalStrategy.decisions.map((decision) => {
      const autoPlan = autoPlans.find(
        (item) => item.sessionIndexInWeek === decision.sessionIndexInWeek,
      );
      return {
        ...decision,
        sessionEnvironment:
          autoPlan?.sessionEnvironment ?? decision.sessionEnvironment,
        sessionPrimaryComponent:
          autoPlan?.sessionComponents?.length
            ? deriveSessionPrimaryComponent({
                sessionEnvironment: autoPlan.sessionEnvironment,
                sessionComponents: autoPlan.sessionComponents.map((component) => ({
                  type: component.type,
                })),
              })
            : decision.sessionPrimaryComponent,
      };
    });
    const snapshot = {
      ...parseSnapshot(plan.generationContextSnapshotJson),
      weeklyOperationalStrategy: toWeeklyOperationalStrategySnapshot({
        ...weeklyOperationalStrategy,
        decisions: decisionsWithEnvironment,
      }),
    };
    plan.generationContextSnapshotJson = JSON.stringify(snapshot);
    plan.weekNotes = sanitizeVolleyballLanguage(weeklyOperationalStrategy.weekIntentSummary);

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

    if (nextPedagogicalStep) {
      const stageSummary = sanitizeVolleyballLanguage(renderStageFocusSummary(nextPedagogicalStep));
      const nextStepList = sanitizeVolleyballLanguage(renderNextStepList(nextPedagogicalStep).join(" / "));
      const objective = sanitizeVolleyballLanguage(renderPedagogicalObjective(nextPedagogicalStep));
      const gameFormLabel = sanitizeVolleyballLanguage(renderGameFormLabel(nextPedagogicalStep));

      plan.theme = stageSummary || plan.theme;
      plan.technicalFocus = nextStepList || plan.technicalFocus;
      plan.pedagogicalRule =
        sanitizeVolleyballLanguage(
          `Forma de jogo da etapa: ${gameFormLabel}. Foco do trimestre: ${weeklyOperationalStrategy.quarterFocus}.`
        ) || plan.pedagogicalRule;
      plan.constraints = uniqueStrings([
        plan.constraints,
        `Etapa pedagógica: ${stageSummary}`,
        `Próximo foco: ${nextStepList}`,
        `Seleção da etapa: ${nextPedagogicalStep.selectionReason}`,
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

  // R5: build and attach weekly integrated training context
  const teamCtx = params.teamTrainingContext ?? resolveTeamTrainingContext(selectedClass);
  const integratedCtx = buildWeeklyIntegratedContext({
    teamContext: teamCtx,
    classGroup: selectedClass,
    weeklySessions: params.weeklySessions,
  });
  plan.weeklyIntegratedContextJson = JSON.stringify(integratedCtx);

  return plan;
};
