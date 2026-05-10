export type ScoutingSessionType = "training" | "friendly" | "official_match";
export type ScoutingSessionStatus = "draft" | "in_progress" | "completed" | "archived";
export type ScoutingSessionSource = "manual" | "session" | "event";

export type ScoutingSession = {
  id: string;
  classId: string;
  date: string;
  type: ScoutingSessionType;
  title: string;
  opponent?: string;
  location?: string;
  videoUrl?: string;
  status: ScoutingSessionStatus;
  source?: ScoutingSessionSource;
  relatedEventId?: string;
  createdAt: string;
  updatedAt?: string;
};

export type CreateScoutingSessionDraftInput = {
  classId: string;
  date: string;
  type: ScoutingSessionType;
  title?: string;
  opponent?: string;
  location?: string;
  videoUrl?: string;
  source?: ScoutingSessionSource;
  relatedEventId?: string;
};
