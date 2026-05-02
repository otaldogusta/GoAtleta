import type {
  ClassGroup,
  ClassPlan,
  DailyLessonPlan,
  LessonBlock,
  SessionComponent,
  TrainingPlan,
  TrainingPlanActivity,
} from "../../../core/models";
import { getLessonBlockTimes } from "../../../utils/lesson-block-times";

const parseBlocks = (value: string | undefined): LessonBlock[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LessonBlock => {
      const key = String(item?.key ?? "");
      return key === "warmup" || key === "main" || key === "cooldown";
    });
  } catch {
    return [];
  }
};

const componentToActivity = (component: SessionComponent): TrainingPlanActivity => {
  if (component.type === "academia_resistido") {
    const exercises = component.resistancePlan.exercises
      .map((exercise) => `${exercise.name}: ${exercise.sets}x${exercise.reps}, descanso ${exercise.rest}`)
      .join("; ");
    return {
      name: component.resistancePlan.label || "Sessão resistida",
      description:
        exercises ||
        `Bloco resistido com foco em ${component.resistancePlan.primaryGoal}.`,
      objective: component.resistancePlan.transferTarget,
      source: "fallback",
    };
  }

  return {
    name: component.type === "preventivo" ? "Bloco preventivo" : "Bloco de quadra",
    description: component.description,
    source: "fallback",
  };
};

const blockActivities = (
  blocks: LessonBlock[],
  key: LessonBlock["key"],
  legacyText: string,
  components: SessionComponent[] = []
): TrainingPlanActivity[] => {
  const block = blocks.find((item) => item.key === key);
  const activities = block?.activities
    ?.flatMap((activity): TrainingPlanActivity[] => {
      const name = activity.name?.trim() || activity.description?.trim();
      if (!name) return [];
      return [
        {
          name,
          description: activity.description?.trim(),
          source: "fallback",
        },
      ];
    });

  if (activities?.length) return activities;

  if (key === "main" && components.length) {
    return components.map(componentToActivity);
  }

  const cleaned = legacyText.trim();
  if (!cleaned) return [];
  return [{ name: cleaned, description: cleaned, source: "fallback" }];
};

const namesFromActivities = (activities: TrainingPlanActivity[]) =>
  activities
    .map((activity) => activity.name?.trim())
    .filter((name): name is string => Boolean(name));

const durationLabel = (minutes: number) => `${Math.max(0, Math.round(minutes))} min`;

const ensureSentenceEnding = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const cleanObjectiveText = (value: string) =>
  ensureSentenceEnding(
    value
      .replace(/^Objetivo da aula:\s*/i, "")
      .replace(/^Desenvolver\s+controlar\s+a\s+primeira\s+bola/i, "Desenvolver o controle da primeira bola")
      .replace(/^Desenvolver\s+controlar\s+/i, "Desenvolver o controle de ")
      .replace(/\s+/g, " ")
      .trim()
  );

const extractObservationLine = (observations: string | undefined, label: string) => {
  const pattern = new RegExp(`^${label}:\\s*(.+)$`, "im");
  const match = String(observations ?? "").match(pattern);
  return match?.[1]?.trim() ?? "";
};

const resolveDailySessionObjective = (input: {
  dailyPlan: DailyLessonPlan;
  classPlan: ClassPlan | null;
}) => {
  const explicitObjective =
    extractObservationLine(input.dailyPlan.observations, "Objetivo da aula") ||
    input.classPlan?.specificObjective ||
    input.classPlan?.generalObjective ||
    input.dailyPlan.title;
  return cleanObjectiveText(explicitObjective);
};

