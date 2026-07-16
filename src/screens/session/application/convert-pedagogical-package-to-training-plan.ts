import type {
  ProgressionDimension,
  TrainingPlan,
  TrainingPlanActivity,
  TrainingPlanPedagogy,
  TrainingPlanObjectiveType,
  VolleyballSkill,
} from "../../../core/models";
import { sanitizeUntrustedAcademicContent } from "../../../core/document-intelligence";
import type { PedagogicalPlanPackage } from "../../../core/pedagogical-planning";
import { createTrainingPlanVersion } from "../../../core/training-plan-factory";
import { getLessonBlockTimes } from "../../../utils/lesson-block-times";

const pedagogicalObjectiveLabels: Record<string, string> = {
  controle_bola: "Controle de bola",
  passe: "Passe",
  resistencia: "Resistência",
  jogo_reduzido: "Jogo reduzido",
};

const volleyballSkillLabels: Record<VolleyballSkill, string> = {
  saque: "Saque",
  passe: "Passe",
  levantamento: "Levantamento",
  ataque: "Ataque",
  bloqueio: "Bloqueio",
  defesa: "Defesa",
  transicao: "Transição",
};

const normalizePedagogicalText = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const uniqueStrings = (values: (string | null | undefined)[]) =>
  [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];

const getAppliedDocumentReferences = (pkg: PedagogicalPlanPackage) =>
  pkg.input.sessionPlanningContext?.documentSupport?.references ??
  pkg.input.sessionPlanningContext?.academicSupport?.references ??
  [];

const buildDocumentPedagogicalGuidelines = (pkg: PedagogicalPlanPackage) =>
  uniqueStrings(
    getAppliedDocumentReferences(pkg).map(
      (reference) =>
        sanitizeUntrustedAcademicContent(reference.influence)
          .sanitizedContent.replace(/\s+/g, " ")
          .trim()
          .slice(0, 240)
    )
  );

const inferFocusSkill = (pkg: PedagogicalPlanPackage): VolleyballSkill => {
  const structuredSkill = [
    ...pkg.final.main.activities,
    ...pkg.final.warmup.activities,
    ...pkg.final.cooldown.activities,
  ].find((activity) => activity.primarySkill)?.primarySkill;
  if (structuredSkill) return structuredSkill;

  const objective = normalizePedagogicalText(pkg.input.objective);
  if (/passe|recep|manchete/.test(objective)) return "passe";
  if (/levant/.test(objective)) return "levantamento";
  if (/ataq|cortada/.test(objective)) return "ataque";
  if (/bloq/.test(objective)) return "bloqueio";
  if (/defes|dig/.test(objective)) return "defesa";
  if (/saque|serv/.test(objective)) return "saque";
  if (/trans|jogo/.test(objective)) return "transicao";
  return "passe";
};

const inferProgressionDimension = (
  pkg: PedagogicalPlanPackage
): ProgressionDimension => {
  if (pkg.generated.basePlanKind === "progression") return "transferencia_jogo";
  if (pkg.analysis.heterogeneity === "alta") return "consistencia";
  if (pkg.analysis.level === "baixo") return "precisao";
  if (normalizePedagogicalText(pkg.input.objective).includes("jogo")) {
    return "tomada_decisao";
  }
  if (pkg.analysis.level === "alto") return "oposicao";
  return "pressao_tempo";
};

const inferObjectiveType = (
  pkg: PedagogicalPlanPackage
): TrainingPlanObjectiveType => {
  const objective = normalizePedagogicalText(pkg.input.objective);
  if (/resist|condicion/.test(objective)) return "fisico";
  if (/jogo|tomada|decis/.test(objective)) return "tatico";
  if (/controle|coord|motor/.test(objective)) return "motor";
  if (/concent|percepc/.test(objective)) return "cognitivo";
  return "tecnico";
};

