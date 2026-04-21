import { formatGenerationExplanation } from "../cycle-day-planning/format-generation-explanation";
import type { CycleDayPlanningContext, SessionStrategy } from "../models";

const buildContext = (
  overrides: Partial<CycleDayPlanningContext> = {}
): CycleDayPlanningContext => ({
  classId: "class_1",
  sessionDate: "2026-04-12",
  modality: "voleibol",
  classLevel: 2,
  ageBand: "13-15",
  daysPerWeek: 3,
  developmentStage: "especializado",
  planningPhase: "desenvolvimento",
  weekNumber: 6,
  sessionIndexInWeek: 2,
  historicalConfidence: "medium",
  phaseIntent: "estabilizacao_tecnica",
  weeklyLoadIntent: "moderado",
  primarySkill: "passe",
  secondarySkill: "levantamento",
  progressionDimensionTarget: "precisao",
  pedagogicalIntent: "technical_adjustment",
  recentSessions: [],
  dominantBlock: "Organizacao ofensiva",
  targetPse: 6,
  demandIndex: 7,
  plannedSessionLoad: 480,
  plannedWeeklyLoad: 1440,
  duration: 90,
  materials: ["quadra"],
  constraints: [],
  mustAvoidRepeating: [],
  allowedDrillFamilies: ["bloco_tecnico", "deslocamento", "jogo_condicionado"],
  forbiddenDrillFamilies: ["repeticao_estatica_prolongada"],
  ...overrides,
});

const buildStrategy = (
  overrides: Partial<SessionStrategy> = {}
): SessionStrategy => ({
  primarySkill: "saque",
  secondarySkill: "ataque",
  progressionDimension: "precisao",
  pedagogicalIntent: "technical_adjustment",
  loadIntent: "alto",
  drillFamilies: ["deslocamento", "jogo_condicionado"],
  forbiddenDrillFamilies: ["repeticao_estatica_prolongada"],
  oppositionLevel: "medium",
  timePressureLevel: "high",
  gameTransferLevel: "high",
  ...overrides,
});

describe("formatGenerationExplanation", () => {
  it("builds a coach summary with readable phase, focus reason, and teacher learning", () => {
    const result = formatGenerationExplanation({
      cycleContext: buildContext(),
      baseStrategy: buildStrategy({ primarySkill: "passe", progressionDimension: "consistencia" }),
      strategy: buildStrategy(),
      fingerprint: "fingerprint_a",
      structuralFingerprint: "structural_a",
      repetitionAdjustment: {
        detected: true,
        risk: "high",
        reason: "recent_exact_clone",
        changedFields: ["drillFamilies"],
      },
      dominantBlockAdjusted: true,
      dominantBlockInfluence: {
        key: "organizacao_ofensiva",
        label: "Organizacao ofensiva",
        dominantBlock: "Organizacao ofensiva",
      },
      loadAdjusted: true,
      loadInfluence: {
        key: "intensive",
        label: "Carga intensiva",
        targetPse: 6,
        demandIndex: 7,
        plannedSessionLoad: 480,
      },
      overrideAdjusted: true,
      overrideInfluence: {
        strength: "strong",
        weightedOccurrences: 6,
        learningWindowGenerations: 3,
        preferredPrimarySkill: "saque",
        preferredProgressionDimension: "precisao",
        learnedFields: ["primarySkill", "progressionDimension"],
      },
      operationalAdjusted: true,
      operationalInfluence: {
        applied: true,
        rulesApplied: ["age_band_hard_constraint", "anti_repetition_progression_axis"],
        changedFields: ["progressionDimension", "loadIntent"],
      },
    });

    expect(result.coachSummary).toContain("Histórico parcial na fase Estabilização técnica.");
    expect(result.coachSummary).toContain("Sessão 2/3 com foco em Saque");
    expect(result.coachSummary).toContain("para ajuste técnico com progressão em Precisao.");
    expect(result.coachSummary).toContain("Aprendizado local do professor (forte) segue pelas próximas 3 gerações.");
    expect(result.coachSummary).toContain("Bloco organizacao ofensiva priorizado.");
    expect(result.coachSummary).toContain("Carga intensiva aplicada.");
    expect(result.coachSummary).toContain("Variação anti-repetição aplicada por clone recente.");
    expect(result.summary).toContain("regras operacionais");
    expect(result.debug.operationalAdjusted).toBe(true);
    expect(result.debug.overrideStrength).toBe("strong");
    expect(result.debug.historyMode).toBe("partial_history");
  });
});
