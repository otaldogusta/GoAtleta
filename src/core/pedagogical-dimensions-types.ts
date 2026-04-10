/**
 * Pedagogical Dimensions System - Type Definitions & Scientific Foundation
 *
 * This module defines the 5 core pedagogical dimensions that guide training session design.
 * Each dimension is grounded in motor learning science (2020+) and can be adjusted based on
 * age, level, phase, and performance state.
 *
 * Sources:
 * - Schmidt & Lee (2020): Motor Control and Learning—A Behavioral Emphasis
 * - Ecological Dynamics Approach (Davids et al.)
 * - Constraint-Led Approach (Renshaw et al.)
 * - Periodization theory (Platonov, Verkhoshansky)
 */

// ============================================================================
// DIMENSION LEVELS
// ============================================================================

export type DimensionLevel = "baixa" | "media" | "alta";

/**
 * Variability: Range of practice conditions and task variations
 * - "baixa": Blocked practice (identical repetitions). Used for initial motor learning (motor planning phase).
 * - "media": Variable conditions (same task, different contexts). Used for consolidation of skill.
 * - "alta": Random/variable practice (diverse tasks). Used for transfer and generalization.
 *
 * Scientific basis: Schmidt & Lee (2020) - Low variability optimal for early acquisition,
 * high variability essential for retention and transfer (contextual interference theory).
 * Confidence: ALTA (strong consensus across motor learning research)
 */
export type VariabilityLevel = "baixa" | "media" | "alta";

/**
 * Representativeness: How closely practice tasks match real match conditions
 * - "baixa": Isolated/decontextualized drills (controlled environment). For technique refinement.
 * - "media": Semi-realistic scenarios (simplified match conditions). For transitional learning.
 * - "alta": Game-realistic conditions (constraints match match). For transfer and decision-making.
 *
 * Scientific basis: Ecological Dynamics Approach (Davids et al., 2008+) -
 * Representativeness relates to affordances; practicing in realistic constraints accelerates learning.
 * Confidence: ALTA (ecological dynamics consensus)
 */
export type RepresentativenessLevel = "baixa" | "media" | "alta";

/**
 * Decision-Making: Frequency and complexity of tactical/strategic decisions required
 * - "baixa": Low autonomy, coach-directed. For drill execution focus.
 * - "media": Moderate autonomy, guided choices. For transitional decision-making.
 * - "alta": High autonomy, game-realistic decision load. For competitive readiness.
 *
 * Scientific basis: Constraint-Led Approach (Renshaw et al., 2016+) -
 * Cognition emerges through exploration under constraints; removing decision load early harms transfer.
 * Confidence: ALTA (CLA + motor learning consensus)
 */
export type DecisionMakingLevel = "baixa" | "media" | "alta";

/**
 * Task Complexity: Cognitive and motor demands of individual tasks
 * - "baixa": Simple motor patterns, single focal point (foundational technique).
 * - "media": Moderate coordination, 2–3 elements combined (intermediate skill).
 * - "alta": Complex multi-element sequences, high coordination demand (advanced technique).
 *
 * Scientific basis: Fitts & Posner (1967+), Newell's constraints model (1986+) -
 * Task complexity should match learner capability; too simple = boredom/plateau,
 * too complex = cognitive overload (inverted-U relationship).
 * Confidence: ALTA (classic motor learning theory)
 */
export type TaskComplexityLevel = "baixa" | "media" | "alta";

/**
 * Feedback Frequency: Rate and timing of coach feedback provision
 * - "baixa": Low frequency, delayed feedback (summary feedback post-session).
 * Used for learners with moderate-to-good self-monitoring.
 * - "media": Moderate frequency, near-real-time feedback (post-drill summary).
 * For learners transitioning to autonomy.
 * - "alta": High frequency, immediate feedback (per-Rep or per-rally).
 * For early learners or critical gaps.
 *
 * Scientific basis: Schmidt & Lee (2020), Saltzman & Newell (1987) -
 * Information processing burden: more feedback reduces relative error early, but delays adaptation.
 * Learning curves flatten when learners depend on external feedback (guidance hypothesis).
 * Confidence: MEDIA (feedback timing optimal varies; no universal "best" threshold)
 */
export type FeedbackFrequencyLevel = "baixa" | "media" | "alta";

// ============================================================================
// DIMENSION PROFILE
// ============================================================================

export interface PedagogicalDimensionsProfile {
  variability: VariabilityLevel;
  representativeness: RepresentativenessLevel;
  decisionMaking: DecisionMakingLevel;
  taskComplexity: TaskComplexityLevel;
  feedbackFrequency: FeedbackFrequencyLevel;
}