export function convertDailyLessonPlanToTrainingPlan(input: {
  dailyPlan: DailyLessonPlan;
  classPlan: ClassPlan | null;
  classGroup: ClassGroup;
  studentsCount: number;
  sessionDate: string;
  weekdayId: number;
}): TrainingPlan {
  const { dailyPlan, classPlan, classGroup, sessionDate } = input;
  const blocks = parseBlocks(dailyPlan.blocksJson);
  const defaultTimes = getLessonBlockTimes(classGroup.durationMinutes || 60);
  const warmupBlock = blocks.find((item) => item.key === "warmup");
  const mainBlock = blocks.find((item) => item.key === "main");
  const cooldownBlock = blocks.find((item) => item.key === "cooldown");
  const warmupActivities = blockActivities(blocks, "warmup", dailyPlan.warmup);
  const mainActivities = blockActivities(
    blocks,
    "main",
    dailyPlan.mainPart,
    dailyPlan.sessionComponents
  );
  const cooldownActivities = blockActivities(blocks, "cooldown", dailyPlan.cooldown);
  const sessionObjective = resolveDailySessionObjective({ dailyPlan, classPlan });
  const focusLine = extractObservationLine(dailyPlan.observations, "Foco da aula");
  const successCriterion = extractObservationLine(dailyPlan.observations, "Critério de sucesso");
  const createdAt =
    dailyPlan.lastManualEditedAt ||
    dailyPlan.updatedAt ||
    dailyPlan.lastAutoGeneratedAt ||
    new Date().toISOString();

  return {
    id: `effective_daily_${dailyPlan.id}`,
    classId: dailyPlan.classId,
    title: dailyPlan.title || `${classGroup.name} · Plano diário`,
    tags: [
      "origem:planejamento_turma",
      `tipo:${dailyPlan.sessionEnvironment || "quadra"}`,
      `semana:${classPlan?.weekNumber ?? "-"}`,
    ],
    warmup: namesFromActivities(warmupActivities),
    main: namesFromActivities(mainActivities),
    cooldown: namesFromActivities(cooldownActivities),
    warmupTime: durationLabel(warmupBlock?.durationMinutes ?? defaultTimes.warmupMinutes),
    mainTime: durationLabel(mainBlock?.durationMinutes ?? defaultTimes.mainMinutes),
    cooldownTime: durationLabel(cooldownBlock?.durationMinutes ?? defaultTimes.cooldownMinutes),
    applyDays: [],
    applyDate: sessionDate,
    createdAt,
    status: "final",
    origin: "auto",
    generatedAt: dailyPlan.lastAutoGeneratedAt,
    finalizedAt: createdAt,
    pedagogy: {
      generationExplanation: {
        historyMode: "partial_history",
        summary: "Plano diário salvo no planejamento da turma.",
        coachSummary: "Planejamento da turma",
        planningBasis: "cycle_based",
        generationMode: "periodized",
      },
      periodization: classPlan
        ? {
            phase: classPlan.phase,
            theme: classPlan.theme,
            technicalFocus: classPlan.technicalFocus,
            physicalFocus: classPlan.physicalFocus,
            constraints: classPlan.constraints,
            rpeTarget: classPlan.rpeTarget,
            weekNumber: classPlan.weekNumber,
            startDate: classPlan.startDate,
          }
        : undefined,
      sessionObjective,
      learningObjectives: {
        general: sessionObjective,
        specific: focusLine ? [focusLine] : [],
        successCriteria: successCriterion ? [successCriterion] : [],
        pedagogicalGuidelines: focusLine
          ? [`Foco pedagógico: ${focusLine}`]
          : [],
      },
      blocks: {
        warmup: {
          summary: dailyPlan.warmup,
          activities: warmupActivities,
        },
        main: {
          summary: dailyPlan.mainPart,
          activities: mainActivities,
        },
        cooldown: {
          summary: dailyPlan.cooldown,
          activities: cooldownActivities,
        },
      },
      objective: {
        type: dailyPlan.sessionPrimaryComponent === "resistido" ? "fisico" : "tecnico",
        description:
          classPlan?.specificObjective ||
          classPlan?.generalObjective ||
          sessionObjective ||
          dailyPlan.title,
      },
    },
  };
}
