import type { TrainingPlanDevelopmentStage } from "./models";
import type {
    LessonPlanDraft,
    LessonPlanFinal,
    LessonPlanGenerated,
    PedagogicalActivity,
    PedagogicalPlanBlock,
    PedagogicalPlanPackage,
} from "./pedagogical-planning";

export type AgeSanitizerDiagnostics = {
  ageBand: string;
  developmentStage: TrainingPlanDevelopmentStage;
  warmupSummary: string;
  warmupSource: "engine" | "age_sanitizer";
  usedAgeSanitizer: boolean;
  ageSanitizerReasons: AgeSanitizerReason[];
};

export type AgeSanitizerReason = "clinical_warmup_language";

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const parseAgeBandStart = (value: string) => {
  const match = String(value ?? "").match(/(\d{1,2})/);
  return match ? Number(match[1]) : null;
};

const resolveDevelopmentStage = (
  ageBand: string,
  explicitDevelopmentStage?: TrainingPlanDevelopmentStage
): TrainingPlanDevelopmentStage => {
  if (explicitDevelopmentStage) return explicitDevelopmentStage;
  const ageStart = parseAgeBandStart(ageBand);
  if (ageStart !== null && ageStart <= 11) return "fundamental";
  if (ageStart !== null && ageStart <= 16) return "especializado";
  return "aplicado";
};

const isAdultClinicalWarmupLanguage = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return [
    /sem dor reportada/,
    /dor reportada/,
    /pre-?hab/,
    /rehab/,
    /manguito/,
    /escap/,
    /rotador/,
    /ativ.*ombro/,
    /ativ.*core/,
    /ombro.*core/,
    /estabiliz/,
    /core/,
  ].some((pattern) => pattern.test(normalized));
};

const sanitizeWarmupTextForFundamental = (value: string, index = 0) => {
  if (!isAdultClinicalWarmupLanguage(value)) return value;

  const replacements = [
    {
      name: "Brincadeira de movimento e coordenação com bola",
      description: "Brincadeira com deslocamentos curtos, reação, equilíbrio e controle corporal com bola.",
    },
    {
      name: "Circuito lúdico de deslocamentos e passes",
      description: "Circuito lúdico com mudanças de direção, coordenação e trocas simples de bola em dupla.",
    },
    {
      name: "Desafio de reação, equilíbrio e controle corporal",
      description: "Desafio rápido com gestos amplos, reação a comandos e controle corporal em movimento.",
    },
  ];

  return replacements[index % replacements.length];
};

const sanitizeWarmupBlock = (block: PedagogicalPlanBlock) => {
  let changed = false;
  let detectedClinicalLanguage = false;
  const sanitizedActivities = block.activities.map((activity, index) => {
    const hasClinicalLanguage = isAdultClinicalWarmupLanguage(activity.description || activity.name);
    if (hasClinicalLanguage) detectedClinicalLanguage = true;
    const sanitized = sanitizeWarmupTextForFundamental(activity.description || activity.name, index);
    if (typeof sanitized === "string") return activity;
    changed = true;
    return {
      ...activity,
      name: sanitized.name,
      description: sanitized.description,
    } satisfies PedagogicalActivity;
  });

  const originalSummary = String(block.summary || "").trim();
  if (isAdultClinicalWarmupLanguage(originalSummary)) {
    detectedClinicalLanguage = true;
  }
  const firstSanitizedActivity = sanitizedActivities[0];
  const sanitizedSummary = isAdultClinicalWarmupLanguage(originalSummary)
    ? firstSanitizedActivity?.description || firstSanitizedActivity?.name || originalSummary
    : originalSummary;

  if (sanitizedSummary !== originalSummary) {
    changed = true;
  }

  return {
    changed,
    detectedClinicalLanguage,
    block: changed
      ? {
          ...block,
          summary: sanitizedSummary || block.summary,
          activities: sanitizedActivities,
        }
      : block,
  };
};

const sanitizeDraftLike = <T extends LessonPlanDraft | LessonPlanGenerated | LessonPlanFinal>(draft: T) => {
  const warmupResult = sanitizeWarmupBlock(draft.warmup);
  if (!warmupResult.changed) {
    return { changed: false, value: draft };
  }

  return {
    changed: true,
    value: {
      ...draft,
      warmup: warmupResult.block,
    },
  };
};

export const sanitizePlanForAgeBand = (
  plan: PedagogicalPlanPackage,
  ageBand: string,
  explicitDevelopmentStage?: TrainingPlanDevelopmentStage
): { package: PedagogicalPlanPackage; diagnostics: AgeSanitizerDiagnostics } => {
  const developmentStage = resolveDevelopmentStage(ageBand, explicitDevelopmentStage);
  const baselineWarmupSummary =
    String(plan.final.warmup.summary || "").trim() ||
    String(plan.final.warmup.activities[0]?.description || plan.final.warmup.activities[0]?.name || "").trim();

  if (developmentStage !== "fundamental") {
    return {
      package: plan,
      diagnostics: {
        ageBand,
        developmentStage,
        warmupSummary: baselineWarmupSummary,
        warmupSource: "engine",
        usedAgeSanitizer: false,
        ageSanitizerReasons: [],
      },
    };
  }

  const draftResult = sanitizeDraftLike(plan.draft);
  const generatedResult = sanitizeDraftLike(plan.generated);
  const finalResult = sanitizeDraftLike(plan.final);
  const warmupAudit = sanitizeWarmupBlock(plan.final.warmup);
  const changed = draftResult.changed || generatedResult.changed || finalResult.changed;
  const ageSanitizerReasons: AgeSanitizerReason[] =
    changed && warmupAudit.detectedClinicalLanguage ? ["clinical_warmup_language"] : [];
  const sanitizedWarmupSummary =
    String(finalResult.value.warmup.summary || "").trim() ||
    String(
      finalResult.value.warmup.activities[0]?.description ||
        finalResult.value.warmup.activities[0]?.name ||
        ""
    ).trim();

  return {
    package: changed
      ? {
          ...plan,
          draft: draftResult.value,
          generated: generatedResult.value,
          final: finalResult.value,
        }
      : plan,
    diagnostics: {
      ageBand,
      developmentStage,
      warmupSummary: sanitizedWarmupSummary || baselineWarmupSummary,
      warmupSource: changed ? "age_sanitizer" : "engine",
      usedAgeSanitizer: changed,
      ageSanitizerReasons,
    },
  };
};
