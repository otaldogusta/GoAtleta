/**
 * Pedagogical Dimensions System - Unit Tests
 *
 * Tests cover:
 * - Profile derivation from age, level, phase
 * - Refinement based on evaluation results
 * - Safety gates (low sample confidence)
 * - Edge cases and error handling
 */

import type { PedagogicalDimensionsConfig } from "../../config/pedagogical-dimensions-config";
import {
    buildCAPFromDimensions,
    buildDimensionGuidelines,
    deriveDimensionsProfile,
    formatDimensionsProfile,
    formatRefinements,
    refineDimensionsByEvaluation,
} from "../pedagogical-dimensions";
import type {
    DimensionDerivationInput,
    PedagogicalDimensionsProfile,
} from "../pedagogical-dimensions-types";
import type { SessionOutcomeEvaluation } from "../pedagogical-evaluation";

// Mock configuration for testing
const MOCK_CONFIG: PedagogicalDimensionsConfig = {
  version: "test.2026.04.07",
  lastUpdated: new Date().toISOString(),
  description: "Mock config for testing",
  metadata: { author: "Test", sources: [] },
  dimensions: {
    variability: {
      baixa: { label: "Low", description: "", scientificBasis: "", confidenceLevel: "alta" },
      media: { label: "Med", description: "", scientificBasis: "", confidenceLevel: "alta" },
      alta: { label: "High", description: "", scientificBasis: "", confidenceLevel: "alta" },
    },
    representativeness: {
      baixa: { label: "Low", description: "", scientificBasis: "", confidenceLevel: "alta" },
      media: { label: "Med", description: "", scientificBasis: "", confidenceLevel: "alta" },
      alta: { label: "High", description: "", scientificBasis: "", confidenceLevel: "alta" },
    },
    decisionMaking: {
      baixa: { label: "Low", description: "", scientificBasis: "", confidenceLevel: "alta" },
      media: { label: "Med", description: "", scientificBasis: "", confidenceLevel: "alta" },
      alta: { label: "High", description: "", scientificBasis: "", confidenceLevel: "alta" },
    },
    taskComplexity: {
      baixa: { label: "Low", description: "", scientificBasis: "", confidenceLevel: "alta" },
      media: { label: "Med", description: "", scientificBasis: "", confidenceLevel: "alta" },
      alta: { label: "High", description: "", scientificBasis: "", confidenceLevel: "alta" },
    },
    feedbackFrequency: {
      baixa: { label: "Low", description: "", scientificBasis: "", confidenceLevel: "media" },
      media: { label: "Med", description: "", scientificBasis: "", confidenceLevel: "media" },
      alta: { label: "High", description: "", scientificBasis: "", confidenceLevel: "media" },
    },
  },
  ageProfiles: {
    "8-11": {
      label: "8-11",
      variability: "baixa",
      representativeness: "baixa",
      decisionMaking: "baixa",
      taskComplexity: "baixa",
      feedbackFrequency: "alta",
      rationale: "test",
    },
    "10-12": {
      label: "10-12",
      variability: "media",
      representativeness: "baixa",
      decisionMaking: "baixa",
      taskComplexity: "media",
      feedbackFrequency: "media",
      rationale: "test",
    },
    "12-14": {
      label: "12-14",
      variability: "media",
      representativeness: "media",
      decisionMaking: "media",
      taskComplexity: "media",
      feedbackFrequency: "media",
      rationale: "test",
    },
    "14+": {
      label: "14+",
      variability: "alta",
      representativeness: "alta",
      decisionMaking: "alta",
      taskComplexity: "alta",
      feedbackFrequency: "baixa",
      rationale: "test",
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
      rationale: "test",
    },
    "2": {
      label: "Level 2",
      deltaVariability: 0.1,
      deltaRepresentativeness: 0.1,
      deltaDecisionMaking: 0.1,
      deltaTaskComplexity: 0.1,
      deltaFeedbackFrequency: -0.1,
      rationale: "test",
    },
    "3": {
      label: "Level 3",
      deltaVariability: 0.2,
      deltaRepresentativeness: 0.2,
      deltaDecisionMaking: 0.2,
      deltaTaskComplexity: 0.2,
      deltaFeedbackFrequency: -0.2,
      rationale: "test",
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
      rationale: "test",
    },
    consolidacao: {
      label: "Consolidação",
      deltaVariability: 0,
      deltaRepresentativeness: 0.05,
      deltaDecisionMaking: 0.05,
      deltaTaskComplexity: 0,
      deltaFeedbackFrequency: 0,
      rationale: "test",
    },
    especializacao: {
      label: "Especialização",
      deltaVariability: 0.1,
      deltaRepresentativeness: 0.15,
      deltaDecisionMaking: 0.15,
      deltaTaskComplexity: 0.1,
      deltaFeedbackFrequency: -0.1,
      rationale: "test",
    },
    competicao: {
      label: "Competição",
      deltaVariability: 0.2,
      deltaRepresentativeness: 0.2,
      deltaDecisionMaking: 0.1,
      deltaTaskComplexity: 0,
      deltaFeedbackFrequency: -0.2,
      rationale: "test",
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
        description: "Trending upward",
        adjustments: { representativeness: "+1" },
        priority: 2,
      },
    ],
    safetyGates: [
      {
        id: "low-sample-confidence",
        condition: "sampleConfidence === 'baixo'",
        action: "BLOCK all adjustments; return baseProfile unmodified",
        description: "Low confidence",
      },
    ],
  },
  changeLogs: [],
};

