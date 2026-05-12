export type ScoutingActionSkill =
  | "serve"
  | "receive"
  | "set"
  | "attack"
  | "block"
  | "defense"
  | "coverage"
  | "transition"
  | "communication";

export type ScoutingActionQuality = "error" | "low" | "medium" | "high" | "excellent";
export type ScoutingActionScore = 0 | 1 | 2 | 3;
export type ScoutingActionGamePhase =
  | "serve"
  | "sideout"
  | "transition"
  | "freeball"
  | "out_of_system";
export type ScoutingActionPressureLevel = "low" | "medium" | "high";
export type ScoutingActionSource = "coach" | "athlete_self" | "assistant" | "import";

export type ScoutingAction = {
  id: string;
  scoutingSessionId: string;
  classId: string;
  athleteId?: string;
  athleteName?: string;
  skill: ScoutingActionSkill;
  actionType: string;
  quality: ScoutingActionQuality;
  score?: ScoutingActionScore;
  label?: string;
  gamePhase?: ScoutingActionGamePhase;
  pressureLevel?: ScoutingActionPressureLevel;
  rotation?: string;
  zone?: string;
  videoTimestampSec?: number;
  videoTimestampMs?: number;
  videoLabel?: string;
  clipReference?: string;
  notes?: string;
  source: ScoutingActionSource;
  createdAt: string;
};

export type CreateScoutingActionInput = {
  scoutingSessionId: string;
  classId: string;
  athleteId?: string;
  athleteName?: string;
  skill: string;
  actionType: string;
  quality: string;
  score?: ScoutingActionScore;
  label?: string;
  gamePhase?: ScoutingActionGamePhase;
  pressureLevel?: ScoutingActionPressureLevel;
  rotation?: string;
  zone?: string;
  videoTimestampSec?: number;
  videoTimestampMs?: number;
  videoLabel?: string;
  clipReference?: string;
  notes?: string;
  source?: ScoutingActionSource;
};
