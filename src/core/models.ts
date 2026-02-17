export type AgeBand = string;
export type Goal = string;
export type Equipment = "quadra" | "funcional" | "academia" | "misto";
export type ClassGender = "masculino" | "feminino" | "misto";
export type Modality = "voleibol" | "fitness";
export type AthletePosition =
  | "indefinido"
  | "levantador"
  | "oposto"
  | "ponteiro"
  | "central"
  | "libero";
export type AthleteObjective = "ludico" | "base" | "rendimento";
export type AthleteLearningStyle = "misto" | "visual" | "auditivo" | "cinestesico";

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
  id: string;
  clientId: string;
  classId: string;
  PSE: number;
  technique: "boa" | "ok" | "ruim";
  attendance: number;
  activity: string;
  conclusion: string;
  participantsCount: number;
  photos: string;
  painScore: number;
  createdAt: string;
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
  applyDays: number[];
  applyDate: string;
  createdAt: string;
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
  clientId: string;
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
  updatedAt: string;
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
  updatedAt: string;
};

export type ClassPlan = {
  id: string;
  classId: string;
  startDate: string;
  weekNumber: number;
  phase: string;
  theme: string;
  technicalFocus: string;
  physicalFocus: string;
  constraints: string;
  mvFormat: string;
  warmupProfile: string;
  jumpTarget: string;
  rpeTarget: string;
  source: "AUTO" | "MANUAL";
  createdAt: string;
  updatedAt: string;
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
  blocks: Array<{
    type: "warmup_preventive" | "skill" | "game_conditioned" | "cooldown_feedback";
    minutes: number;
    drillIds: string[];
    successCriteria?: string[];
    scoring?: string;
    notes?: string;
  }>;
  adaptations: Array<{ if: string; change: string }>;
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
