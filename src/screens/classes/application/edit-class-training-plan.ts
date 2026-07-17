import type {
  TrainingPlan,
  TrainingPlanActivity,
} from "../../../core/models";
import {
  resolveTrainingPlanBlock,
  type TrainingPlanBlockKey,
} from "../../../core/training-plan-blocks";

export type ClassPlanBlockDraft = {
  duration: string;
  objective: string;
  activities: TrainingPlanActivity[];
};

export type ClassPlanPdfContentDraft = {
  generalObjective: string;
  specificObjective: string;
  situationProblem: string;
  observations: string;
};

export const getClassPlanPdfContentDraft = (plan: TrainingPlan): ClassPlanPdfContentDraft => ({
  generalObjective:
    plan.pedagogy?.learningObjectives?.general ||
    plan.pedagogy?.sessionObjective ||
    plan.pedagogy?.objective?.description ||
    "",
  specificObjective: getClassPlanSpecificObjective(plan),
  situationProblem: plan.pedagogy?.learningObjectives?.pedagogicalGuidelines?.[0] ?? "",
  observations: plan.pedagogy?.lessonPlanObservations ?? "",
});

export const updateClassPlanPdfContent = (
  plan: TrainingPlan,
  draft: ClassPlanPdfContentDraft
): TrainingPlan => {
  const currentObjectives = plan.pedagogy?.learningObjectives;
  const remainingGuidelines = currentObjectives?.pedagogicalGuidelines?.slice(1) ?? [];
  return {
    ...plan,
    pedagogy: {
      ...(plan.pedagogy ?? {}),
      sessionObjective: draft.generalObjective,
      sessionObjectiveSource: "manual",
      lessonPlanObservations: draft.observations,
      learningObjectives: {
        ...(currentObjectives ?? {}),
        general: draft.generalObjective,
        specific: [draft.specificObjective],
        pedagogicalGuidelines: [draft.situationProblem, ...remainingGuidelines],
      },
    },
  };
};

export const getClassPlanSpecificObjective = (plan: TrainingPlan): string => {
  const specific = plan.pedagogy?.learningObjectives?.specific;
  if (specific) return specific.join("\n");
  return plan.pedagogy?.objective?.description || plan.pedagogy?.sessionObjective || "";
};

export const updateClassPlanSpecificObjective = (
  plan: TrainingPlan,
  objective: string
): TrainingPlan => ({
  ...plan,
  pedagogy: {
    ...(plan.pedagogy ?? {}),
    learningObjectives: {
      general:
        plan.pedagogy?.learningObjectives?.general ||
        plan.pedagogy?.sessionObjective ||
        plan.pedagogy?.objective?.description ||
        "",
      ...(plan.pedagogy?.learningObjectives ?? {}),
      specific: [objective],
    },
  },
});

export const appendClassPlanActivity = (
  draft: ClassPlanBlockDraft
): ClassPlanBlockDraft => {
  const existingNames = new Set(
    draft.activities.map((activity) => String(activity.name ?? "").trim().toLocaleLowerCase("pt-BR"))
  );
  let suffix = 1;
  let name = "Nova atividade";

  while (existingNames.has(name.toLocaleLowerCase("pt-BR"))) {
    suffix += 1;
    name = `Nova atividade ${suffix}`;
  }

  return {
    ...draft,
    activities: [...draft.activities, { name, description: "" }],
  };
};

const durationFieldByBlock: Record<
  TrainingPlanBlockKey,
  "warmupTime" | "mainTime" | "cooldownTime"
> = {
  warmup: "warmupTime",
  main: "mainTime",
  cooldown: "cooldownTime",
};

const legacyFieldByBlock: Record<
  TrainingPlanBlockKey,
  "warmup" | "main" | "cooldown"
> = {
  warmup: "warmup",
  main: "main",
  cooldown: "cooldown",
};

const normalizeActivityText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();

const lowerFirst = (value: string) =>
  value.replace(/^./, (character) => character.toLocaleLowerCase("pt-BR"));

const resolvePlanFocusLabel = (plan: TrainingPlan) => {
  const focus =
    plan.pedagogy?.periodization?.technicalFocus ||
    plan.pedagogy?.focus?.skill ||
    plan.title.split("·").at(-1) ||
    "objetivo da aula";
  return lowerFirst(String(focus).trim() || "objetivo da aula");
};

