/**
 * Pedagogical Dimensions Config Loader
 *
 * Loads and validates the pedagogical-dimensions.json configuration file
 * during app bootstrap. Provides fallback defaults if loading fails.
 */

import * as Sentry from "@sentry/react-native";
import type { PedagogicalDimensionsConfig } from "../config/pedagogical-dimensions-config";
import { isValidPedagogicalConfig } from "../config/pedagogical-dimensions-config";
import {
    PROFILE_A_YOUNG_BEGINNER,
    PROFILE_B_INTERMEDIATE,
    PROFILE_C_COMPETITIVE,
} from "../core/pedagogical-dimensions-types";

// ============================================================================
// DEFAULT FALLBACK CONFIG
// ============================================================================

/**
 * Minimal fallback configuration if file loading fails
 * Contains only essential defaults for the system to function
 */
function createFallbackConfig(): PedagogicalDimensionsConfig {
  return {
    version: "fallback.2026.04.07",
    lastUpdated: new Date().toISOString(),
    description: "Fallback pedagogical dimensions config (file failed to load)",
    metadata: {
      author: "GoAtleta (Fallback)",
      sources: [],
    },
    dimensions: {
      variability: {
        baixa: {
          label: "Blocked",
          description: "Identical repetitions",
          scientificBasis: "Schmidt & Lee (2020)",
          confidenceLevel: "alta",
        },
        media: {
          label: "Variable",
          description: "Same task, different contexts",
          scientificBasis: "Schmidt & Lee (2020)",
          confidenceLevel: "alta",
        },
        alta: {
          label: "Random",
          description: "Diverse tasks",
          scientificBasis: "Schmidt & Lee (2020)",
          confidenceLevel: "alta",
        },
      },
      representativeness: {
        baixa: {
          label: "Isolated",
          description: "Decontextualized",
          scientificBasis: "Ecological Dynamics",
          confidenceLevel: "alta",
        },
        media: {
          label: "Semi-Realistic",
          description: "Simplified conditions",
          scientificBasis: "Ecological Dynamics",
          confidenceLevel: "alta",
        },
        alta: {
          label: "Realistic",
          description: "Match conditions",
          scientificBasis: "Ecological Dynamics",
          confidenceLevel: "alta",
        },
      },
      decisionMaking: {
        baixa: {
          label: "Coach-Directed",
          description: "Low autonomy",
          scientificBasis: "Constraint-Led Approach",
          confidenceLevel: "alta",
        },
        media: {
          label: "Guided",
          description: "Moderate autonomy",
          scientificBasis: "Constraint-Led Approach",
          confidenceLevel: "alta",
        },
        alta: {
          label: "High Autonomy",
          description: "Game-realistic",
          scientificBasis: "Constraint-Led Approach",
          confidenceLevel: "alta",
        },
      },
      taskComplexity: {
        baixa: {
          label: "Simple",
          description: "Single element",
          scientificBasis: "Fitts & Posner (1967)",
          confidenceLevel: "alta",
        },
        media: {
          label: "Moderate",
          description: "2-3 elements",
          scientificBasis: "Newell (1986)",
          confidenceLevel: "alta",
        },
        alta: {
          label: "Complex",
          description: "Multi-element",
          scientificBasis: "Fitts & Posner (1967)",
          confidenceLevel: "alta",
        },
      },
      feedbackFrequency: {
        baixa: {
          label: "Low",
          description: "Delayed summary",
          scientificBasis: "Schmidt & Lee (2020)",
          confidenceLevel: "media",
        },
        media: {
          label: "Moderate",
          description: "Post-drill summary",
          scientificBasis: "Schmidt & Lee (2020)",
          confidenceLevel: "media",
        },
        alta: {
          label: "High",
          description: "Immediate feedback",
          scientificBasis: "Schmidt & Lee (2020)",
          confidenceLevel: "media",
        },
      },
    },
    ageProfiles: {
      "8-11": {
        label: "8-11 years (Iniciação)",
        ...PROFILE_A_YOUNG_BEGINNER,
        rationale: "Early motor development",
      },
      "10-12": {
        label: "10-12 years (Formação)",
        ...PROFILE_B_INTERMEDIATE,
        rationale: "Moderate experience",
      },
      "12-14": {
        label: "12-14 years (Consolidation)",
        variability: "media",
        representativeness: "media",
        decisionMaking: "media",
        taskComplexity: "media",
        feedbackFrequency: "media",
        rationale: "Approaching adolescence",
      },
      "14+": {
        label: "14+ years (Competitive)",
        ...PROFILE_C_COMPETITIVE,
        rationale: "High experience",
      },
    },
    levelAdjustments: {
      "1": {
        label: "Level 1",
        deltaVariability: 0,
        deltaRepresentativeness: 0,
        deltaDecisionMaking: 0,
        deltaTaskComplexity: 0,
        deltaFeedbackFrequency: 0,
        rationale: "No delta",
      },
      "2": {
        label: "Level 2",
        deltaVariability: 0.1,
        deltaRepresentativeness: 0.1,
        deltaDecisionMaking: 0.1,
        deltaTaskComplexity: 0.1,
        deltaFeedbackFrequency: -0.1,
        rationale: "Intermediate adjustment",
      },
      "3": {
        label: "Level 3",
        deltaVariability: 0.2,
        deltaRepresentativeness: 0.2,
        deltaDecisionMaking: 0.2,
        deltaTaskComplexity: 0.2,
        deltaFeedbackFrequency: -0.2,
        rationale: "Advanced adjustment",
      },
    },
    phaseModifiers: {
      fundamentos: {
        label: "Fundamentos",
        deltaVariability: -0.1,
        deltaRepresentativeness: -0.1,
        deltaDecisionMaking: -0.05,
        deltaTaskComplexity: -0.05,
        deltaFeedbackFrequency: 0.1,
        rationale: "Foundation phase",
      },
      consolidacao: {
        label: "Consolidação",
        deltaVariability: 0,
        deltaRepresentativeness: 0.05,
        deltaDecisionMaking: 0.05,
        deltaTaskComplexity: 0,
        deltaFeedbackFrequency: 0,
        rationale: "Consolidation phase",
      },
      especializacao: {
        label: "Especialização",
        deltaVariability: 0.1,
        deltaRepresentativeness: 0.15,
        deltaDecisionMaking: 0.15,
        deltaTaskComplexity: 0.1,
        deltaFeedbackFrequency: -0.1,
        rationale: "Specialization phase",
      },
      competicao: {
        label: "Competição",
        deltaVariability: 0.2,
        deltaRepresentativeness: 0.2,
        deltaDecisionMaking: 0.1,
        deltaTaskComplexity: 0,
        deltaFeedbackFrequency: -0.2,
        rationale: "Competition phase",
      },
    },
    refinementRules: {
      rules: [
        {
          id: "critical-gap-low-consistency",
          condition: "gap.level === 'critico' && consistencyScore < 50%",
          description: "Critical gap with low consistency",
          adjustments: { feedbackFrequency: "+1" },
          priority: 1,
        },
        {
          id: "trend-improving-high-consistency",
          condition: "trend === 'subindo' && consistencyScore > 80%",
          description: "Trending upward with high consistency",
          adjustments: { representativeness: "+1" },
          priority: 2,
        },
      ],
      safetyGates: [
        {
          id: "low-sample-confidence",
          condition: "sampleConfidence === 'baixo'",
          action: "BLOCK all adjustments; return baseProfile unmodified",
          description: "Insufficient sample size",
        },
      ],
    },
    changeLogs: [
      {
        version: "fallback.2026.04.07",
        date: new Date().toISOString(),
        changes: "Fallback configuration generated at runtime",
        motivation: "JSON file failed to load during bootstrap",
        reviewedBy: "GoAtleta System",
      },
    ],
  };
}

