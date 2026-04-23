import type { ClassModality } from "./class-modality";
import type { PedagogicalApproachDetection } from "./methodology/pedagogical-approach-detector";

export type AgeBand = string;
export type Goal = string;
export type Equipment = "quadra" | "funcional" | "academia" | "misto";

// ─── Resistance / Integrated Training ────────────────────────────────────────

/** How court and gym sessions relate inside the weekly microcycle. */
export type IntegratedTrainingModel =
  | "quadra_apenas"
  | "academia_complementar"
  | "academia_integrada"
  | "academia_prioritaria";

/** Athlete profile for resistance training prescription. */
export type ResistanceTrainingProfile =
  | "iniciante"
  | "intermediario"
  | "avancado";

/** Encapsulates the training context of a class group (derived + explicit). */
export type TeamTrainingContext = {
  hasGymAccess: boolean;
  integratedTrainingModel: IntegratedTrainingModel;
  resistanceTrainingProfile: ResistanceTrainingProfile;
};

// ─── Session Environment ──────────────────────────────────────────────────────

/** Physical environment where a session takes place. */
export type SessionEnvironment = "quadra" | "academia" | "mista" | "preventiva";

/** Primary training component driving the session goal. */
export type SessionPrimaryComponent =
  | "tecnico_tatico"
  | "fisico_integrado"
  | "resistido"
  | "preventivo"
  | "misto_transferencia";
export type ClassGender = "masculino" | "feminino" | "misto";
export type Modality = ClassModality;
export type AthletePosition =
  | "indefinido"
  | "levantador"
  | "oposto"
  | "ponteiro"
  | "central"
  | "libero";
export type AthleteObjective = "ludico" | "base" | "rendimento";
export type AthleteLearningStyle = "misto" | "visual" | "auditivo" | "cinestesico";
export type CompetitivePlanningMode = "adulto-competitivo";
export type ClassCalendarExceptionKind = "no_training";

export type ClassGroup = {
  id: string;
  name: string;
  organizationId: string;
  unit: string;
  unitId: string;
  colorKey: string;
  modality: Modality;
  ageBand: AgeBand;
  gender: ClassGender;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  daysOfWeek: number[];
  daysPerWeek: number;
  goal: Goal;
  equipment: Equipment;
  level: 1 | 2 | 3;
  mvLevel: string;
  cycleStartDate: string;
  cycleLengthWeeks: number;
  acwrLow: number;
  acwrHigh: number;
  createdAt: string;
  /** Optional: overrides derived model from equipment field */
  integratedTrainingModel?: IntegratedTrainingModel;
  /** Optional: resistance training experience level for this group */
  resistanceTrainingProfile?: ResistanceTrainingProfile;
};

export type Unit = {
  id: string;
  name: string;
  organizationId: string;
  address: string;
  notes: string;
  createdAt: string;
};

export type SessionPlan = {
  block: string;
  warmup: string[];
  main: string[];
  cooldown: string[];
};

export type SessionLog = {
  id?: string;
  clientId?: string;
  classId: string;
  PSE: number;
  technique: "boa" | "ok" | "ruim" | "nenhum";
  attendance: number;
  activity: string;
  conclusion: string;
  participantsCount?: number;
  photos: string;
  painScore?: number;
  createdAt: string;
};

export type TrainingSessionStatus = "scheduled" | "completed" | "cancelled";
export type TrainingSessionType = "training" | "integration" | "event" | "match";
export type TrainingSessionSource = "manual" | "plan" | "import";

