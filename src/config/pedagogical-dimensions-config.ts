/**
 * Pedagogical Dimensions Configuration Schema
 *
 * TypeScript type definitions matching the pedagogical-dimensions.json config file.
 * Provides type safety, IDE autocomplete, and compile-time validation.
 */

import type { DimensionLevel } from "../core/pedagogical-dimensions-types";

// ============================================================================
// DIMENSION METADATA
// ============================================================================

export interface DimensionLevelDefinition {
  label: string;
  description: string;
  scientificBasis: string;
  confidenceLevel: "alta" | "media" | "baixa";
}

export interface DimensionsMetadata {
  variability: Record<DimensionLevel, DimensionLevelDefinition>;
  representativeness: Record<DimensionLevel, DimensionLevelDefinition>;
  decisionMaking: Record<DimensionLevel, DimensionLevelDefinition>;
  taskComplexity: Record<DimensionLevel, DimensionLevelDefinition>;
  feedbackFrequency: Record<DimensionLevel, DimensionLevelDefinition>;
}

// ============================================================================
// AGE PROFILES
// ============================================================================

export interface AgeProfileEntry {
  label: string;
  variability: DimensionLevel;
  representativeness: DimensionLevel;
  decisionMaking: DimensionLevel;
  taskComplexity: DimensionLevel;
  feedbackFrequency: DimensionLevel;
  rationale: string;
}

export interface AgeProfiles {
  comment?: string;
  "8-11": AgeProfileEntry;
  "10-12": AgeProfileEntry;
  "12-14": AgeProfileEntry;
  "14+": AgeProfileEntry;
}

// ============================================================================
// LEVEL ADJUSTMENTS
// ============================================================================

export interface LevelAdjustmentEntry {
  label: string;
  deltaVariability: number;
  deltaRepresentativeness: number;
  deltaDecisionMaking: number;
  deltaTaskComplexity: number;
  deltaFeedbackFrequency: number;
  rationale: string;
}

export interface LevelAdjustments {
  comment?: string;
  "1": LevelAdjustmentEntry;
  "2": LevelAdjustmentEntry;
  "3": LevelAdjustmentEntry;
}

// ============================================================================
// PHASE MODIFIERS
// ============================================================================

export interface PhaseModifierEntry {
  label: string;
  deltaVariability: number;
  deltaRepresentativeness: number;
  deltaDecisionMaking: number;
  deltaTaskComplexity: number;
  deltaFeedbackFrequency: number;
  rationale: string;
}

export interface PhaseModifiers {
  comment?: string;
  fundamentos: PhaseModifierEntry;
  consolidacao: PhaseModifierEntry;
  especializacao: PhaseModifierEntry;
  competicao: PhaseModifierEntry;
}

// ============================================================================
// REFINEMENT RULES
// ============================================================================

export interface RefinementRule {
  id: string;
  condition: string; // Human-readable condition expression
  description: string;
  adjustments: Record<string, string | number>; // e.g., { feedbackFrequency: "+1", variability: "-1" }
  priority: number; // Lower = higher priority
}

export interface SafetyGate {
  id: string;
  condition: string;
  action: "BLOCK all adjustments; return baseProfile unmodified" | string;
  description: string;
}

export interface RefinementRulesConfig {
  comment?: string;
  rules: RefinementRule[];
  safetyGates: SafetyGate[];
}

// ============================================================================
// CHANGELOG
// ============================================================================

export interface ChangeLogEntry {
  version: string;
  date: string; // ISO 8601 timestamp
  changes: string;
  motivation: string;
  reviewedBy: string;
}

// ============================================================================
// ROOT CONFIG SCHEMA
// ============================================================================

export interface PedagogicalDimensionsConfig {
  version: string; // semver-like: major.minor.date.patch
  lastUpdated: string; // ISO 8601 timestamp
  description: string;
  metadata: {
    author: string;
    sources: string[];
  };
  dimensions: DimensionsMetadata;
  ageProfiles: AgeProfiles;
  levelAdjustments: LevelAdjustments;
  phaseModifiers: PhaseModifiers;
  refinementRules: RefinementRulesConfig;
  changeLogs: ChangeLogEntry[];
}

// ============================================================================
// CONFIG LOADER & VALIDATOR
// ============================================================================

/**
 * Validates a parsed JSON object against the PedagogicalDimensionsConfig schema
 * Returns true if valid, false otherwise
 */
export function isValidPedagogicalConfig(obj: unknown): obj is PedagogicalDimensionsConfig {
  if (typeof obj !== "object" || obj === null) return false;

  const cfg = obj as Record<string, unknown>;

  // Check required top-level fields
  if (
    typeof cfg.version !== "string" ||
    typeof cfg.lastUpdated !== "string" ||
    typeof cfg.description !== "string"
  ) {
    return false;
  }

  // Check nested objects exist
  if (
    typeof cfg.dimensions !== "object" ||
    typeof cfg.ageProfiles !== "object" ||
    typeof cfg.levelAdjustments !== "object" ||
    typeof cfg.phaseModifiers !== "object" ||
    typeof cfg.refinementRules !== "object"
  ) {
    return false;
  }

  // Check ageProfiles entries
  const ageProfiles = cfg.ageProfiles as Record<string, unknown>;
  const requiredAges = ["8-11", "10-12", "12-14", "14+"];
  for (const age of requiredAges) {
    if (typeof ageProfiles[age] !== "object") return false;
  }

  // Check levelAdjustments entries
  const levelAdj = cfg.levelAdjustments as Record<string, unknown>;
  const requiredLevels = ["1", "2", "3"];
  for (const level of requiredLevels) {
    if (typeof levelAdj[level] !== "object") return false;
  }

  // Check phaseModifiers entries
  const phaseModifiers = cfg.phaseModifiers as Record<string, unknown>;
  const requiredPhases = ["fundamentos", "consolidacao", "especializacao", "competicao"];
  for (const phase of requiredPhases) {
    if (typeof phaseModifiers[phase] !== "object") return false;
  }

  // Check refinementRules
  const refinement = cfg.refinementRules as Record<string, unknown>;
  if (!Array.isArray(refinement.rules)) return false;
  if (!Array.isArray(refinement.safetyGates)) return false;

  return true;
}

/**
 * Load config from JSON file with error handling
 * Returns config if valid, throws error with detailed message if not
 */
export async function loadPedagogicalConfig(
  filePath: string
): Promise<PedagogicalDimensionsConfig> {
  try {
    const fs = await import("fs").then((m) => m.promises);
    const fileContent = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(fileContent);

    if (!isValidPedagogicalConfig(parsed)) {
      throw new Error("Config does not match PedagogicalDimensionsConfig schema");
    }

    return parsed;
  } catch (error) {
    throw new Error(`Failed to load pedagogical config from ${filePath}: ${String(error)}`);
  }
}