export const buildLegacyClassPlanActivityDescription = (
  plan: TrainingPlan,
  blockKey: TrainingPlanBlockKey,
  activityName: string
) => {
  const activity = normalizeActivityText(activityName);
  const focus = resolvePlanFocusLabel(plan);

  if (blockKey === "warmup") {
    if (activity.includes("chama") && activity.includes("devolve")) {
      return "Organize a turma em duplas, com uma bola por dupla. Um aluno chama o colega, envia a bola de forma controlada e recebe a devolução; troque as funções após uma sequência curta.";
    }
    return `Organize a turma em duplas ou pequenos grupos. Comece em ritmo leve, aumente gradualmente os deslocamentos e use instruções curtas para preparar o grupo para ${focus}.`;
  }

  if (blockKey === "cooldown") {
    return `Reúna a turma, reduza gradualmente a intensidade e retome em uma conversa curta o que ajudou no desenvolvimento de ${focus} durante a aula.`;
  }

  if (
    activity.includes("dupla") &&
    (activity.includes("alvo") || activity.includes("zona"))
  ) {
    return "Organize a turma em duplas e marque uma zona-alvo com cones. Um aluno envia a bola e o colega ajusta a base para direcionar o passe ao alvo; troque as funções após cada série.";
  }

  if (
    activity.includes("jogo") &&
    (activity.includes("zona") || activity.includes("jogavel"))
  ) {
    return "Divida a turma em equipes pequenas e marque a zona de construção. A jogada continua quando o primeiro contato chega controlado à zona; faça rodízios curtos e incentive a comunicação.";
  }

  return `Delimite o espaço, organize rodízios curtos e explique a regra antes de iniciar. Observe a execução, dê feedback objetivo e ajuste o desafio para desenvolver ${focus}.`;
};

export const resolveClassPlanActivityDescription = (
  plan: TrainingPlan,
  blockKey: TrainingPlanBlockKey,
  activity: TrainingPlanActivity
) => {
  const storedDescription = String(activity.description ?? "").trim();
  if (storedDescription) return storedDescription;
  if (
    activity.organization ||
    activity.execution ||
    activity.presentation?.standardText
  ) {
    return "";
  }
  return buildLegacyClassPlanActivityDescription(plan, blockKey, activity.name);
};

export const buildClassPlanBlockDraft = (
  plan: TrainingPlan,
  blockKey: TrainingPlanBlockKey
): ClassPlanBlockDraft => {
  const block = resolveTrainingPlanBlock(plan, blockKey);
  return {
    duration: plan[durationFieldByBlock[blockKey]],
    objective: block.summary,
    activities: block.activities.map((activity) => ({
      ...activity,
      description:
        activity.description ||
        resolveClassPlanActivityDescription(plan, blockKey, activity),
    })),
  };
};

export const updateClassTrainingPlanBlock = (
  plan: TrainingPlan,
  blockKey: TrainingPlanBlockKey,
  draft: ClassPlanBlockDraft
): TrainingPlan => {
  const durationField = durationFieldByBlock[blockKey];
  const legacyField = legacyFieldByBlock[blockKey];
  const activities = draft.activities.map((activity) => ({ ...activity }));
  const blocks = {
    warmup: {
      summary: resolveTrainingPlanBlock(plan, "warmup").summary,
      activities: resolveTrainingPlanBlock(plan, "warmup").activities.map((activity) => ({ ...activity })),
    },
    main: {
      summary: resolveTrainingPlanBlock(plan, "main").summary,
      activities: resolveTrainingPlanBlock(plan, "main").activities.map((activity) => ({ ...activity })),
    },
    cooldown: {
      summary: resolveTrainingPlanBlock(plan, "cooldown").summary,
      activities: resolveTrainingPlanBlock(plan, "cooldown").activities.map((activity) => ({ ...activity })),
    },
  };

  blocks[blockKey] = {
    summary: draft.objective,
    activities,
  };

  return {
    ...plan,
    [durationField]: draft.duration,
    [legacyField]: activities.map((activity) => activity.name),
    pedagogy: {
      ...(plan.pedagogy ?? {}),
      blocks,
    },
  };
};

export const normalizeClassTrainingPlan = (plan: TrainingPlan): TrainingPlan => {
  const pdfContent = getClassPlanPdfContentDraft(plan);
  let normalizedPlan = updateClassPlanPdfContent(plan, {
    generalObjective: pdfContent.generalObjective.trim(),
    specificObjective: pdfContent.specificObjective.trim(),
    situationProblem: pdfContent.situationProblem.trim(),
    observations: pdfContent.observations.trim(),
  });

  (["warmup", "main", "cooldown"] as TrainingPlanBlockKey[]).forEach((blockKey) => {
    const draft = buildClassPlanBlockDraft(normalizedPlan, blockKey);
    normalizedPlan = updateClassTrainingPlanBlock(normalizedPlan, blockKey, {
      duration: draft.duration.trim(),
      objective: draft.objective.trim(),
      activities: draft.activities
        .map((activity) => ({
          ...activity,
          name: String(activity.name ?? "").trim(),
          description: String(activity.description ?? "").trim(),
        }))
        .filter((activity) => activity.name),
    });
  });

  return normalizedPlan;
};
