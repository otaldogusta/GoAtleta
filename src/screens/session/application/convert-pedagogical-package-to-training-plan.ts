import type { TrainingPlan, TrainingPlanPedagogy } from "../../../core/models";
import type { PedagogicalPlanPackage } from "../../../core/pedagogical-planning";
import { createTrainingPlanVersion } from "../../../core/training-plan-factory";
import { getLessonBlockTimes } from "../../../utils/lesson-block-times";

const pedagogicalObjectiveLabels: Record<string, string> = {
  controle_bola: "Controle de bola",
  passe: "Passe",
  resistencia: "Resistência",
  jogo_reduzido: "Jogo reduzido",
};

const normalizePedagogicalText = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const pickPedagogicalObjectiveLabel = (value: string) => {
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
  const title = `${pkg.input.classGroup.name} · ${pickPedagogicalObjectiveLabel(pkg.input.objective)}`;
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
    pedagogy,
  });
};

export const buildPedagogicalPlanDraft = (pkg: PedagogicalPlanPackage) => {
  const blockTimes = getLessonBlockTimes(pkg.input.duration ?? 60);
  return {
    title: `${pkg.input.classGroup.name} · ${pickPedagogicalObjectiveLabel(pkg.input.objective)}`,
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