export const pickPedagogicalObjectiveLabel = (
  value: string,
  structuredSkill?: VolleyballSkill
) => {
  if (structuredSkill) return volleyballSkillLabels[structuredSkill];
  const normalized = normalizePedagogicalText(value);
  if (!normalized) return pedagogicalObjectiveLabels.controle_bola;
  if (normalized.includes("passe") || normalized.includes("recep")) {
    return pedagogicalObjectiveLabels.passe;
  }
  if (normalized.includes("resist") || normalized.includes("condicion")) {
    return pedagogicalObjectiveLabels.resistencia;
  }
  if (normalized.includes("jogo") || normalized.includes("reduz")) {
    return pedagogicalObjectiveLabels.jogo_reduzido;
  }
  return pedagogicalObjectiveLabels.controle_bola;
};

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

export const buildPedagogicalInputHash = (pkg: PedagogicalPlanPackage) => {
  const students = (pkg.input.students ?? []).map((student) => student.id);
  const payload = {
    classId: pkg.input.classGroup.id,
    students: [...students].sort(),
    objective: pkg.input.objective,
    duration: pkg.input.duration,
    materials: [...(pkg.input.materials ?? [])].map((item) => String(item ?? "").trim()),
    constraints: [...(pkg.input.constraints ?? [])].map((item) => String(item ?? "").trim()),
    context: pkg.input.context ?? "",
    periodization: {
      phase: pkg.input.periodizationPhase ?? null,
      week: pkg.input.weekNumber ?? null,
      rpeTarget: pkg.input.rpeTarget ?? null,
    },
    sessionPlanningContext: pkg.input.sessionPlanningContext ?? null,
    analysis: {
      level: pkg.analysis.level,
      heterogeneity: pkg.analysis.heterogeneity,
    },
    final: {
      warmup: pkg.final.warmup.activities.map((activity) => activity.name),
      main: pkg.final.main.activities.map((activity) => activity.name),
      cooldown: pkg.final.cooldown.activities.map((activity) => activity.name),
      warmupDuration: pkg.final.warmup.duration,
      mainDuration: pkg.final.main.duration,
      cooldownDuration: pkg.final.cooldown.duration,
    },
  };
  return stableSerialize(payload);
};

const toTrainingPlanActivity = (
  activity: PedagogicalPlanPackage["final"]["main"]["activities"][number]
): TrainingPlanActivity => ({
  name: activity.name,
  description: activity.description,
  stage: activity.stage,
  participants: activity.participants,
  organization: activity.organization,
  starter: activity.starter,
  action: activity.action,
  rotation: activity.rotation,
  simpleRule: activity.simpleRule,
  scoring: activity.scoring,
  materials: activity.materials,
  space: activity.space,
  execution: activity.execution,
  coachFocus: activity.coachFocus,
  successCriteria: activity.successCriteria,
  adaptation: activity.adaptation,
  primarySkill: activity.primarySkill,
  sourcePatternId: activity.sourcePatternId,
  validation: activity.validation,
  presentation: activity.presentation,
});

export const buildGeneratedPlanPedagogy = (
  pkg: PedagogicalPlanPackage,
  pedagogy?: TrainingPlanPedagogy
): TrainingPlanPedagogy => {
  const documentGuidelines = buildDocumentPedagogicalGuidelines(pkg);
  const learningObjectives = pedagogy?.learningObjectives
    ? {
        ...pedagogy.learningObjectives,
        pedagogicalGuidelines: uniqueStrings([
          ...(pedagogy.learningObjectives.pedagogicalGuidelines ?? []),
          ...documentGuidelines,
        ]),
      }
    : documentGuidelines.length
      ? {
          general: pkg.input.objective,
          specific: [],
          pedagogicalGuidelines: documentGuidelines,
        }
      : undefined;
  const generatedBlocks: NonNullable<TrainingPlanPedagogy["blocks"]> = {
    warmup: {
      summary: pkg.final.warmup.summary,
      activities: pkg.final.warmup.activities.map(toTrainingPlanActivity),
    },
    main: {
      summary: pkg.final.main.summary,
      activities: pkg.final.main.activities.map(toTrainingPlanActivity),
    },
    cooldown: {
      summary: pkg.final.cooldown.summary,
      activities: pkg.final.cooldown.activities.map(toTrainingPlanActivity),
    },
  };

  return {
    ...pedagogy,
    appliedReferences:
      pedagogy?.appliedReferences ??
      getAppliedDocumentReferences(pkg),
    learningObjectives,
    sessionPlanningContext:
      pedagogy?.sessionPlanningContext ?? pkg.input.sessionPlanningContext,
    sessionObjective: pedagogy?.sessionObjective ?? pkg.input.objective,
    sessionObjectiveSource: pedagogy?.sessionObjectiveSource ?? "generated",
    objective: pedagogy?.objective ?? {
      type: inferObjectiveType(pkg),
      description: pkg.input.objective,
    },
    focus: pedagogy?.focus ?? { skill: inferFocusSkill(pkg) },
    progression: pedagogy?.progression ?? {
      dimension: inferProgressionDimension(pkg),
    },
    blocks: pedagogy?.blocks ?? generatedBlocks,
  };
};

