export type AgeBand = string;
export type Goal = string;
export type Equipment = "quadra" | "funcional" | "academia" | "misto";
export type ClassGender = "masculino" | "feminino" | "misto";
export type Modality = "voleibol" | "fitness";

export type ClassGroup = {
  id: string;
  name: string;
  unit: string;
  unitId?: string;
  colorKey?: string;
  modality?: Modality;
  ageBand: AgeBand;
  gender: ClassGender;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  daysOfWeek: number[];
  daysPerWeek: number;
  goal: Goal;
  equipment: Equipment;
  level: 1 | 2 | 3;
  mvLevel?: string;
  cycleStartDate?: string;
  cycleLengthWeeks?: number;
  acwrLow?: number;
  acwrHigh?: number;
  createdAt?: string;
};

export type Unit = {
  id: string;
  name: string;
  address?: string;
  notes?: string;
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
  technique: "boa" | "ok" | "ruim";
  attendance: number;
  activity?: string;
  conclusion?: string;
  participantsCount?: number;
  photos?: string;
  painScore?: number;
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
  applyDays?: number[];
  applyDate?: string;
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
  classId: string;
  age: number;
  phone: string;
  loginEmail?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
  birthDate?: string;
  healthIssue?: boolean;
  healthIssueNotes?: string;
  medicationUse?: boolean;
  medicationNotes?: string;
  healthObservations?: string;
  createdAt: string;
};

export type AttendanceRecord = {
  id: string;
  classId: string;
  studentId: string;
  date: string;
  status: "presente" | "faltou";
  note: string;
  painScore?: number;
  createdAt: string;
};

export type AbsenceNoticeStatus = "pending" | "confirmed" | "ignored";

export type AbsenceNotice = {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  reason: string;
  note?: string;
  status: AbsenceNoticeStatus;
  createdAt: string;
};

export type ScoutingLog = {
  id: string;
  clientId?: string;
  classId: string;
  unit?: string;
  mode?: "treino" | "jogo";
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
  updatedAt?: string;
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
