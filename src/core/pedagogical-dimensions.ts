/**
 * Pedagogical Dimensions System - Core Logic
 *
 * Provides functions to:
 * 1. Derive base dimension profiles from age, class level, and periodization phase
 * 2. Refine profiles based on performance evaluation results
 * 3. Track refinement reasons for coaching feedback and analytics
 */

import type {
    LevelAdjustmentEntry,
    PedagogicalDimensionsConfig,
    PhaseModifierEntry,
} from "../config/pedagogical-dimensions-config";
import type {
    DimensionDerivationInput,
    DimensionDerivationResult,
    DimensionLevel,
    PedagogicalDimensionsProfile,
    RefinedDimensionsProfile,
    RefinementReason
} from "./pedagogical-dimensions-types";
import type { SessionOutcomeEvaluation } from "./pedagogical-evaluation";

// ============================================================================
// LEVEL CONVERSION (numeric 0-1 to discrete levels)
// ============================================================================

/**
 * Convert numeric delta (0-1 scale) to discrete level adjustment
 * Used to apply delta adjustments from config to base levels
 */
function applyDeltasToLevel(baseLevel: DimensionLevel, delta: number): DimensionLevel {
  const levelMap: Record<DimensionLevel, number> = {
    baixa: 0,
    media: 1,
    alta: 2,
  };

  const reverseLevelMap: Record<number, DimensionLevel> = {
    0: "baixa",
    1: "media",
    2: "alta",
  };

  const baseValue = levelMap[baseLevel];
  // Convert fractional deltas into discrete steps to avoid float-index bugs.
  // 0.15+ moves one level, -0.15- drops one level, otherwise keeps current level.
  const step = delta >= 0.15 ? 1 : delta <= -0.15 ? -1 : 0;
  let newValue = baseValue + step;

  // Clamp to valid range
  newValue = Math.max(0, Math.min(2, newValue));

  return reverseLevelMap[newValue] as DimensionLevel;
}

/**
 * Convert string delta ("+1", "-1") to numeric
 */