export const convertPedagogicalPackageToTrainingPlan = ({
  pkg,
  classId,
  sessionDate,
  existingPlan,
  version,
  pedagogy,
}: {
  pkg: PedagogicalPlanPackage;
  classId: string;
  sessionDate: string;
  existingPlan: TrainingPlan | null;
  version: number;
  pedagogy?: TrainingPlanPedagogy;
}): TrainingPlan => {
  const nowIso = new Date().toISOString();
  const titleSkill = pedagogy?.focus?.skill ?? inferFocusSkill(pkg);
  const title = `${pkg.input.classGroup.name} · ${pickPedagogicalObjectiveLabel(
    pkg.input.objective,
    titleSkill
  )}`;
  const blockTimes = getLessonBlockTimes(pkg.input.duration ?? 60);
  return createTrainingPlanVersion({
    classId,
    version,
    origin: "auto",
    draft: {
      title,
      tags: [
        `modo:${pkg.generated.basePlanKind}`,
        `nivel:${pkg.analysis.level}`,
        `heterogeneidade:${pkg.analysis.heterogeneity}`,
        `contexto:${pkg.input.context ?? "treinamento"}`,
      ],
      warmup: pkg.final.warmup.activities.map((activity) => activity.name),
      main: pkg.final.main.activities.map((activity) => activity.name),
      cooldown: pkg.final.cooldown.activities.map((activity) => activity.name),
      warmupTime: `${blockTimes.warmupMinutes} min`,
      mainTime: `${blockTimes.mainMinutes} min`,
      cooldownTime: `${blockTimes.cooldownMinutes} min`,
    },
    applyDays: existingPlan?.applyDays ?? [],
    applyDate: existingPlan?.applyDate ?? sessionDate,
    inputHash: buildPedagogicalInputHash(pkg),
    nowIso,
    idPrefix: "plan_pedagogical",
    status: "final",
    generatedAt: nowIso,
    finalizedAt: nowIso,
    pedagogy: buildGeneratedPlanPedagogy(pkg, pedagogy),
  });
};

export const buildPedagogicalPlanDraft = (pkg: PedagogicalPlanPackage) => {
  const blockTimes = getLessonBlockTimes(pkg.input.duration ?? 60);
  return {
    title: `${pkg.input.classGroup.name} · ${pickPedagogicalObjectiveLabel(
      pkg.input.objective,
      inferFocusSkill(pkg)
    )}`,
    tags: [
      `modo:${pkg.generated.basePlanKind}`,
      `nivel:${pkg.analysis.level}`,
      `heterogeneidade:${pkg.analysis.heterogeneity}`,
      `contexto:${pkg.input.context ?? "treinamento"}`,
    ],
    warmup: pkg.final.warmup.activities.map((activity) => activity.name),
    main: pkg.final.main.activities.map((activity) => activity.name),
    cooldown: pkg.final.cooldown.activities.map((activity) => activity.name),
    warmupTime: `${blockTimes.warmupMinutes} min`,
    mainTime: `${blockTimes.mainMinutes} min`,
    cooldownTime: `${blockTimes.cooldownMinutes} min`,
  };
};
