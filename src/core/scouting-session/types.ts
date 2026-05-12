export type ScoutingSessionType = "training" | "friendly" | "official_match";
export type ScoutingSessionStatus = "draft" | "in_progress" | "completed" | "archived";
export type ScoutingSessionSource = "manual" | "session" | "event";
export type ScoutingSessionSourceType = "live_training" | "live_match" | "video" | "manual";

export type ScoutingSession = {
  id: string;
  classId: string;
  date: string;
  type: ScoutingSessionType;
  title: string;
  opponent?: string;
  location?: string;
  videoUrl?: string;
  sourceType?: ScoutingSessionSourceType;
  videoClipType?: string;
  videoNotes?: string;
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
  sourceType?: ScoutingSessionSourceType;
  videoClipType?: string;
  videoNotes?: string;
  source?: ScoutingSessionSource;
  relatedEventId?: string;
};