function parseDeltaString(deltaStr: string | number): number {
  if (typeof deltaStr === "number") return deltaStr;
  if (typeof deltaStr === "string") {
    const parsed = parseFloat(deltaStr);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// ============================================================================
// PROFILE DERIVATION
// ============================================================================

/**
 * Derive base dimension profile from age, class level, and periodization phase
 *
 * Two-stage composition:
 * 1. Get age profile from config
 * 2. Apply level adjustments (delta)
 * 3. Apply phase modifiers (delta)
 *
 * @param input - Student age, class level, periodization phase, optional performance state
 * @param config - Pedagogical dimensions configuration
 * @returns Base profile ready for refinement
 */
export function deriveDimensionsProfile(
  input: DimensionDerivationInput,
  config: PedagogicalDimensionsConfig
): DimensionDerivationResult {
  const {
    studentAge,
    classLevel,
    periodizationPhase,
    performanceState,
  } = input;

  // Validate inputs
  if (studentAge < 6 || studentAge > 18) {
    console.warn(`Student age ${studentAge} outside expected range (6-18); using 14+ profile`);
  }
  if (classLevel < 1 || classLevel > 3) {
    console.warn(`Class level ${classLevel} invalid; using level 1`);
  }

  // Step 1: Determine age profile bucket
  let ageProfileKey: keyof typeof config.ageProfiles;
  if (studentAge < 10) {
    ageProfileKey = "8-11";
  } else if (studentAge < 12) {
    ageProfileKey = "10-12";
  } else if (studentAge < 14) {
    ageProfileKey = "12-14";
  } else {
    ageProfileKey = "14+";
  }

  const ageProfile = config.ageProfiles[ageProfileKey];
  const normalizedLevel = classLevel < 1 || classLevel > 3 ? 1 : classLevel;
  const levelAdjustment = config.levelAdjustments[
    String(normalizedLevel) as "1" | "2" | "3"
  ] as LevelAdjustmentEntry;
  const phaseModifier = config.phaseModifiers[
    periodizationPhase as keyof typeof config.phaseModifiers
  ] as PhaseModifierEntry;

  if (!ageProfile || !levelAdjustment || !phaseModifier) {
    throw new Error(
      `Missing config entries for age=${ageProfileKey}, level=${classLevel}, phase=${periodizationPhase}`
    );
  }

  // Step 2: Compose base profile
  // Start with age profile, then apply level + phase deltas
  const baseProfile: PedagogicalDimensionsProfile = {
    variability: applyDeltasToLevel(
      ageProfile.variability,
      levelAdjustment.deltaVariability + phaseModifier.deltaVariability
    ),
    representativeness: applyDeltasToLevel(
      ageProfile.representativeness,
      levelAdjustment.deltaRepresentativeness + phaseModifier.deltaRepresentativeness
    ),
    decisionMaking: applyDeltasToLevel(
      ageProfile.decisionMaking,
      levelAdjustment.deltaDecisionMaking + phaseModifier.deltaDecisionMaking
    ),
    taskComplexity: applyDeltasToLevel(
      ageProfile.taskComplexity,
      levelAdjustment.deltaTaskComplexity + phaseModifier.deltaTaskComplexity
    ),
    feedbackFrequency: applyDeltasToLevel(
      ageProfile.feedbackFrequency,
      levelAdjustment.deltaFeedbackFrequency + phaseModifier.deltaFeedbackFrequency
    ),
  };

  // Determine confidence level based on sample confidence from performance state
  let confidenceLevel: "alta" | "media" | "baixa" = "alta";
  if (performanceState?.sampleConfidence) {
    confidenceLevel =
      performanceState.sampleConfidence === "alto"
        ? "alta"
        : performanceState.sampleConfidence === "medio"
        ? "media"
        : "baixa";
  }

  return {
    baseProfile,
    age: studentAge,
    level: normalizedLevel,
    phase: periodizationPhase,
    derivedAt: new Date().toISOString(),
    confidenceLevel,
    notes: `Derived from ${ageProfileKey} age profile + level ${classLevel} + ${periodizationPhase} phase`,
  };
}

// ============================================================================
// PROFILE REFINEMENT
// ============================================================================

/**
 * Refine base profile based on pedagogical evaluation results
 *
 * Applies refinement rules from config if sampleConfidence >= "medio".
 * If sampleConfidence = "baixo", returns base profile unmodified (SAFETY GATE).
 *
 * Refinement rules check gap level, trend, and consistency to adjust dimensions.
 *
 * @param baseProfile - Base profile from derivation
 * @param evaluation - Pedagogical evaluation output with gap, trend, consistency
 * @param config - Pedagogical dimensions configuration
 * @returns Refined profile with adjustment history
 */
export function refineDimensionsByEvaluation(
  baseProfile: PedagogicalDimensionsProfile,
  evaluation: SessionOutcomeEvaluation | null,
  config: PedagogicalDimensionsConfig
): RefinedDimensionsProfile {
  // SAFETY GATE: Low sample confidence → block adjustments
  if (!evaluation || evaluation.sampleConfidence === "baixo") {
    return {
      ...baseProfile,
      adjustments: [],
      refinedAt: new Date().toISOString(),
    };
  }

  const adjustments: RefinementReason[] = [];
  const refinedProfile: PedagogicalDimensionsProfile = { ...baseProfile };
  const appliedDimensions = new Set<keyof PedagogicalDimensionsProfile>();

  // Extract evaluation metrics
  const gapLevel = evaluation.gap?.level || "moderado";
  const trend = evaluation.skillLearningState?.trend || "estagnado";
  const consistencyScore = evaluation.consistencyScore || 0;

  // Apply refinement rules in priority order
  const rules = [...config.refinementRules.rules].sort((a, b) => a.priority - b.priority);

  for (const rule of rules) {
    // Evaluate condition (simplified condition matching)
    let conditionMet = false;

    if (rule.id === "critical-gap-low-consistency") {
      conditionMet = gapLevel === "critico" && consistencyScore < 50;
    } else if (rule.id === "trend-improving-high-consistency") {
      conditionMet = trend === "subindo" && consistencyScore > 80;
    } else if (rule.id === "critical-gap-high-consistency") {
      conditionMet = gapLevel === "critico" && consistencyScore > 75;
    } else if (rule.id === "trend-declining-low-consistency") {
      conditionMet = trend === "caindo" && consistencyScore < 40;
    } else if (rule.id === "plateau-medium-consistency") {
      conditionMet = trend === "estagnado" && consistencyScore > 60 && consistencyScore < 75;
    }

    if (conditionMet) {
      // Apply adjustments from rule
      for (const [dimension, deltaStr] of Object.entries(rule.adjustments)) {
        const delta = parseDeltaString(deltaStr);
        const dimensionKey = dimension as keyof PedagogicalDimensionsProfile;
        if (appliedDimensions.has(dimensionKey)) {
          continue;
        }
        const oldLevel = refinedProfile[dimensionKey];
        const newLevel = applyDeltasToLevel(oldLevel, delta);

        if (oldLevel !== newLevel) {
          refinedProfile[dimensionKey] = newLevel;
          appliedDimensions.add(dimensionKey);
          adjustments.push({
            dimension: dimensionKey,
            oldLevel,
            newLevel,
            reason: rule.description,
            delta,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  return {
    ...refinedProfile,
    adjustments: adjustments.length > 0 ? adjustments : undefined,
    refinedAt: new Date().toISOString(),
  };
}

// ============================================================================
// FULL PIPELINE (DERIVE + REFINE)
// ============================================================================

/**
 * Complete pipeline: derive base profile, then refine based on evaluation
 *
 * @param input - Student age, class level, periodization phase
 * @param evaluation - Pedagogical evaluation output (optional)
 * @param config - Pedagogical dimensions configuration
 * @returns Full derivation result with refined profile if evaluation provided
 */
export function deriveDimensionsWithRefinement(
  input: DimensionDerivationInput,
  evaluation: SessionOutcomeEvaluation | null,
  config: PedagogicalDimensionsConfig
): DimensionDerivationResult {
  const result = deriveDimensionsProfile(input, config);

  if (evaluation) {
    result.refinedProfile = refineDimensionsByEvaluation(
      result.baseProfile,
      evaluation,
      config
    );
  }

  return result;
}

/**
 * Build practical coaching guidelines from a dimensions profile.
 * This is a low-risk guidance layer: no UI changes, no hard decision override.
 */
export function buildDimensionGuidelines(
  profile: PedagogicalDimensionsProfile
): string[] {
  const variabilityGuideline =
    profile.variability === "baixa"
      ? "Utilizar pratica repetida com baixa variacao de estimulos."
      : profile.variability === "media"
      ? "Aplicar variacao moderada de estimulos mantendo o mesmo objetivo tecnico."
      : "Aplicar pratica aleatoria com alta variacao para favorecer transferencia.";

  const representativenessGuideline =
    profile.representativeness === "baixa"
      ? "Priorizar tarefas isoladas para refinamento tecnico em ambiente controlado."
      : profile.representativeness === "media"
      ? "Usar cenarios semirrealistas com algumas restricoes de jogo."
      : "Usar tarefas representativas com condicoes proximas do jogo real.";

  const decisionMakingGuideline =
    profile.decisionMaking === "baixa"
      ? "Propor escolhas simples durante a tarefa, com apoio e perguntas orientadoras do(a) treinador(a)."
      : profile.decisionMaking === "media"
      ? "Permitir escolhas guiadas dentro de restricoes definidas pelo(a) treinador(a)."
      : "Permitir autonomia alta de decisao durante os exercicios.";

  const taskComplexityGuideline =
    profile.taskComplexity === "baixa"
      ? "Manter tarefas simples com foco em um elemento tecnico por vez."
      : profile.taskComplexity === "media"
      ? "Combinar dois a tres elementos tecnicos na mesma tarefa."
      : "Aplicar tarefas complexas com sequencias multielementares e leitura de jogo.";

  const feedbackFrequencyGuideline =
    profile.feedbackFrequency === "alta"
      ? "Fornecer feedback frequente e imediato apos as tentativas."
      : profile.feedbackFrequency === "media"
      ? "Fornecer feedback em blocos curtos ao final de cada serie."
      : "Fornecer feedback mais espaçado para estimular autoavaliacao.";

  return [
    variabilityGuideline,
    representativenessGuideline,
    decisionMakingGuideline,
    taskComplexityGuideline,
    feedbackFrequencyGuideline,
  ];
}

export type CAPObjectives = {
  conceitual: string[];
  procedimental: string[];
  atitudinal: string[];
};

/**
 * Builds CAP (Conceitual, Procedimental, Atitudinal) objectives from dimensions.
 * The language intentionally favors active learning and contextual adaptation.
 */
export function buildCAPFromDimensions(
  profile: PedagogicalDimensionsProfile
): CAPObjectives {
  const conceitual = [
    profile.decisionMaking === "baixa"
      ? "Reconhecer sinais basicos do jogo para escolher entre opcoes simples de acao."
      : "Analisar situacoes de jogo e selecionar a acao mais adequada ao contexto.",
    profile.representativeness === "baixa"
      ? "Compreender relacoes entre tarefa tecnica e situacoes futuras de jogo."
      : "Interpretar espaco, tempo e posicionamento em condicoes proximas do jogo.",
  ];

  const procedimental = [
    profile.representativeness === "baixa"
      ? "Executar habilidades tecnicas em tarefas guiadas, ajustando o movimento durante a acao."
      : "Executar habilidades em situacoes de jogo, adaptando tecnica conforme oposicao e contexto.",
    profile.taskComplexity === "baixa"
      ? "Refinar um elemento tecnico por vez com variacoes progressivas de contexto."
      : "Combinar multiplos elementos tecnicos mantendo qualidade e adaptacao ao problema de jogo.",
  ];

  const atitudinal = [
    profile.decisionMaking === "alta"
      ? "Assumir decisoes com autonomia e responsabilidade durante a atividade."
      : "Participar ativamente das decisoes propostas, justificando escolhas e aprendizados.",
    "Cooperar com colegas, comunicar intencoes e sustentar protagonismo durante as tarefas.",
  ];

  return { conceitual, procedimental, atitudinal };
}

// ============================================================================
// FORMATTING & REPORTING
// ============================================================================

/**
 * Format dimensions profile as human-readable string for logging/debugging
 */
export function formatDimensionsProfile(
  profile: PedagogicalDimensionsProfile,
  label?: string
): string {
  const prefix = label ? `${label}: ` : "";
  return (
    prefix +
    `[Variabilidade: ${profile.variability}, ` +
    `Representatividade: ${profile.representativeness}, ` +
    `Tomada de Decisão: ${profile.decisionMaking}, ` +
    `Complexidade: ${profile.taskComplexity}, ` +
    `Feedback: ${profile.feedbackFrequency}]`
  );
}

/**
 * Format refinement adjustments as human-readable list
 */
export function formatRefinements(adjustments: RefinementReason[] | undefined): string {
  if (!adjustments || adjustments.length === 0) {
    return "No adjustments";
  }

  return adjustments
    .map((adj) => `${adj.dimension}: ${adj.oldLevel} → ${adj.newLevel} (${adj.reason})`)
    .join("; ");
}
