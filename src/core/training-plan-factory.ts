import type { TrainingPlan } from "./models";

const knownMethodologyApproaches = new Set(["analitico", "global", "jogo", "hibrido"]);

type TrainingPlanDraft = {
  title: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmupTime: string;
  mainTime: string;
  cooldownTime: string;
};

type CreateTrainingPlanVersionParams = {
  classId: string;
  version: number;
  origin: NonNullable<TrainingPlan["origin"]>;
  draft: TrainingPlanDraft;
  applyDays?: number[];
  applyDate?: string;
  inputHash?: string;
  nowIso?: string;
  idPrefix?: string;
  status?: NonNullable<TrainingPlan["status"]>;
  generatedAt?: string;
  finalizedAt?: string;
  parentPlanId?: string;
  previousVersionId?: string;
  pedagogy?: TrainingPlan["pedagogy"];
};

export const createTrainingPlanVersion = (
  params: CreateTrainingPlanVersionParams
): TrainingPlan => {
  if (!params.draft.main.length) {
    throw new Error("TrainingPlan requires at least one main activity");
  }

  if (__DEV__ && !params.pedagogy?.focus?.skill) {
    console.warn("[TrainingPlan] created without pedagogy.focus.skill — pedagogical context missing");
  }

  const methodology = params.pedagogy?.methodology;
  const normalizedApproach = String(methodology?.approach ?? "").trim().toLowerCase();
  if (__DEV__ && normalizedApproach && !knownMethodologyApproaches.has(normalizedApproach) && !methodology?.kbRuleKey) {
    console.warn(
      "[TrainingPlan] custom pedagogy.methodology.approach should include kbRuleKey for traceability"
    );
  }

  const nowIso = params.nowIso ?? new Date().toISOString();
  const status = params.status ?? "final";
  const uid = crypto.randomUUID();

  return {
    id: `${params.idPrefix ?? "plan"}_${uid}`,
    classId: params.classId,
    title: params.draft.title,
    tags: params.draft.tags,
    warmup: params.draft.warmup,
    main: params.draft.main,
    cooldown: params.draft.cooldown,
    warmupTime: params.draft.warmupTime,
    mainTime: params.draft.mainTime,
    cooldownTime: params.draft.cooldownTime,
    applyDays: params.applyDays ?? [],
    applyDate: params.applyDate ?? "",
    createdAt: nowIso,
    version: params.version,
    status,
    origin: params.origin,
    inputHash: params.inputHash,
    generatedAt: params.generatedAt ?? (status === "generated" ? nowIso : undefined),
    finalizedAt: params.finalizedAt ?? (status === "final" ? nowIso : undefined),
    parentPlanId: params.parentPlanId,
    previousVersionId: params.previousVersionId,
    pedagogy: params.pedagogy,
  };
};