// ============================================================================
// CONFIG LOADER
// ============================================================================

/**
 * Load pedagogical dimensions configuration from JSON file
 * Returns config if successful, fallback if file loading fails
 *
 * @returns Loaded or fallback PedagogicalDimensionsConfig
 */
export async function loadPedagogicalConfig(): Promise<{
  config: PedagogicalDimensionsConfig;
  error: Error | null;
}> {
  try {
    // Import JSON config file
    const configModule = await import("../config/pedagogical-dimensions.json");
    const parsed = configModule.default;

    // Validate against schema
    if (!isValidPedagogicalConfig(parsed)) {
      throw new Error("Config does not match PedagogicalDimensionsConfig schema");
    }

    if (__DEV__) {
      console.log(`[bootstrap] Pedagogical config loaded: v${parsed.version}`);
    }

    Sentry.addBreadcrumb({
      category: "bootstrap",
      message: `Pedagogical config loaded: v${parsed.version}`,
      level: "info",
    });

    return { config: parsed, error: null };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Log to Sentry but don't crash
    Sentry.captureException(err, {
      tags: {
        component: "bootstrap",
        phase: "pedagogical-config-load",
      },
      level: "warning", // Not critical—fallback will be used
    });

    if (__DEV__) {
      console.warn("[bootstrap] Pedagogical config load failed, using fallback:", err.message);
    }

    // Return fallback config
    const fallback = createFallbackConfig();
    return { config: fallback, error: err };
  }
}
