import type {
  AppliedPedagogicalReference,
  DocumentReadOnlyActionContract,
} from "./document-intelligence";

export const SESSION_PLANNING_CONTEXT_SCHEMA_VERSION = 1 as const;
export type SessionPlanningContextSchemaVersion =
  typeof SESSION_PLANNING_CONTEXT_SCHEMA_VERSION;

export type SessionPlanningUpcomingEvent = {
  title: string;
  date: string;
  classScoped: boolean;
};

export type SessionPlanningClassProfile = {
  level: number;
  daysPerWeek: number;
  size: number;
  heterogeneity: string;
};

export type ReportFeedbackSignal = {
  participationLevel?: "low" | "normal";
  techniqueSignal?: "recurring_difficulty" | "stable";
  classClimate?: "agitated" | "conflict" | "stable";
  loadSignal?: "low_frequency" | "normal";
  notes: string[];
};

export type SessionPlanningDailyPlanAnchor = {
  schemaVersion: 1;
  dailyPlanId: string;
  weeklyPlanId: string;
  sessionDate: string;
  title: string;
  objectiveHint?: string;
  plannedBlocks: {
    key: "warmup" | "main" | "cooldown";
    label: string;
    activities: string[];
  }[];
  observations?: string;
  syncStatus?: "in_sync" | "out_of_sync" | "overridden" | "stale_parent";
  skillHints: VolleyballSkill[];
  activityHints: string[];
  constraintHints: string[];
  conflictResolved: boolean;
  conflictReasons: string[];
};

export type SessionPlanningDocumentSupport = {
  status: "available" | "no_relevant_content" | "unavailable";
  references: AppliedPedagogicalReference[];
  warnings: string[];
  retrievalMode?: "semantic" | "lexical_fallback" | "contextual";
  actionDate?: string;
  actionContract?: DocumentReadOnlyActionContract;
};

export type VolleyballSkill =
  | "passe"
  | "levantamento"
  | "ataque"
  | "bloqueio"
  | "defesa"
  | "saque"
  | "transicao";

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

export type ClassReadinessRiskFlag =
  | "sem_relatorio"
  | "historico_fraco"
  | "alunos_novos"
  | "turma_heterogenea"
  | "salto_de_complexidade"
  | "baixa_frequencia"
  | "dificuldade_recorrente"
  | "periodizacao_agressiva";

export type ClassReadinessRecommendation =
  | "diagnosticar"
  | "regredir"
  | "consolidar"
  | "progredir";

export type ReadinessConfidence = "critical" | "low" | "medium" | "high";

export type GameFormatLevel =
  | "L0_onboarding"
  | "L1_controle_individual"
  | "L2_1x1_facilitado"
  | "L3_1x1_intencional"
  | "L4_2x2_cooperativo"
  | "L5_2x2_decisao"
  | "L6_3x3_introdutorio"
  | "L7_3x3_organizado"
  | "L8_festival_aplicado";

export type ClassReadinessState = {
  classId: string;
  plannedGameLevel: GameFormatLevel;
  estimatedGameLevel: GameFormatLevel;
  appliedCoreLevel: GameFormatLevel;
  confidence: ReadinessConfidence;
  riskFlags: ClassReadinessRiskFlag[];
  recommendation: ClassReadinessRecommendation;
  reason: string[];
  teacherMessage: string;
};

export type AdaptiveLessonEnvelope = {
  periodizationTarget: GameFormatLevel;
  appliedCoreLevel: GameFormatLevel;
  diagnosticProbe: {
    title: string;
    description: string;
    decisionRule: string;
  };
  planARegression: {
    level: GameFormatLevel;
    intent: string;
    suggestedConstraint: string;
  };
  planBCore: {
    level: GameFormatLevel;
    intent: string;
    suggestedConstraint: string;
  };
  planCProgression: {
    level: GameFormatLevel;
    intent: string;
    suggestedConstraint: string;
  };
};

export type SessionCoachGuidance = {
  title: string;
  subtitle?: string;
  doNow: string[];
  avoidToday: string[];
  advanceIf: string[];
  simplifyIf: string[];
  setupHint?: string;
  closingCue?: string;
};

export type PedagogicalFeedbackSignal =
  | "emotional_conflict"
  | "class_agitation"
  | "low_participation"
  | "recurring_technical_difficulty"
  | "excessive_competition"
  | "low_frequency";

export type SessionPlanningContext = {
  schemaVersion: SessionPlanningContextSchemaVersion;
  classId: string;
  sessionDate: string;
  ageBand: string;
  sport: "volleyball";
  skillFocus: VolleyballSkill;
  secondarySkill?: VolleyballSkill;
  cycleGoal?: string;
  weekGoal?: string;
  weekNumber?: number;
  sessionIndexInWeek?: number;
  periodizationPhase?: "base" | "desenvolvimento" | "pre_competitivo" | "competitivo";
  progressionDimension: ProgressionDimension;
  pedagogicalIntent: PedagogicalIntent;
  loadIntent: WeeklyLoadIntent;
  previousSessionSummary?: string;
  recentDifficulties: string[];
  recentActivityFamilies: string[];
  recentActivityNames?: string[];
  recentActivityPatternIds?: string[];
  upcomingEvents: SessionPlanningUpcomingEvent[];
  availableDuration: number;
  materials: string[];
  classProfile: SessionPlanningClassProfile;
  constraints: string[];
  reportFeedback?: ReportFeedbackSignal;
  dailyPlanAnchor?: SessionPlanningDailyPlanAnchor;
  readinessState?: ClassReadinessState;
  adaptiveEnvelope?: AdaptiveLessonEnvelope;
  coachGuidance?: SessionCoachGuidance;
  documentSupport?: SessionPlanningDocumentSupport;
  /** Compatibilidade de leitura para snapshots criados antes da camada unificada. */
  academicSupport?: SessionPlanningDocumentSupport;
};

export type ParsedSessionPlanningContext =
  | {
      status: "current" | "legacy";
      context: SessionPlanningContext;
      warnings: string[];
    }
  | {
      status: "invalid";
      context: null;
      warnings: string[];
    };