export type TrainingSession = {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  status: TrainingSessionStatus;
  type: TrainingSessionType;
  source: TrainingSessionSource;
  planId?: string | null;
  classIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type TrainingSessionClass = {
  id: string;
  sessionId: string;
  classId: string;
  organizationId: string;
  createdAt: string;
};

export type TrainingSessionIntegrationRule = {
  id: string;
  organizationId: string;
  sourceSessionId: string;
  startAt: string;
  endAt: string;
  classCount: number;
  classIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type TrainingSessionIntegrationRuleClass = {
  id: string;
  ruleId: string;
  classId: string;
  organizationId: string;
  createdAt: string;
};

export type TrainingSessionAttendance = {
  id: string;
  sessionId: string;
  studentId: string;
  classId: string;
  organizationId: string;
  status: "present" | "absent";
  note: string;
  painScore: number;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeBaseDomain =
  | "general"
  | "youth_training"
  | "general_fitness"
  | "clinical"
  | "performance";

export type KnowledgeBaseVersionStatus = "draft" | "review" | "active" | "archived";
export type KnowledgeSourceType = "guideline" | "book" | "paper" | "web" | "policy" | "other";
export type KnowledgeRuleStatus = "draft" | "review" | "active" | "archived";
export type KnowledgeRuleKind =
  | "recommendation"
  | "methodology"
  | "progression"
  | "safety"
  | "assessment"
  | "recovery"
  | "reference";

export type KnowledgeBaseVersion = {
  id: string;
  organizationId: string;
  domain: KnowledgeBaseDomain;
  versionLabel: string;
  description: string;
  status: KnowledgeBaseVersionStatus;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeSource = {
  id: string;
  organizationId: string;
  knowledgeBaseVersionId: string;
  domain: KnowledgeBaseDomain;
  title: string;
  authors: string;
  sourceYear?: number | null;
  edition: string;
  sourceType: KnowledgeSourceType;
  sourceUrl: string;
  citationText: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeRule = {
  id: string;
  organizationId: string;
  knowledgeBaseVersionId: string;
  domain: KnowledgeBaseDomain;
  ruleKey: string;
  ruleLabel: string;
  ruleKind: KnowledgeRuleKind;
  status: KnowledgeRuleStatus;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeRuleCitation = {
  id: string;
  organizationId: string;
  knowledgeRuleId: string;
  knowledgeSourceId?: string | null;
  kbDocumentId?: string | null;
  pages: string;
  evidence: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type TrainingPlanObjectiveType =
  | "tecnico"
  | "tatico"
  | "motor"
  | "fisico"
  | "cognitivo";

export type TrainingPlanDevelopmentStage =
  | "fundamental"
  | "especializado"
  | "aplicado";

export type PedagogicalPeriodizationModel = "formacao" | "rendimento" | "hibrido";

export type PedagogicalPeriodizationLoad = {
  level: "baixo" | "medio" | "alto";
  trend?: "subindo" | "estavel" | "descendo";
};

export type PeriodizationContext = {
  model: PedagogicalPeriodizationModel;
  objective: string;
  focus: string;
  constraints?: string[];
  pedagogicalIntent?: string;
  load?: PedagogicalPeriodizationLoad;
  cyclePhase?: string;
  source?: "class_plan" | "competitive_profile" | "default";
};

/**
 * Known convenience values for methodology approach.
 * Extend by adding to KnowledgeRuleRow (rule_kind = "methodology") — no code change needed.
 */
export type KnownMethodologyApproach = "analitico" | "global" | "jogo" | "hibrido";

export type HistoricalConfidence = "none" | "low" | "medium" | "high";

export type TrainingPlanGenerationHistoryMode =
  | "bootstrap"
  | "partial_history"
  | "strong_history";

export type TrainingPlanPlanningBasis = "cycle_based" | "class_based_bootstrap";

export type TrainingPlanGenerationMode = "periodized" | "class_bootstrap";

export type TrainingPlanGenerationExplanation = {
  historyMode: TrainingPlanGenerationHistoryMode;
  summary: string;
  coachSummary: string;
  planningBasis?: TrainingPlanPlanningBasis;
  generationMode?: TrainingPlanGenerationMode;
};

export type SessionExecutionState =
  | "planned_only"
  | "applied_not_confirmed"
  | "teacher_edited"
  | "confirmed_executed"
  | "skipped"
  | "unknown";

export type TeacherOverrideWeight = "none" | "soft" | "medium" | "strong";

export type TeacherEditedField =
  | "primarySkill"
  | "progressionDimension"
  | "methodologyApproach"
  | "activityStructure"
  | "loadProfile";

export type PhaseIntent =
  | "exploracao_fundamentos"
  | "estabilizacao_tecnica"
  | "aceleracao_decisao"
  | "transferencia_jogo"
  | "pressao_competitiva";

export type WeeklyLoadIntent = "baixo" | "moderado" | "alto";

export type PedagogicalIntent =
  | "decision_making"
  | "game_reading"
  | "team_organization"
  | "technical_adjustment"
  | "pressure_adaptation";

export type DominantGapType =
  | "tecnica"
  | "consistencia"
  | "tomada_decisao"
  | "organizacao"
  | "pressao";

export type StrategyLevel = "low" | "medium" | "high";

export type TrainingPlanActivity = {
  name: string;
  description?: string;
  objective?: string;
  criteria?: TrainingPlanCriterion[];
  source?: "ai" | "fallback";
  confidence?: number;
  constraints?: string[];
  progression?: string;
};

export type TrainingPlanCriterion = {
  type: "consistencia" | "precisao" | "decisao" | "eficiencia";
  description: string;
  threshold?: number;
};

export type LessonActivity = {
  id?: string;
  name: string;
  description: string;
};

export type LessonBlock = {
  key: "warmup" | "main" | "cooldown";
  label: string;
  durationMinutes: number;
  activities: LessonActivity[];
  // Legacy fallback for migration/read compatibility.
  summary?: string;
};

export type TrainingPlanSessionBlock = {
  summary?: string;
  activities: TrainingPlanActivity[];
};

export type TrainingPlanPedagogy = {
  generationExplanation?: TrainingPlanGenerationExplanation;
  periodizationContext?: PeriodizationContext;
  periodization?: {
    phase: string;
    theme: string;
    technicalFocus: string;
    physicalFocus: string;
    constraints?: string;
    rpeTarget?: string;
    weekNumber?: number;
    startDate?: string;
  };
  sessionObjective?: string;
  learningObjectives?: {
    general: string;
    specific: string[];
    cap?: {
      conceitual: string[];
      procedimental: string[];
      atitudinal: string[];
    };
    successCriteria?: string[];
    pedagogicalGuidelines?: string[];
  };
  adaptation?: {
    achieved: boolean;
    performanceScore: number;
    targetScore: number;
    adjustment: "increase" | "maintain" | "regress";
    evidence: string;
    sampleConfidence?: "baixo" | "medio" | "alto";
    learningVelocity?: number;
    consistencyScore?: number;
    deltaFromPrevious?: number | null;
    gap?: {
      value: number;
      level: "residual" | "pequeno" | "moderado" | "critico";
      direction: "deficit" | "superavit";
    };
    telemetry?: {
      decisionId: string;
      decision: {
        suggested: "increase" | "maintain" | "regress";
        applied: "increase" | "maintain" | "regress";
        wasFollowed: boolean;
      };
      context: {
        gapLevel: "residual" | "pequeno" | "moderado" | "critico";
        trend: "subindo" | "estagnado" | "caindo";
        sampleConfidence: "baixo" | "medio" | "alto";
        consistencyScore: number;
        learningVelocity: number;
      };
      reason?: {
        type?: "health" | "readiness" | "context" | "other";
        note?: string;
      };
      meta: {
        sessionId: string;
        classId: string;
      };
      timestamp: string;
    };
  };
  skillLearningState?: {
    skill: VolleyballSkill;
    level: "instavel" | "consolidando" | "consistente";
    trend: "subindo" | "estagnado" | "caindo";
  };
  blocks?: {
    warmup: TrainingPlanSessionBlock;
    main: TrainingPlanSessionBlock;
    cooldown: TrainingPlanSessionBlock;
  };
  objective?: {
    type: TrainingPlanObjectiveType;
    description: string;
  };
  focus?: {
    skill: VolleyballSkill;
    subSkill?: string;
  };
  progression?: {
    dimension: ProgressionDimension;
  };
  developmentStage?: TrainingPlanDevelopmentStage;
  load?: {
    intendedRPE: number;
    volume: "baixo" | "moderado" | "alto";
  };
  methodology?: {
    /**
     * Known values: KnownMethodologyApproach.
     * Can also be any KnowledgeRuleRow.rule_key (kind = "methodology") for custom approaches.
     * Decoupled from a fixed author/framework — updated via KB, not via code.
     */
    approach: KnownMethodologyApproach | string;
    /** Optional direct link to a KnowledgeRuleRow.id for full audit trail. */
    kbRuleKey?: string;
    /** Source of the methodology definition — "internal_kb" | "manual" | "manual_override". */
    source?: "internal_kb" | "manual" | "manual_override";
    constraints?: string[];
    reasoning?: {
      matchedContext: boolean;
      matchedModality: boolean;
      matchedLevel: boolean;
      score: number;
      overridden?: boolean;
      ruleLabel?: string;
      domain?: KnowledgeBaseDomain;
      knowledgeBaseVersionId?: string;
      knowledgeBaseVersionLabel?: string;
      alternatives?: Array<{
        ruleId: string;
        ruleKey: string;
        ruleLabel?: string;
        score: number;
      }>;
    };
  };
  pedagogicalApproach?: PedagogicalApproachDetection;
  /**
   * Pedagogical dimensions system - science-based guidance on session design.
   * v1: Metadata only (for analytics, not yet driving decisions).
   */
  dimensions?: {
    base: {
      variability: "baixa" | "media" | "alta";
      representativeness: "baixa" | "media" | "alta";
      decisionMaking: "baixa" | "media" | "alta";
      taskComplexity: "baixa" | "media" | "alta";
      feedbackFrequency: "baixa" | "media" | "alta";
    };
    refined?: {
      variability: "baixa" | "media" | "alta";
      representativeness: "baixa" | "media" | "alta";
      decisionMaking: "baixa" | "media" | "alta";
      taskComplexity: "baixa" | "media" | "alta";
      feedbackFrequency: "baixa" | "media" | "alta";
      adjustments?: Array<{
        dimension: string;
        oldLevel: "baixa" | "media" | "alta";
        newLevel: "baixa" | "media" | "alta";
        reason: string;
        delta: number;
        timestamp: string;
      }>;
      refinedAt?: string;
    };
    derivedAt?: string;
    confidenceLevel?: "alta" | "media" | "baixa";
  };
  override?: {
    type: "methodology";
    fromRuleId: string;
    toRuleId: string;
    fromApproach: string;
    toApproach: string;
    reason?: {
      text?: string;
      tags?: string[];
    };
    userId?: string;
    createdAt: string;
  };
};

export type TrainingPlan = {
  id: string;
  classId: string;
  title: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmupTime: string;
  mainTime: string;
  cooldownTime: string;
  applyDays?: number[];
  applyDate?: string;
  createdAt: string;
  version?: number;
  status?: "generated" | "final";
  origin?: "auto" | "manual" | "manual_apply" | "edited_auto" | "imported";
  inputHash?: string;
  generatedAt?: string;
  finalizedAt?: string;
  parentPlanId?: string;
  previousVersionId?: string;
  pedagogy?: TrainingPlanPedagogy;
};

export type RecentSessionSummary = {
  sessionDate: string;
  wasPlanned: boolean;
  wasApplied: boolean;
  wasEditedByTeacher: boolean;
  wasConfirmedExecuted: boolean | null;
  executionState: SessionExecutionState;
  primarySkill?: VolleyballSkill;
  secondarySkill?: VolleyballSkill;
  progressionDimension?: ProgressionDimension;
  dominantBlock?: string;
  fingerprint?: string;
  structuralFingerprint?: string;
  methodologyApproach?: KnownMethodologyApproach | string;
  teacherEditedFields?: TeacherEditedField[];
  teacherOverrideWeight: TeacherOverrideWeight;
};

export type RepetitionRisk = "none" | "low" | "medium" | "high";

export type RepetitionAdjustment = {
  detected: boolean;
  risk: RepetitionRisk;
  reason: string | null;
  changedFields: string[];
};

export type WeekSessionRole =
  | "introducao_exploracao"
  | "retomada_consolidacao"
  | "consolidacao_orientada"
  | "pressao_decisao"
  | "transferencia_jogo"
  | "sintese_fechamento";

export type WeeklyOperationalQuarter = "Q1" | "Q2" | "Q3" | "Q4" | "unknown";

export type WeeklyOperationalClosingType =
  | "exploracao"
  | "consolidacao"
  | "aplicacao"
  | "fechamento"
  | "unknown";

export type WeeklyOperationalDecision = {
  sessionIndexInWeek: number;
  sessionRole: WeekSessionRole;
  quarterFocus: string;
  appliedRules: string[];
  driftRisks: string[];
  quarter: WeeklyOperationalQuarter;
  closingType: WeeklyOperationalClosingType;
  sessionEnvironment?: SessionEnvironment;
  sessionPrimaryComponent?: SessionPrimaryComponent;
};

export type WeeklyOperationalStrategySnapshot = {
  decisions: WeeklyOperationalDecision[];
  quarterFocus: string;
  sessionRoleSummary: string;
  weekIntentSummary: string;
  weekRulesApplied: string[];
  diagnostics: {
    quarter: WeeklyOperationalQuarter;
    closingType: WeeklyOperationalClosingType;
    driftRisks: string[];
  };
};

export type WeeklySessionCoherenceCheck = {
  sessionIndexInWeek: number;
  sessionRole: WeekSessionRole;
  envelopeRespected: boolean;
  reason?: string;
};

export type PedagogicalDriftCode =
  | "weekly_session_misalignment"
  | "quarter_week_misalignment"
  | "load_flattening"
  | "repetition_excess"
  | "progression_stagnation";

export type PedagogicalDriftSignal = {
  detected: boolean;
  severity: "low" | "medium" | "high";
  reason: string;
  code: PedagogicalDriftCode;
};

export type SessionOperationalDebug = {
  sessionIndex: number;
  sessionRole: WeekSessionRole;
  finalStrategy: SessionStrategy | null;
  rulesApplied: string[];
  envelopeRespected: boolean;
};

export type WeeklyObservabilitySummary = {
  quarterFocus: string;
  quarter: WeeklyOperationalQuarter;
  closingType: WeeklyOperationalClosingType;
  weekRulesApplied: string[];
  driftRisks: string[];
  sessionRoleSummary: string;
  sessionSummaries: Array<{
    sessionIndexInWeek: number;
    sessionRole: WeekSessionRole;
  }>;
  coherence: WeeklySessionCoherenceCheck[];
  driftSignals: PedagogicalDriftSignal[];
  sessionDebug: SessionOperationalDebug[];
};

export type CycleDayPlanningContext = {
  classId: string;
  classGoal?: string;
  sessionDate: string;
  modality: Modality;
  classLevel: ClassGroup["level"];
  ageBand: AgeBand;
  daysPerWeek: ClassGroup["daysPerWeek"];
  developmentStage: TrainingPlanDevelopmentStage;
  planningPhase?: "base" | "desenvolvimento" | "pre_competitivo" | "competitivo";
  weekNumber?: number;
  sessionIndexInWeek?: number;
  historicalConfidence: HistoricalConfidence;
  phaseIntent: PhaseIntent;
  weeklyLoadIntent: WeeklyLoadIntent;
  primarySkill: VolleyballSkill;
  secondarySkill?: VolleyballSkill;
  progressionDimensionTarget: ProgressionDimension;
  pedagogicalIntent: PedagogicalIntent;
  recentSessions: RecentSessionSummary[];
  weeklyOperationalDecision?: WeeklyOperationalDecision;
  dominantGapSkill?: VolleyballSkill;
  dominantGapType?: DominantGapType;
  dominantBlock?: string;
  targetPse?: number;
  demandIndex?: number;
  plannedSessionLoad?: number;
  plannedWeeklyLoad?: number;
  duration: number;
  materials: string[];
  constraints: string[];
  mustAvoidRepeating: string[];
  mustProgressFrom?: string;
  allowedDrillFamilies: string[];
  forbiddenDrillFamilies: string[];
};

export type SessionStrategy = {
  primarySkill: VolleyballSkill;
  secondarySkill?: VolleyballSkill;
  progressionDimension: ProgressionDimension;
  pedagogicalIntent: PedagogicalIntent;
  loadIntent: WeeklyLoadIntent;
  drillFamilies: string[];
  forbiddenDrillFamilies: string[];
  oppositionLevel: StrategyLevel;
  timePressureLevel: StrategyLevel;
  gameTransferLevel: StrategyLevel;
};

export type PlanFingerprint = {
  primarySkill: VolleyballSkill;
  secondarySkill?: VolleyballSkill;
  progressionDimension: ProgressionDimension;
  dominantBlock?: string;
  periodizationPhase?: CycleDayPlanningContext["planningPhase"];
  sessionIndexInWeek?: number;
  pedagogicalIntent?: PedagogicalIntent;
  drillFamilies: string[];
  loadIntent: WeeklyLoadIntent;
  oppositionLevel?: StrategyLevel;
  timePressureLevel?: StrategyLevel;
  gameTransferLevel?: StrategyLevel;
};

export type PlanFingerprintSet = {
  exactFingerprint: string;
  structuralFingerprint: string;
};

// ─── Resistance Training Domain Types (R3) ───────────────────────────────────

export type ResistanceExerciseCategory =
  | "empurrar"
  | "puxar"
  | "membros_inferiores"
  | "potencia"
  | "preventivo"
  | "core";

export type ResistanceTrainingGoal =
  | "forca_base"
  | "hipertrofia"
  | "potencia_atletica"
  | "resistencia_muscular"
  | "prevencao_lesao"
  | "ativacao_funcional";

export type ResistanceExercisePrescription = {
  name: string;
  category: ResistanceExerciseCategory;
  sets: number;
  reps: string;         // e.g. "8-10", "6", "AMRAP"
  rest: string;         // e.g. "90s", "2min"
  cadence?: string;     // e.g. "2-0-2"
  notes?: string;
  transferTarget?: string;  // volleyball-specific carry-over
};

export type ResistanceTrainingPlan = {
  id: string;
  label: string;
  primaryGoal: ResistanceTrainingGoal;
  transferTarget: string;       // e.g. "salto de ataque e bloqueio"
  estimatedDurationMin: number;
  exercises: ResistanceExercisePrescription[];
};

/** Discriminated union of session building blocks. */
export type SessionComponentQuadraTecnicoTatico = {
  type: "quadra_tecnico_tatico";
  description: string;
  durationMin: number;
};

export type SessionComponentAcademiaResistido = {
  type: "academia_resistido";
  resistancePlan: ResistanceTrainingPlan;
  durationMin: number;
};

export type SessionComponentPreventivo = {
  type: "preventivo";
  description: string;
  durationMin: number;
};

export type SessionComponent =
  | SessionComponentQuadraTecnicoTatico
  | SessionComponentAcademiaResistido
  | SessionComponentPreventivo;

// ─── Weekly Integrated Training Context (R5) ─────────────────────────────────

/** What physical quality the week prioritises. */
export type WeeklyPhysicalEmphasis =
  | "forca_base"
  | "potencia_atletica"
  | "resistencia_especifica"
  | "velocidade_reatividade"
  | "prevencao_recuperacao"
  | "manutencao";

/** Relationship between court and gym load within the week. */
export type CourtGymRelationship =
  | "quadra_dominante"        // ≥75% court load
  | "complementar_equilibrado" // ~50/50
  | "academia_prioritaria"    // ≥75% gym load
  | "separado_sem_transferencia"
  | "integrado_transferencia_direta";

export type WeeklyIntegratedTrainingContext = {
  weeklyPhysicalEmphasis: WeeklyPhysicalEmphasis;
  courtGymRelationship: CourtGymRelationship;
  gymSessionsCount: number;
  courtSessionsCount: number;
  interferenceRisk: "baixo" | "moderado" | "alto";
  notes: string;
};

export type TrainingTemplate = {
  id: string;
  title: string;
  ageBand: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmupTime: string;
  mainTime: string;
  cooldownTime: string;
  createdAt: string;
};

export type HiddenTemplate = {
  id: string;
  templateId: string;
  createdAt: string;
};

export type Student = {
  id: string;
  name: string;
  organizationId: string;
  photoUrl?: string;
  ra?: string | null;
  raStartYear?: number | null;
  externalId?: string | null;
  cpfMasked?: string | null;
  cpfHmac?: string | null;
  rg?: string | null;
  rgNormalized?: string | null;
  collegeCourse?: string | null;
  isExperimental?: boolean;
  sourcePreRegistrationId?: string | null;
  classId: string;
  age: number;
  phone: string;
  loginEmail: string;
  guardianName: string;
  guardianPhone: string;
  guardianRelation: string;
  birthDate: string;
  healthIssue: boolean;
  healthIssueNotes: string;
  medicationUse: boolean;
  medicationNotes: string;
  healthObservations: string;
  positionPrimary: AthletePosition;
  positionSecondary: AthletePosition;
  athleteObjective: AthleteObjective;
  learningStyle: AthleteLearningStyle;
  createdAt: string;
};

export type StudentPreRegistrationStatus =
  | "lead"
  | "trial_scheduled"
  | "trial_done"
  | "converted"
  | "lost";

export type StudentPreRegistration = {
  id: string;
  organizationId: string;
  childName: string;
  guardianName: string;
  guardianPhone: string;
  ageOrBirth?: string | null;
  classInterest?: string | null;
  unitInterest?: string | null;
  trialDate?: string | null;
  status: StudentPreRegistrationStatus;
  notes?: string | null;
  convertedStudentId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AttendanceRecord = {
  id: string;
  classId: string;
  studentId: string;
  date: string;
  status: "presente" | "faltou";
  note: string;
  painScore: number;
  createdAt: string;
};

export type AbsenceNoticeStatus = "pending" | "confirmed" | "ignored";

export type AbsenceNotice = {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  reason: string;
  note: string;
  status: AbsenceNoticeStatus;
  createdAt: string;
};

export type ScoutingLog = {
  id: string;
  clientId?: string;
  classId: string;
  unit: string;
  mode: "treino" | "jogo";
  date: string;
  serve0: number;
  serve1: number;
  serve2: number;
  receive0: number;
  receive1: number;
  receive2: number;
  set0: number;
  set1: number;
  set2: number;
  attackSend0: number;
  attackSend1: number;
  attackSend2: number;
  createdAt: string;
  updatedAt?: string;
};

export type StudentScoutingLog = {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  serve0: number;
  serve1: number;
  serve2: number;
  receive0: number;
  receive1: number;
  receive2: number;
  set0: number;
  set1: number;
  set2: number;
  attackSend0: number;
  attackSend1: number;
  attackSend2: number;
  createdAt: string;
  updatedAt?: string;
};

export type PlanningCycle = {
  id: string;
  classId: string;
  year: number;
  title: string;
  startDate: string;
  endDate: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type ClassPlan = {
  id: string;
  classId: string;
  cycleId?: string;
  startDate: string;
  weekNumber: number;
  phase: string;
  theme: string;
  generalObjective?: string;
  specificObjective?: string;
  technicalFocus: string;
  physicalFocus: string;
  pedagogicalRule?: string;
  weekNotes?: string;
  constraints: string;
  mvFormat: string;
  warmupProfile: string;
  jumpTarget: string;
  rpeTarget: string;
  source: "AUTO" | "MANUAL";
  blueprintId?: string;
  generationVersion?: number;
  derivedFromBlueprintVersion?: number;
  generationModelVersion?: string;
  generationContextSnapshotJson?: string;
  syncStatus?: "in_sync" | "out_of_sync" | "overridden" | "stale_parent";
  outOfSyncReasonsJson?: string;
  manualOverridesJson?: string;
  manualOverrideMaskJson?: string;
  lastAutoGeneratedAt?: string;
  lastManualEditedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** R5: serialised WeeklyIntegratedTrainingContext | null */
  weeklyIntegratedContextJson?: string;
};

export type MonthlyPlanningBlueprint = {
  id: string;
  classId: string;
  cycleId?: string;
  year: number;
  month: number;
  title: string;
  macroIntent: string;
  pedagogicalProgression: string;
  weeklyFocusDistributionJson: string;
  constraintsJson: string;
  contextSnapshotJson: string;
  generationModelVersion: string;
  generationVersion: number;
  syncStatus: "in_sync" | "out_of_sync" | "regenerating";
  lastAutoGeneratedAt: string;
  lastManualEditedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type DailyLessonPlan = {
  id: string;
  classId: string;
  weeklyPlanId: string;
  date: string;
  dayOfWeek: number;
  title: string;
  blocksJson?: string;
  /** R3: structured session components (court + gym blocks) */
  sessionComponents?: SessionComponent[];
  /** R2: resolved environment for this session */
  sessionEnvironment?: SessionEnvironment;
  warmup: string;
  mainPart: string;
  cooldown: string;
  observations: string;
  generationVersion?: number;
  derivedFromWeeklyVersion?: number;
  generationModelVersion?: string;
  generationContextSnapshotJson?: string;
  syncStatus?: "in_sync" | "out_of_sync" | "overridden" | "stale_parent";
  outOfSyncReasonsJson?: string;
  manualOverridesJson?: string;
  manualOverrideMaskJson?: string;
  lastAutoGeneratedAt?: string;
  lastManualEditedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ClassCompetitiveProfile = {
  classId: string;
  organizationId: string;
  planningMode: CompetitivePlanningMode;
  cycleStartDate: string;
  targetCompetition: string;
  targetDate: string;
  tacticalSystem: string;
  currentPhase: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ClassCalendarException = {
  id: string;
  classId: string;
  organizationId: string;
  date: string;
  reason: string;
  kind: ClassCalendarExceptionKind;
  createdAt: string;
};

export type Exercise = {
  id: string;
  title: string;
  tags: string[];
  videoUrl: string;
  source: string;
  description: string;
  publishedAt: string;
  notes: string;
  createdAt: string;
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

export type KnowledgeDocument = {
  id: string;
  organizationId: string;
  title: string;
  source: string;
  chunk: string;
  embedding: number[];
  tags: string[];
  sport: string;
  level: string;
  createdAt: string;
};

export type OrganizationAiProfile = {
  id: string;
  organizationId: string;
  philosophy: string;
  constraints: string[];
  goals: string[];
  equipmentNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type UnitAiProfile = {
  id: string;
  organizationId: string;
  unitId: string;
  realityNotes: string;
  constraints: string[];
  focus: string[];
  createdAt: string;
  updatedAt: string;
};

export type SessionSkillSnapshot = {
  id: string;
  organizationId: string;
  classId: string;
  unitId: string;
  sessionDate: string;
  objective: string;
  focusSkills: VolleyballSkill[];
  consistencyScore: number;
  successRate: number;
  decisionQuality: number;
  appliedDrillIds: string[];
  notes: string[];
  createdAt: string;
};

export type ProgressionSessionPlan = {
  objective: string;
  progressionDimension: ProgressionDimension;
  warmup: string[];
  technicalTactical: string[];
  conditionedGame: string[];
  successCriteria: string[];
  regressions: string[];
  progressions: string[];
  riskAdjustments: string[];
};

export type WeeklyAutopilotStatus = "draft" | "proposed" | "approved" | "rejected";

export type WeeklyAutopilotKnowledgeReference = {
  sourceId: string;
  title: string;
  authors: string;
  sourceYear?: number | null;
  sourceType: KnowledgeSourceType;
  citationText: string;
  url: string;
};

export type WeeklyAutopilotKnowledgeContext = {
  versionId: string;
  versionLabel: string;
  domain: KnowledgeBaseDomain;
  references: WeeklyAutopilotKnowledgeReference[];
  ruleHighlights: string[];
};

export type WeeklyAutopilotPlanReviewChange = {
  field: string;
  before: unknown;
  after: unknown;
};

export type WeeklyAutopilotPlanReviewDiff = {
  weekStart: string;
  changes: WeeklyAutopilotPlanReviewChange[];
};

export type WeeklyAutopilotPlanReviewIssue = {
  weekStart: string;
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  reference?: string | null;
  ruleId?: string | null;
  ruleType?: "hard" | "soft" | null;
  priority?: number | null;
  autoCorrected?: boolean;
};

export type WeeklyAutopilotPlanReview = {
  ok: boolean;
  versionLabel: string;
  domain: KnowledgeBaseDomain;
  diffs: WeeklyAutopilotPlanReviewDiff[];
  issues: WeeklyAutopilotPlanReviewIssue[];
  warnings: string[];
  citations: string[];
};

export type WeeklyAutopilotProposal = {
  id: string;
  organizationId: string;
  classId: string;
  weekStart: string;
  summary: string;
  actions: string[];
  proposedPlanIds: string[];
  status: WeeklyAutopilotStatus;
  createdBy: string;
  knowledgeBaseVersionId?: string | null;
  knowledgeBaseVersionLabel?: string | null;
  knowledgeDomain?: KnowledgeBaseDomain | null;
  knowledgeReferences: WeeklyAutopilotKnowledgeReference[];
  knowledgeRuleHighlights: string[];
  planReview?: WeeklyAutopilotPlanReview | null;
  createdAt: string;
  updatedAt: string;
};

export type MemoryScope = "organization" | "class" | "coach";

export type AssistantMemoryEntry = {
  id: string;
  organizationId: string;
  classId: string;
  userId: string;
  scope: MemoryScope;
  role: "user" | "assistant";
  content: string;
  expiresAt: string;
  createdAt: string;
};

export type EvolutionSimulationPoint = {
  week: number;
  projectedScore: number;
  confidence: number;
  focus: string;
};

export type EvolutionSimulationResult = {
  classId: string;
  baselineScore: number;
  horizonWeeks: number;
  assumptions: string[];
  points: EvolutionSimulationPoint[];
  requiresHumanApproval: true;
};

export type ClassProfile = {
  classId: string;
  organizationId: string;
  unitId: string;
  modality: "volleyball_indoor";
  ageBand: string;
  level: "initiation" | "development" | "performance";
  sessionsPerWeek: number;
  cycleGoal: string;
  constraintsDefault: string[];
  createdAt: string;
  updatedAt: string;
};

export type SessionExecutionDrill = {
  drillId: string;
  minutes: number;
  variationId?: string;
  notes?: string;
  successMetric?: string;
};

export type SessionExecutionLog = {
  id: string;
  classId: string;
  date: string;
  plannedFocusTags: string[];
  executedDrills: SessionExecutionDrill[];
  rpeGroup: number;
  quality: "low" | "medium" | "high";
  constraints: string[];
  coachNotes: string;
  attendanceCount: number;
  createdAt: string;
};

export type LessonPlanCitation = {
  docId: string;
  pages: string;
  why: string;
};

export type VolleyballLessonPlan = {
  sport: "volleyball_indoor";
  classId: string;
  unitId: string;
  cycle: { mesoWeek: number; microDay: string };
  primaryFocus: { skill: string; ladderFrom: string; ladderTo: string };
  secondaryFocus: { skill: string; ladderFrom: string; ladderTo: string };
  loadIntent: "low" | "moderate" | "high";
  rulesTriggered: string[];
  blocks: {
    type: "warmup_preventive" | "skill" | "game_conditioned" | "cooldown_feedback";
    minutes: number;
    drillIds: string[];
    successCriteria?: string[];
    scoring?: string;
    notes?: string;
  }[];
  adaptations: { if: string; change: string }[];
  evidence: {
    lastSession: {
      rpeGroup: number;
      quality: "low" | "medium" | "high";
      attendanceCount: number;
      focusTags: string[];
    };
  };
  citations: LessonPlanCitation[];
};