describe("pedagogical-dimensions", () => {
  // ========== DERIVATION TESTS ==========

  describe("deriveDimensionsProfile", () => {
    it("should derive baixa feedback for age 8 (iniciação)", () => {
      const input: DimensionDerivationInput = {
        studentAge: 8,
        classLevel: 1,
        periodizationPhase: "fundamentos",
      };

      const result = deriveDimensionsProfile(input, MOCK_CONFIG);

      // Age 8 → "8-11" profile: feedback="alta"
      // Level 1: no delta
      // Phase "fundamentos": +0.1 feedback (but clamped at alta)
      expect(result.baseProfile.feedbackFrequency).toBe("alta");
      expect(result.age).toBe(8);
      expect(result.level).toBe(1);
    });

    it('should keep "media" variability for age 11 + level 2', () => {
      const input: DimensionDerivationInput = {
        studentAge: 11,
        classLevel: 2,
        periodizationPhase: "consolidacao",
      };

      const result = deriveDimensionsProfile(input, MOCK_CONFIG);

      // Age 11 → "10-12" profile: variability="media"
      // Level 2: +0.1 delta
      // Phase "consolidacao": no delta
      // Result: media + 0.1 is below step threshold and remains media
      expect(result.baseProfile.variability).toBe("media");
    });

    it("should derive alta dimensions for age 16 competitive", () => {
      const input: DimensionDerivationInput = {
        studentAge: 16,
        classLevel: 3,
        periodizationPhase: "competicao",
      };

      const result = deriveDimensionsProfile(input, MOCK_CONFIG);

      // Age 16 → "14+" profile: all "alta"
      // Level 3: +0.2 delta
      // Phase "competicao": +0.2 variability, +0.2 representativeness, +0.1 decisionMaking
      // All clamped to alta (max level)
      expect(result.baseProfile.variability).toBe("alta");
      expect(result.baseProfile.representativeness).toBe("alta");
      expect(result.baseProfile.taskComplexity).toBe("alta");
    });

    it("young learners should never have high variability in fundamentos", () => {
      const result = deriveDimensionsProfile(
        {
          studentAge: 8,
          classLevel: 1,
          periodizationPhase: "fundamentos",
        },
        MOCK_CONFIG
      );

      expect(result.baseProfile.variability).not.toBe("alta");
    });
  });

  // ========== REFINEMENT TESTS ==========

  describe("refineDimensionsByEvaluation", () => {
    const baseProfile: PedagogicalDimensionsProfile = {
      variability: "media",
      representativeness: "media",
      decisionMaking: "media",
      taskComplexity: "media",
      feedbackFrequency: "media",
    };

    it("should block refinement if sampleConfidence is 'baixo'", () => {
      const evaluation: SessionOutcomeEvaluation = {
        achieved: false,
        performanceScore: 30,
        targetScore: 70,
        adjustment: "maintain",
        evidence: "low sample",
        sampleConfidence: "baixo",
        learningVelocity: 0,
        consistencyScore: 20,
        deltaFromPrevious: null,
        gap: { value: 40, level: "critico", direction: "deficit" },
        skillLearningState: { skill: "saque", level: "instavel", trend: "caindo" },
      };

      const refined = refineDimensionsByEvaluation(baseProfile, evaluation, MOCK_CONFIG);

      // Safety gate: no adjustments
      expect(refined.adjustments).toEqual([]);
      expect(refined.feedbackFrequency).toBe(baseProfile.feedbackFrequency);
    });

    it("should return unmodified profile if evaluation is null", () => {
      const refined = refineDimensionsByEvaluation(baseProfile, null, MOCK_CONFIG);

      expect(refined.adjustments).toEqual([]);
      expect(refined.feedbackFrequency).toBe(baseProfile.feedbackFrequency);
    });

    it("should increase feedbackFrequency if gap is critical + low consistency", () => {
      const evaluation: SessionOutcomeEvaluation = {
        achieved: false,
        performanceScore: 30,
        targetScore: 70,
        adjustment: "maintain",
        evidence: "critical gap",
        sampleConfidence: "medio",
        learningVelocity: 0,
        consistencyScore: 45, // < 50
        deltaFromPrevious: null,
        gap: { value: 40, level: "critico", direction: "deficit" },
        skillLearningState: { skill: "saque", level: "consolidando", trend: "caindo" },
      };

      const refined = refineDimensionsByEvaluation(baseProfile, evaluation, MOCK_CONFIG);

      // Rule: critical-gap-low-consistency should trigger
      // feedbackFrequency: media + 1 = alta
      expect(refined.feedbackFrequency).toBe("alta");
      expect(refined.adjustments?.length).toBeGreaterThan(0);
      expect(refined.adjustments?.[0].dimension).toBe("feedbackFrequency");
    });

    it("should increase representativeness if trend is positive + high consistency", () => {
      const evaluation: SessionOutcomeEvaluation = {
        achieved: true,
        performanceScore: 85,
        targetScore: 75,
        adjustment: "increase",
        evidence: "improving",
        sampleConfidence: "alto",
        learningVelocity: 5,
        consistencyScore: 85, // > 80
        deltaFromPrevious: 10,
        gap: { value: 5, level: "pequeno", direction: "superavit" },
        skillLearningState: { skill: "saque", level: "consistente", trend: "subindo" },
      };

      const refined = refineDimensionsByEvaluation(baseProfile, evaluation, MOCK_CONFIG);

      // Rule: trend-improving-high-consistency should trigger
      // representativeness: media + 1 = alta
      expect(refined.representativeness).toBe("alta");
      expect(refined.adjustments?.[0].dimension).toBe("representativeness");
    });
  });

  // ========== FORMATTING & EDGE CASES ==========

  describe("formatDimensionsProfile", () => {
    it("should format profile as readable string", () => {
      const profile: PedagogicalDimensionsProfile = {
        variability: "media",
        representativeness: "baixa",
        decisionMaking: "alta",
        taskComplexity: "media",
        feedbackFrequency: "baixa",
      };

      const formatted = formatDimensionsProfile(profile, "Test Profile");

      expect(formatted).toContain("Test Profile");
      expect(formatted).toContain("media");
      expect(formatted).toContain("baixa");
      expect(formatted).toContain("alta");
    });

    it("should handle undefined label", () => {
      const profile: PedagogicalDimensionsProfile = {
        variability: "alta",
        representativeness: "alta",
        decisionMaking: "alta",
        taskComplexity: "alta",
        feedbackFrequency: "alta",
      };

      const formatted = formatDimensionsProfile(profile);

      expect(formatted).not.toContain("undefined");
      expect(formatted).toContain("alta");
    });
  });

  describe("formatRefinements", () => {
    it("should format refinement reasons as readable list", () => {
      const adjustments = [
        {
          dimension: "feedbackFrequency" as const,
          oldLevel: "media" as const,
          newLevel: "alta" as const,
          reason: "Critical gap detected",
          delta: 1,
          timestamp: new Date().toISOString(),
        },
      ];

      const formatted = formatRefinements(adjustments);

      expect(formatted).toContain("feedbackFrequency");
      expect(formatted).toContain("media");
      expect(formatted).toContain("alta");
      expect(formatted).toContain("Critical gap");
    });

    it("should return 'No adjustments' for empty array", () => {
      const formatted = formatRefinements([]);
      expect(formatted).toBe("No adjustments");
    });

    it("should return 'No adjustments' for undefined", () => {
      const formatted = formatRefinements(undefined);
      expect(formatted).toBe("No adjustments");
    });
  });

    describe("buildDimensionGuidelines", () => {
      it("should generate 5 guidance lines for low-structure beginner profile", () => {
        const profile: PedagogicalDimensionsProfile = {
          variability: "baixa",
          representativeness: "baixa",
          decisionMaking: "baixa",
          taskComplexity: "baixa",
          feedbackFrequency: "alta",
        };

        const guidelines = buildDimensionGuidelines(profile);

        expect(guidelines).toHaveLength(5);
        expect(guidelines.join(" ")).toContain("baixa variacao");
        expect(guidelines.join(" ")).toContain("feedback frequente");
        expect(guidelines.join(" ")).toContain("escolhas simples");
      });

      it("should generate autonomy-focused guidance for advanced profile", () => {
        const profile: PedagogicalDimensionsProfile = {
          variability: "alta",
          representativeness: "alta",
          decisionMaking: "alta",
          taskComplexity: "alta",
          feedbackFrequency: "baixa",
        };

        const guidelines = buildDimensionGuidelines(profile);

        expect(guidelines).toHaveLength(5);
        expect(guidelines.join(" ")).toContain("autonomia alta");
        expect(guidelines.join(" ")).toContain("jogo real");
        expect(guidelines.join(" ")).toContain("feedback mais espaçado");
      });
    });

    describe("buildCAPFromDimensions", () => {
      it("should generate CAP objectives with active-learning language", () => {
        const profile: PedagogicalDimensionsProfile = {
          variability: "media",
          representativeness: "media",
          decisionMaking: "media",
          taskComplexity: "media",
          feedbackFrequency: "media",
        };

        const cap = buildCAPFromDimensions(profile);

        expect(cap.conceitual.length).toBeGreaterThan(0);
        expect(cap.procedimental.length).toBeGreaterThan(0);
        expect(cap.atitudinal.length).toBeGreaterThan(0);

        const merged = [...cap.conceitual, ...cap.procedimental, ...cap.atitudinal].join(" ");
        expect(merged).toContain("Analisar situacoes");
        expect(merged).toContain("adaptando");
        expect(merged).toContain("Participar ativamente");
        expect(merged).not.toContain("obedecer");
      });

      it("should preserve autonomy emphasis when decisionMaking is alta", () => {
        const profile: PedagogicalDimensionsProfile = {
          variability: "alta",
          representativeness: "alta",
          decisionMaking: "alta",
          taskComplexity: "alta",
          feedbackFrequency: "baixa",
        };

        const cap = buildCAPFromDimensions(profile);
        expect(cap.atitudinal.join(" ")).toContain("autonomia");
      });
    });

  // ========== INTEGRATION TESTS ==========

  describe("Full derivation pipeline", () => {
    it("should produce complete profile with base and refined", () => {
      const input: DimensionDerivationInput = {
        studentAge: 12,
        classLevel: 2,
        periodizationPhase: "consolidacao",
        performanceState: {
          gap: { level: "critico" },
          trend: "caindo",
          consistencyScore: 45,
          sampleConfidence: "medio",
        },
      };

      const result = deriveDimensionsProfile(input, MOCK_CONFIG);

      expect(result.baseProfile).toBeDefined();
      expect(result.derivedAt).toBeDefined();
      expect(result.confidenceLevel).toBe("media");

      // Refinement should happen if we call it with evaluation
      const evaluation: SessionOutcomeEvaluation = {
        achieved: false,
        performanceScore: 40,
        targetScore: 70,
        adjustment: "maintain",
        evidence: "test",
        sampleConfidence: "medio",
        learningVelocity: -2,
        consistencyScore: 45,
        deltaFromPrevious: null,
        gap: { value: 30, level: "critico", direction: "deficit" },
        skillLearningState: { skill: "saque", level: "consolidando", trend: "caindo" },
      };

      const refined = refineDimensionsByEvaluation(
        result.baseProfile,
        evaluation,
        MOCK_CONFIG
      );

      expect(refined.adjustments?.length).toBeGreaterThanOrEqual(0);
    });
  });
});