/**
 * Reason for a dimension adjustment during refinement
 * Tracks why each dimension was tweaked based on evaluation results
 */
export interface RefinementReason {
  dimension: keyof PedagogicalDimensionsProfile;
  oldLevel: DimensionLevel;
  newLevel: DimensionLevel;
  reason: string; // e.g., "gap.level === 'critico' at 45% consistency"
  delta: number; // numeric representation of change for analytics
  timestamp: string; // ISO timestamp of refinement
}

/**
 * Extended profile with refinement history
 * Returned after evaluation-based refinements are applied
 */
export interface RefinedDimensionsProfile extends PedagogicalDimensionsProfile {
  adjustments?: RefinementReason[];
  refinedAt?: string; // ISO timestamp of last refinement
}

// ============================================================================
// EXAMPLE DIMENSION PROFILES
// ============================================================================

/**
 * Profile A: Young Beginners (8–11 age, iniciação level)
 * Focus: Foundational technique, basic decision-making, high feedback
 * Rationale: Low motor experience, need blocked practice + external guidance
 */
export const PROFILE_A_YOUNG_BEGINNER: PedagogicalDimensionsProfile = {
  variability: "baixa", // Blocked practice for motor planning
  representativeness: "baixa", // Simplified, decontextualized drills
  decisionMaking: "baixa", // Coach-directed, no tactical load
  taskComplexity: "baixa", // Single-element motor patterns
  feedbackFrequency: "alta", // High external feedback to reduce errors
};

/**
 * Profile B: Intermediate Students (10–12 age, formação level)
 * Focus: Skill consolidation, variable practice, moderate autonomy
 * Rationale: Moderate experience, ready for variable practice + guided decisions
 */
export const PROFILE_B_INTERMEDIATE: PedagogicalDimensionsProfile = {
  variability: "media", // Variable practice within task family
  representativeness: "media", // Semi-realistic scenarios
  decisionMaking: "media", // Guided choices within coach-set constraints
  taskComplexity: "media", // Moderate coordination (2–3 elements)
  feedbackFrequency: "media", // Post-drill summary feedback
};

/**
 * Profile C: Competitive Squad (14+ age, competitive level)
 * Focus: Transfer + game realism, high autonomy, tactical depth
 * Rationale: High experience, ready for contextual interference + match-realistic constraints
 */
export const PROFILE_C_COMPETITIVE: PedagogicalDimensionsProfile = {
  variability: "alta", // Random/variable practice, contextual interference
  representativeness: "alta", // Game-realistic constraints (defenders, scoring logic)
  decisionMaking: "alta", // High autonomy, full match decision load
  taskComplexity: "alta", // Complex multi-element sequences
  feedbackFrequency: "baixa", // Delayed, summary feedback (learners self-monitor)
};

// ============================================================================
// DERIVATION INPUTS & CONTEXT
// ============================================================================

export interface DimensionDerivationInput {
  studentAge: number; // 6–18 range
  classLevel: 1 | 2 | 3; // 1 = iniciação, 2 = formação, 3 = competitive
  periodizationPhase: "fundamentos" | "consolidacao" | "especializacao" | "competicao";
  performanceState?: {
    gap?: { level: "residual" | "pequeno" | "moderado" | "critico" | "otimo" | "adequado" };
    trend?: "subindo" | "estagnado" | "caindo";
    consistencyScore?: number; // 0–100
    sampleConfidence?: "baixo" | "medio" | "alto";
  };
}

export interface DimensionDerivationResult {
  baseProfile: PedagogicalDimensionsProfile;
  refinedProfile?: RefinedDimensionsProfile;
  age: number;
  level: number;
  phase: string;
  derivedAt: string; // ISO timestamp
  confidenceLevel: "alta" | "media" | "baixa"; // Overall confidence in derivation
  notes?: string; // Explanation for coaches/coordinators
}

// ============================================================================
// VALIDATION & HELPERS
// ============================================================================

export function isValidDimensionLevel(value: unknown): value is DimensionLevel {
  return value === "baixa" || value === "media" || value === "alta";
}

export function isValidProfile(obj: unknown): obj is PedagogicalDimensionsProfile {
  if (typeof obj !== "object" || obj === null) return false;
  const p = obj as Record<string, unknown>;
  return (
    isValidDimensionLevel(p.variability) &&
    isValidDimensionLevel(p.representativeness) &&
    isValidDimensionLevel(p.decisionMaking) &&
    isValidDimensionLevel(p.taskComplexity) &&
    isValidDimensionLevel(p.feedbackFrequency)
  );
}
