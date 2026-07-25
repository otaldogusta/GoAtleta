export type SessionStrategyPhase = "base" | "desenvolvimento" | "pre_competitivo" | "competitivo";
export type SessionPhaseIntent =
  | "exploracao_fundamentos"
  | "estabilizacao_tecnica"
  | "aceleracao_decisao"
  | "transferencia_jogo"
  | "pressao_competitiva";
export type SessionSkill = "passe" | "levantamento" | "ataque" | "bloqueio" | "defesa" | "saque" | "transicao";
export type ProgressionDimension =
  | "consistencia"
  | "precisao"
  | "pressao_tempo"
  | "oposicao"
  | "tomada_decisao"
  | "transferencia_jogo";
export type PedagogicalIntent =
  | "decision_making"
  | "game_reading"
  | "team_organization"
  | "technical_adjustment"
  | "pressure_adaptation";
export type WeeklyLoadIntent = "baixo" | "moderado" | "alto";

export type SessionDecisionTrace = {
  schemaVersion: 1;
  source: {
    classId: string;
    sessionDate: string;
    classPlanId?: string;
    classPlanWeekNumber?: number;
  };
  plannedContext: {
    ageBand: string;
    classLevel: number;
    planningPhase?: SessionStrategyPhase;
    weekNumber?: number;
    sessionIndexInWeek: number;
    loadIntent: WeeklyLoadIntent;
    plannedSessionLoad?: number;
    plannedWeeklyLoad?: number;
  };
  decision: {
    primarySkill: SessionSkill;
    secondarySkill?: SessionSkill;
    progressionDimension: ProgressionDimension;
    pedagogicalIntent: PedagogicalIntent;
    phaseIntent?: SessionPhaseIntent;
  };
  influences: {
    periodization: {
      used: boolean;
      technicalFocus?: string;
      theme?: string;
      phase?: string;
      rpeTarget?: string;
      weeklyOperationalDecision?: string;
    };
    periodizationDaily: {
      used: boolean;
      dailyPlanId?: string;
      weeklyPlanId?: string;
      title?: string;
      sourceObjective?: string;
      conflictResolved?: boolean;
      conflictReasons: string[];
    };
    classContext: {
      used: boolean;
      goal?: string;
      modality?: string;
      materials: string[];
      constraints: string[];
    };
    scouting: {
      used: boolean;
      dominantGapSkill?: SessionSkill;
      dominantGapType?: string;
      confidence?: "none" | "low" | "medium" | "high";
      sampleSize?: number;
    };
    history: {
      used: boolean;
      historicalConfidence: "none" | "low" | "medium" | "high";
      recentSkills: SessionSkill[];
      mustAvoidRepeating: string[];
      mustProgressFrom?: string;
    };
    reportFeedback: {
      used: boolean;
      signals: string[];
      rulesApplied?: string[];
      adjusted?: boolean;
    };
    documentContext?: {
      used: boolean;
      referenceCount: number;
      planningSourceTitle?: string;
      sourceScopes: string[];
      actionDate?: string;
      warnings: string[];
      readOnly: true;
    };
  };
  safeguards: {
    repetitionAdjusted: boolean;
    overrideAdjusted: boolean;
    fallbackUsed: boolean;
    ageSanitizerFlags: string[];
    envelopeDiagnostics: string[];
  };
  teacherFacingSummary: string;
};
